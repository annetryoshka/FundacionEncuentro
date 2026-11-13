import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { DatabaseService } from '../dist/database/database.service.js';
import { PagosService } from '../dist/modules/casos/pagos.service.js';

const habilitado = process.env.FE88_PG_QA === '1'
  && Boolean(process.env.FE88_PG_ADMIN_URL);

test('FE-88: concurrencia y rollback con PostgreSQL real', {
  skip: habilitado ? false : 'Requiere PostgreSQL QA local opt-in',
  timeout: 60000,
}, async (t) => {
  const url = new URL(process.env.FE88_PG_ADMIN_URL);

  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.pathname, '/fe88_qa');

  const esquema = `fe88_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.toString() });

  let db;
  let observador;

  await admin.connect();

  try {
    await admin.query(`create schema "${esquema}"`);
    await admin.query(`set search_path to "${esquema}"`);

    // Fixture aislada: reproduce las relaciones y restricciones
    // necesarias para probar PagosService, sin datos de Supabase.
    await admin.query(`
      create table pacientes (
        id uuid primary key,
        deleted_at timestamptz
      );

      create table casos (
        id uuid primary key,
        paciente_id uuid not null references pacientes(id),
        deleted_at timestamptz
      );

      create table fichas_seguimiento (
        id uuid primary key,
        caso_id uuid not null references casos(id),
        unique (id, caso_id)
      );

      create table pagos (
        id uuid primary key default gen_random_uuid(),
        caso_id uuid not null references casos(id),
        sesion_id uuid not null unique,
        monto numeric not null
          check (monto > 0 and monto = round(monto, 2)
                 and monto < 100000000),
        moneda text not null check (moneda = 'BOB'),
        fecha date not null,
        metodo text not null check (metodo in ('qr', 'transferencia')),
        referencia text,
        registrado_por uuid not null,
        creado_en timestamptz not null default now(),
        foreign key (sesion_id, caso_id)
          references fichas_seguimiento(id, caso_id)
      );

      create table auditoria (
        registro_id uuid not null,
        usuario_id uuid,
        accion text not null
      );

      create function auditar_pago()
      returns trigger language plpgsql as $$
      begin
        insert into auditoria (registro_id, usuario_id, accion)
        values (
          new.id,
          nullif(current_setting('app.usuario_id', true), '')::uuid,
          'INSERT'
        );
        return new;
      end;
      $$;

      create trigger auditar_pago_insert
        after insert on pagos
        for each row execute function auditar_pago();
    `);

    const conexion = new URL(url);
    conexion.searchParams.set('options', `-csearch_path=${esquema}`);

    db = new DatabaseService({
      getOrThrow: (nombre) => {
        assert.equal(nombre, 'DATABASE_URL');
        return conexion.toString();
      },
    });

    observador = new pg.Client({
      connectionString: conexion.toString(),
    });
    await observador.connect();

    const servicio = new PagosService(db);
    const actor = randomUUID();

    async function escenario() {
      const paciente = randomUUID();
      const caso = randomUUID();
      const sesion = randomUUID();

      await admin.query(
        'insert into pacientes(id) values ($1)', [paciente],
      );
      await admin.query(
        'insert into casos(id, paciente_id) values ($1, $2)',
        [caso, paciente],
      );
      await admin.query(
        'insert into fichas_seguimiento(id, caso_id) values ($1, $2)',
        [sesion, caso],
      );

      return {
        caso,
        dto: {
          sesionId: sesion,
          monto: '75.50',
          fecha: '2026-11-12',
          metodo: 'qr',
          referencia: 'QA-LOCAL',
        },
      };
    }

    // Retiene el caso y comprueba que los dos intentos realmente
    // están esperando un bloqueo antes de liberarlos.
    async function simultaneos(caso, primera, segunda) {
      await admin.query('begin');

      let pendientes = [];

      try {
        await admin.query(
          'select id from casos where id = $1 for update', [caso],
        );

        pendientes = [primera(), segunda()];

        // Adjuntar manejadores inmediatamente evita rechazos sin manejar.
        const resultados = Promise.allSettled(pendientes);

        const limite = Date.now() + 10000;
        let bloqueados = 0;

        while (Date.now() < limite) {
          const consulta = await observador.query(`
            select count(*)::int as cantidad
              from pg_stat_activity
             where datname = current_database()
               and pid <> pg_backend_pid()
               and wait_event_type = 'Lock'
               and query like '%from casos c%'
               and query like '%for update of c%'
          `);

          bloqueados = consulta.rows[0].cantidad;
          if (bloqueados >= 2) break;
          await new Promise((resolver) => setTimeout(resolver, 50));
        }

        assert.ok(bloqueados >= 2, 'Los dos intentos deben esperar el bloqueo');
        await admin.query('commit');

        return await resultados;
      } finally {
        await admin.query('rollback');
        await Promise.allSettled(pendientes);
      }
    }

    await t.test('dos solicitudes iguales guardan un único pago', async () => {
      const { caso, dto } = await escenario();

      const resultados = await simultaneos(
        caso,
        () => servicio.registrar(caso, dto, actor),
        () => servicio.registrar(caso, dto, actor),
      );

      assert.ok(resultados.every((r) => r.status === 'fulfilled'));

      const valores = resultados.map((r) => r.value);
      assert.equal(valores[0].pago.id, valores[1].pago.id);
      assert.deepEqual(
        valores.map((r) => r.reutilizado).sort(),
        [false, true],
      );

      const consulta = await observador.query(
        `select count(*)::int as cantidad, sum(monto)::text as total
           from pagos where caso_id = $1`,
        [caso],
      );

      assert.equal(consulta.rows[0].cantidad, 1);
      assert.equal(Number(consulta.rows[0].total), 75.5);
    });

    await t.test('montos diferentes: uno guarda y otro recibe 409', async () => {
      const { caso, dto } = await escenario();

      const resultados = await simultaneos(
        caso,
        () => servicio.registrar(caso, dto, actor),
        () => servicio.registrar(caso, { ...dto, monto: '80.00' }, actor),
      );

      const exitos = resultados.filter((r) => r.status === 'fulfilled');
      const errores = resultados.filter((r) => r.status === 'rejected');

      assert.equal(exitos.length, 1);
      assert.equal(errores.length, 1);
      assert.equal(errores[0].reason.getStatus(), 409);

      const consulta = await observador.query(
        'select id, monto::text as monto from pagos where caso_id = $1',
        [caso],
      );

      assert.equal(consulta.rows.length, 1);
      assert.equal(consulta.rows[0].id, exitos[0].value.pago.id);
      assert.equal(consulta.rows[0].monto, exitos[0].value.pago.monto);
    });

    await t.test('fallo posterior al INSERT revierte pago y auditoría', async () => {
      const { caso, dto } = await escenario();
      let insertadoDentro = false;
      let auditadoDentro = false;

      // Usa la transacción real; solo intercepta la lectura de respuesta
      // para provocar un fallo después de confirmar que hubo INSERT.
      const servicioConFallo = new PagosService({
        transaction: (actorId, ejecutar) => db.transaction(
          actorId,
          async (client) => ejecutar({
            query: async (sql, parametros) => {
              if (sql.includes('as coincide')) {
                const pago = await client.query(
                  'select id from pagos where sesion_id = $1',
                  [dto.sesionId],
                );
                insertadoDentro = pago.rows.length === 1;

                const auditoria = await client.query(
                  'select usuario_id from auditoria where registro_id = $1',
                  [pago.rows[0].id],
                );
                auditadoDentro = auditoria.rows.length === 1
                  && auditoria.rows[0].usuario_id === actor;

                throw new Error('Fallo QA después del INSERT');
              }

              return client.query(sql, parametros);
            },
          }),
        ),
      });

      await assert.rejects(
        servicioConFallo.registrar(caso, dto, actor),
        /Fallo QA después del INSERT/,
      );

      assert.equal(insertadoDentro, true);
      assert.equal(auditadoDentro, true);

      // Otra conexión comprueba lo que realmente quedó confirmado.
      const pagos = await observador.query(
        'select id from pagos where sesion_id = $1', [dto.sesionId],
      );
      assert.equal(pagos.rows.length, 0);

      // En esta fixture, las auditorías previas deben corresponder
      // exclusivamente a pagos que sí siguen existiendo.
      const huerfanas = await observador.query(`
        select a.registro_id
          from auditoria a
          left join pagos p on p.id = a.registro_id
         where p.id is null
      `);
      assert.equal(huerfanas.rows.length, 0);

      const reintento = await servicio.registrar(caso, dto, actor);
      assert.equal(reintento.reutilizado, false);
    });
  } finally {
    await observador?.end();
    await db?.onModuleDestroy();
    await admin.query(`drop schema if exists "${esquema}" cascade`);
    await admin.end();
  }
});
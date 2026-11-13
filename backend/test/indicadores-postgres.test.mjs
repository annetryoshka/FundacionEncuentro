// FE-94: indicadores_operativos reproduce la conciliación manual de FE-91.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

let base, sql, sesiones;
before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe94'); sql = base.cliente;
  // Datos ficticios de docs/srs/sprint-2/FE-91-indicadores-y-conciliacion.md
  const A = await crearCaso(sql, { nombre: 'QA caso A', estado: 'iniciado', terapeuta: PERFILES.t1 });
  const B = await crearCaso(sql, { nombre: 'QA caso B', tipo: 'derivado', estado: 'en_proceso', terapeuta: PERFILES.t2 });
  const C = await crearCaso(sql, { nombre: 'QA caso C', estado: 'concluido' });
  const D = await crearCaso(sql, { nombre: 'QA caso D', estado: 'iniciado', terapeuta: PERFILES.t1 });
  sesiones = {
    A1: { caso: A, ...(await crearSesion(sql, A.id, { fecha: '2026-10-12' })) },
    A2: { caso: A, ...(await crearSesion(sql, A.id, { fecha: '2026-10-12' })) },
    B1: { caso: B, ...(await crearSesion(sql, B.id, { fecha: '2026-10-19', responsable: PERFILES.t2 })) },
    C1: { caso: C, ...(await crearSesion(sql, C.id, { fecha: '2026-10-11', responsable: PERFILES.admin })) },
    D1: { caso: D, ...(await crearSesion(sql, D.id, { fecha: '2026-10-20' })) },
  };
  for (const [clave, fecha, monto] of [['A1', '2026-10-12', '75.50'], ['A2', '2026-10-20', '40.25'],
    ['B1', '2026-10-19', '125.00'], ['C1', '2026-10-15', '25.10']]) {
    const s = sesiones[clave];
    await comoUsuario(sql, PERFILES.admin, () => sql.query(
      `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, $3, $4, 'qr')`,
      [s.caso.id, s.id, fecha, monto]));
  }
});
after(async () => { await base?.cerrar(); });

const indicadores = async (desde, hasta) => {
  const { rows } = await sql.query(
    `select casos_actuales, casos_iniciados, casos_en_proceso, casos_concluidos, sesiones,
            pagos_recibidos::text as pagos_recibidos
       from indicadores_operativos($1, $2)`, [desde, hasta]);
  return rows[0];
};

test('FE-94: período 12–19 de octubre coincide con la conciliación manual', opciones, async () => {
  assert.deepEqual(await indicadores('2026-10-12', '2026-10-19'), {
    casos_actuales: 4, casos_iniciados: 2, casos_en_proceso: 1, casos_concluidos: 1, sesiones: 3, pagos_recibidos: '225.60',
  });
});

test('FE-94: período sin movimientos devuelve 0 sesiones y 0,00', opciones, async () => {
  assert.deepEqual(await indicadores('2026-10-01', '2026-10-05'), {
    casos_actuales: 4, casos_iniciados: 2, casos_en_proceso: 1, casos_concluidos: 1, sesiones: 0, pagos_recibidos: '0',
  });
});

test('FE-94: los extremos del período se incluyen', opciones, async () => {
  const r = await indicadores('2026-10-20', '2026-10-20');
  assert.equal(r.sesiones, 1);           // S-D1
  assert.equal(r.pagos_recibidos, '40.25'); // pago de S-A2, por su propia fecha
});

test('FE-94: agregar dos tareas a S-A1 no cambia el resultado', opciones, async () => {
  for (const descripcion of ['Tarea QA 1', 'Tarea QA 2']) {
    await comoUsuario(sql, PERFILES.t1, () => sql.query(
      'insert into tareas_terapeuticas (caso_id, sesion_id, descripcion) values ($1, $2, $3)',
      [sesiones.A1.caso.id, sesiones.A1.id, descripcion]));
  }
  const r = await indicadores('2026-10-12', '2026-10-19');
  assert.equal(r.sesiones, 3);
  assert.equal(r.pagos_recibidos, '225.60');
});

test('FE-94: un caso eliminado deja de contar en casos, sesiones y pagos', opciones, async () => {
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update casos set deleted_at = now() where id = $1', [sesiones.C1.caso.id]));
  const r = await indicadores('2026-10-12', '2026-10-19');
  assert.equal(r.casos_actuales, 3);
  assert.equal(r.casos_concluidos, 0);
  assert.equal(r.pagos_recibidos, '200.50');
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update casos set deleted_at = null where id = $1', [sesiones.C1.caso.id]));
});

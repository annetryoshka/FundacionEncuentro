// Base PostgreSQL desechable para las pruebas de base de datos del Sprint 2.
// Cada archivo de prueba crea su propia base con todas las migraciones y la borra al final.
// Se activa con:
//   FE_PG_QA=1
//   FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:<puerto>/postgres
// Solo acepta localhost: nunca se conecta a Supabase.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

const habilitada = process.env.FE_PG_QA === '1' && Boolean(process.env.FE_PG_ADMIN_URL);
export const opciones = {
  skip: habilitada ? false : 'Requiere PostgreSQL local: FE_PG_QA=1 y FE_PG_ADMIN_URL',
  timeout: 30_000,
};

export const PERFILES = {
  admin: '00000000-0000-4000-8000-000000000001',
  t1: '00000000-0000-4000-8000-000000000002',
  t2: '00000000-0000-4000-8000-000000000003',
  marketing: '00000000-0000-4000-8000-000000000004',
};

/** Crea la base, aplica las migraciones y los perfiles. Devuelve { cliente, conectar, cerrar }. */
export async function crearBase(prefijo) {
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Solo se admite PostgreSQL local');
  const nombre = `${prefijo}_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`create database "${nombre}"`);
  url.pathname = `/${nombre}`;

  const conectar = async () => {
    const c = new pg.Client({ connectionString: url.toString(), statement_timeout: 10_000 });
    await c.connect();
    return c;
  };
  const cliente = await conectar();
  // auth.users es solo el soporte de la FK de perfiles; no es Supabase Auth.
  await cliente.query('create schema auth; create table auth.users (id uuid primary key); create schema extensions');
  const carpeta = new URL('../../../db/migrations/', import.meta.url);
  const archivos = (await readdir(carpeta)).filter((a) => /^\d+.*\.sql$/.test(a)).sort();
  for (const archivo of archivos) await cliente.query(await readFile(new URL(archivo, carpeta), 'utf8'));
  for (const [clave, id] of Object.entries(PERFILES)) {
    const rol = clave === 'admin' ? 'administrador' : clave === 'marketing' ? 'marketing' : 'terapeuta';
    await cliente.query('insert into auth.users (id) values ($1)', [id]);
    await cliente.query('insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)', [id, `${clave} QA`, rol]);
  }

  const cerrar = async () => {
    await cliente.end();
    await admin.query(`drop database "${nombre}" with (force)`);
    await admin.end();
  };
  return { cliente, conectar, cerrar };
}

/** Ejecuta fn dentro de una transacción con app.usuario_id, como hace el backend. */
export async function comoUsuario(cliente, usuarioId, fn) {
  await cliente.query('begin');
  try {
    await cliente.query(`select set_config('app.usuario_id', $1, true)`, [usuarioId]);
    const resultado = await fn();
    await cliente.query('commit');
    return resultado;
  } catch (error) {
    await cliente.query('rollback');
    throw error;
  }
}

/** Crea paciente + caso (número del trigger) y, si se indica, la terapeuta asignada. */
export async function crearCaso(cliente, { nombre = 'Paciente QA', tipo = 'voluntario', estado = 'iniciado',
  clasificacion = null, terapeuta = null, fechaIngreso = '2026-10-01' } = {}) {
  return comoUsuario(cliente, PERFILES.admin, async () => {
    const p = await cliente.query('insert into pacientes (nombre_completo) values ($1) returning id', [nombre]);
    const c = await cliente.query(
      `insert into casos (paciente_id, tipo, estado, clasificacion, fecha_ingreso)
       values ($1, $2, $3, $4, $5) returning id, tipo, numero_correlativo`,
      [p.rows[0].id, tipo, estado, clasificacion, fechaIngreso],
    );
    if (terapeuta) {
      await cliente.query('insert into asignaciones_caso (caso_id, perfil_id) values ($1, $2)', [c.rows[0].id, terapeuta]);
    }
    return { ...c.rows[0], pacienteId: p.rows[0].id };
  });
}

/** Registra una sesión. Sin nro, el número lo pone el trigger. */
export async function crearSesion(cliente, casoId, { fecha = '2026-10-12', evolucion = 'Evolución QA',
  responsable = PERFILES.t1, nro = null } = {}) {
  return comoUsuario(cliente, responsable, async () => (await cliente.query(
    `insert into fichas_seguimiento (caso_id, nro_sesion, fecha, evolucion, responsable_id, creado_por)
     values ($1, $2, $3, $4, $5, $5) returning id, nro_sesion`,
    [casoId, nro, fecha, evolucion, responsable],
  )).rows[0]);
}

/** Espera que la promesa falle con el código de PostgreSQL indicado (23514 check, 23505 unique, 23503 FK, 23502 not null). */
export async function rechaza(promesa, codigo) {
  await assert.rejects(promesa, (error) => {
    assert.equal(error.code, codigo, error.message);
    return true;
  });
}

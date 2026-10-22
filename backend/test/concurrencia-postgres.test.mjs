import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { before, beforeEach, after, test } from 'node:test';
import pg from 'pg';
import { DatabaseService } from '../dist/database/database.service.js';
import { actor, datos, servidor } from './helpers/casos.mjs';

const habilitada = process.env.FE34_PG_QA === '1' && Boolean(process.env.FE34_PG_ADMIN_URL);
const opciones = { skip: habilitada ? false : 'Sin PostgreSQL QA opt-in; no demuestra concurrencia real', timeout: 25_000 };
const nombre = `fe34_run_${randomUUID().replaceAll('-', '')}`;
let admin, conexion, api, db, creada = false;
before(async () => {
  if (!habilitada) return;
  const url = new URL(process.env.FE34_PG_ADMIN_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/fe34_qa'
    && ['postgres:', 'postgresql:'].includes(url.protocol), 'Se exige PostgreSQL QA local en base fe34_qa');
  // No se conecta con DATABASE_URL ni se carga .env.
  admin = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000, statement_timeout: 10000 });
  try {
    await admin.connect();
    assert.equal((await admin.query('select current_database() as nombre')).rows[0].nombre, 'fe34_qa');
    await admin.query(`CREATE DATABASE "${nombre}"`); creada = true;
    url.pathname = `/${nombre}`; url.searchParams.set('application_name', 'fe34_app');
    conexion = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000, statement_timeout: 10000 });
    await conexion.connect();
    // auth.users es un soporte mínimo de FK, NO un Supabase Auth real.
    await conexion.query('create schema auth; create table auth.users (id uuid primary key); create schema extensions');
    const directorio = new URL('../../db/migrations/', import.meta.url);
    const archivos = (await readdir(directorio)).filter((archivo) => /^\d+.*\.sql$/.test(archivo)).sort();
    await conexion.query('BEGIN');
    try {
      for (const archivo of archivos) await conexion.query(await readFile(new URL(archivo, directorio), 'utf8'));
      await conexion.query('COMMIT');
    }
    catch (error) { await conexion.query('ROLLBACK'); throw error; }
    await conexion.query('insert into auth.users (id) values ($1)', [actor]);
    await conexion.query("insert into perfiles (id, nombre_completo, rol) values ($1, 'Admin QA', 'administrador')", [actor]);
    db = new DatabaseService({ getOrThrow: () => url.toString() });
    api = await servidor(db);
  } catch {
    // No imprimir connection strings ni errores del driver que puedan incluirlas.
    assert.fail('No se pudo preparar PostgreSQL QA: revisar servicio, versión y permisos; secretos omitidos');
  }
});
beforeEach(async () => {
  if (!habilitada) return;
  await conexion.query('truncate pacientes, casos, contexto_judicial, auditoria restart identity cascade');
  await conexion.query('update contadores_caso set ultimo_numero = 0');
});
after(async () => {
  if (!habilitada) return;
  try {
    if (api) await api.close(); else if (db) await db.onModuleDestroy();
  } finally {
    try { await conexion?.end(); }
    finally {
      try {
        if (creada) {
          assert.match(nombre, /^fe34_run_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
        }
      } finally { await admin?.end(); }
    }
  }
});
async function conteos() {
  return (await conexion.query(`select (select count(*)::int from pacientes) as pacientes,
    (select count(*)::int from casos) as casos, (select count(*)::int from contexto_judicial) as judicial`)).rows[0];
}

test('PG real: alta integral persiste y se recupera desde otra conexión', opciones, async () => {
  const res = await api.post(datos()); assert.equal(res.status, 201);
  const c = await res.json();
  const fila = (await conexion.query(`select p.nombre_completo, c.numero_correlativo from casos c
    join pacientes p on p.id = c.paciente_id where c.id = $1 and p.id = $2`, [c.id, c.paciente.id])).rows[0];
  assert.equal(fila.nombre_completo, datos().paciente.nombreCompleto);
  assert.equal(fila.numero_correlativo, 1);
  const detalle = await api.detalle(c.id); assert.equal(detalle.status, 200);
  const respuesta = await detalle.json();
  assert.equal(respuesta.id, c.id); assert.equal(respuesta.numero, c.numeroCorrelativo);
  assert.equal(respuesta.paciente.id, c.paciente.id); assert.equal(respuesta.terapeuta, null);
  assert.deepEqual(await conteos(), { pacientes: 1, casos: 1, judicial: 0 });
});

test('PG real: dos altas HTTP esperan un bloqueo observado y reciben correlativos únicos', opciones, async (t) => {
  const bloqueo = await db.pool.connect();
  let pendientes;
  try {
    await bloqueo.query('BEGIN');
    await bloqueo.query("update contadores_caso set ultimo_numero = ultimo_numero where tipo = 'voluntario'");
    // Convertir errores a valores evita rechazos no manejados mientras se observa el bloqueo.
    pendientes = Promise.all([api.post(datos('Paciente QA A')), api.post(datos('Paciente QA B'))]
      .map((p) => p.then(async (r) => ({ status: r.status, body: await r.json() }), () => ({ status: 0 }))));
    let bloqueadas = 0;
    const limite = Date.now() + 6000;
    while (Date.now() < limite && bloqueadas < 2) {
      bloqueadas = (await conexion.query(`select count(*)::int as n from pg_stat_activity
        where datname = current_database() and application_name = 'fe34_app'
          and state = 'active' and wait_event_type = 'Lock' and query ilike 'insert into casos%'`)).rows[0].n;
      if (bloqueadas < 2) await esperar(50);
    }
    assert.equal(bloqueadas, 2, 'Deben observarse dos conexiones SQL reales esperando bloqueo');
    t.diagnostic(`Conexiones PostgreSQL esperando Lock en INSERT de casos: ${bloqueadas}`);
  } finally {
    await bloqueo.query('ROLLBACK'); bloqueo.release();
    if (pendientes) await pendientes;
  }
  const resultados = await pendientes;
  assert.ok(resultados.every((r) => r.status === 201));
  assert.equal(new Set(resultados.map((r) => r.body.numeroCorrelativo)).size, 2);
  assert.equal(new Set(resultados.map((r) => r.body.paciente.id)).size, 2);
  for (const { body } of resultados) {
    const fila = (await conexion.query('select paciente_id from casos where id = $1', [body.id])).rows[0];
    assert.equal(fila.paciente_id, body.paciente.id);
  }
});

test('PG real: cuatro altas simultáneas conservan dos series independientes', opciones, async () => {
  const respuestas = await Promise.all(['voluntario', 'derivado', 'voluntario', 'derivado']
    .map((tipo, i) => api.post(datos(`Paciente QA mixto ${i}`, tipo))));
  assert.ok(respuestas.every((r) => r.status === 201));
  const resultados = await Promise.all(respuestas.map((r) => r.json()));
  for (const tipo of ['derivado', 'voluntario']) {
    assert.equal(new Set(resultados.filter((c) => c.tipo === tipo).map((c) => c.numeroCorrelativo)).size, 2);
  }
  assert.equal(new Set(resultados.map((c) => `${c.tipo}:${c.numeroCorrelativo}`)).size, 4);
  assert.deepEqual(await conteos(), { pacientes: 4, casos: 4, judicial: 0 });
});

test('PG real: fallo tardío concurrente revierte todos sus cambios y conserva el alta exitosa', opciones, async () => {
  await conexion.query("alter table contexto_judicial add constraint qa_fallo check (juzgado is distinct from 'FALLO_QA')");
  try {
    const fallo = { ...datos('Paciente QA revertido', 'derivado'), contextoJudicial: { juzgado: 'FALLO_QA' } };
    const respuestas = await Promise.all([api.post(fallo), api.post(datos('Paciente QA válido', 'derivado'))]);
    assert.deepEqual(respuestas.map((r) => r.status), [500, 201]);
    const c = await respuestas[1].json();
    assert.deepEqual(await conteos(), { pacientes: 1, casos: 1, judicial: 0 });
    assert.equal((await conexion.query("select ultimo_numero from contadores_caso where tipo = 'derivado'")).rows[0].ultimo_numero, c.numeroCorrelativo);
    const siguiente = await api.post(datos('Paciente QA siguiente', 'derivado'));
    assert.equal(siguiente.status, 201); assert.ok((await siguiente.json()).numeroCorrelativo > c.numeroCorrelativo);
  } finally { await conexion.query('alter table contexto_judicial drop constraint qa_fallo'); }
});

test('PG real: índice único rechaza número duplicado y el contador se revierte', opciones, async () => {
  const res = await api.post(datos()); assert.equal(res.status, 201);
  const c = await res.json();
  await assert.rejects(conexion.query(`insert into casos (paciente_id, tipo, numero_correlativo)
    values ($1, 'voluntario', 1)`, [c.paciente.id]), (error) => error.code === '23505');
  assert.deepEqual(await conteos(), { pacientes: 1, casos: 1, judicial: 0 });
  assert.equal((await conexion.query("select ultimo_numero from contadores_caso where tipo = 'voluntario'")).rows[0].ultimo_numero, 1);
});

test('PG real: posible duplicado se registra y devuelve advertencia por similarity', opciones, async () => {
  const primera = await api.post(datos()); assert.equal(primera.status, 201);
  const anterior = await primera.json();
  const res = await api.post(datos()); assert.equal(res.status, 201);
  const nueva = await res.json();
  assert.equal(nueva.posiblesDuplicados.length, 1);
  assert.notEqual(nueva.id, anterior.id); assert.notEqual(nueva.numeroCorrelativo, anterior.numeroCorrelativo);
  assert.deepEqual(await conteos(), { pacientes: 2, casos: 2, judicial: 0 });
});

test('PG real FE-33: número manual concurrente genera un 201 y un 409, sin paciente huérfano', opciones, async () => {
  const solicitudes = ['Paciente QA manual A', 'Paciente QA manual B'].map((nombre) => {
    const body = datos(nombre); body.caso.numeroCorrelativo = 42; return body;
  });
  const respuestas = await Promise.all(solicitudes.map((body) => api.post(body)));
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409]);
  assert.deepEqual(await conteos(), { pacientes: 1, casos: 1, judicial: 0 });
  const siguiente = await api.post(datos('Paciente QA posterior al manual'));
  assert.equal(siguiente.status, 201); assert.ok((await siguiente.json()).numeroCorrelativo > 42);
});

test('PG real FE-33: paciente existente conserva su vínculo en una carpeta nueva', opciones, async () => {
  const primera = await api.post(datos()); const anterior = await primera.json();
  const segunda = await api.post({ pacienteId: anterior.paciente.id, caso: { tipo: 'derivado' } });
  assert.equal(segunda.status, 201);
  const nueva = await segunda.json(); assert.equal(nueva.paciente.id, anterior.paciente.id);
  assert.notEqual(nueva.id, anterior.id);
  assert.deepEqual(await conteos(), { pacientes: 1, casos: 2, judicial: 0 });
});

test('PG real: error SQL al preparar la respuesta revierte también el alta y su auditoría', opciones, async () => {
  // Debe existir otro paciente: sin él PostgreSQL no evalúa similarity en ninguna fila.
  assert.equal((await api.post(datos('Paciente QA previo'))).status, 201);
  const inicial = await conteos();
  const auditorias = (await conexion.query('select count(*)::int as n from auditoria')).rows[0].n;
  const contador = (await conexion.query("select ultimo_numero from contadores_caso where tipo = 'voluntario'")).rows[0].ultimo_numero;
  // Solo en la base nueva de esta ejecución: falla la búsqueda posterior a los INSERT.
  await conexion.query('alter function extensions.similarity(text, text) rename to similarity_qa_original');
  try {
    await conexion.query(`create function extensions.similarity(text, text) returns real language plpgsql as $$
      begin raise exception 'Fallo de respuesta QA'; end; $$`);
    assert.equal((await api.post(datos())).status, 500);
    assert.deepEqual(await conteos(), inicial);
    assert.equal((await conexion.query('select count(*)::int as n from auditoria')).rows[0].n, auditorias);
    assert.equal((await conexion.query("select ultimo_numero from contadores_caso where tipo = 'voluntario'")).rows[0].ultimo_numero, contador);
  } finally {
    await conexion.query('drop function if exists extensions.similarity(text, text)');
    await conexion.query('alter function extensions.similarity_qa_original(text, text) rename to similarity');
  }
});

import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { before, beforeEach, after, test } from 'node:test';
import pg from 'pg';
import { DatabaseService } from '../dist/database/database.service.js';
import { actor, datos, servidor } from './helpers/casos.mjs';

const habilitada = process.env.FE40_PG_QA === '1' && Boolean(process.env.FE40_PG_ADMIN_URL);
const opciones = { skip: habilitada ? false : 'Requiere PostgreSQL QA local opt-in FE40_PG_QA y FE40_PG_ADMIN_URL', timeout: 25000 };
const nombre = `fe40_run_${randomUUID().replaceAll('-', '')}`;
const terapeutaA = '00000000-0000-4000-8000-000000000002';
const terapeutaB = '00000000-0000-4000-8000-000000000003';
const marketing = '00000000-0000-4000-8000-000000000004';
let admin, conexion, api, db, creada = false;
let carpetas;

before(async () => {
  if (!habilitada) return;
  const url = new URL(process.env.FE40_PG_ADMIN_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/fe40_qa'
    && ['postgres:', 'postgresql:'].includes(url.protocol), 'Se exige PostgreSQL QA local en base fe40_qa');
  admin = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000, statement_timeout: 10000 });
  try {
    await admin.connect();
    assert.equal((await admin.query('select current_database() as nombre')).rows[0].nombre, 'fe40_qa');
    await admin.query(`CREATE DATABASE "${nombre}"`); creada = true;
    url.pathname = `/${nombre}`;
    conexion = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000, statement_timeout: 10000 });
    await conexion.connect();
    await conexion.query('create schema auth; create table auth.users (id uuid primary key); create schema extensions');
    const directorio = new URL('../../db/migrations/', import.meta.url);
    const archivos = (await readdir(directorio)).filter((archivo) => /^\d+.*\.sql$/.test(archivo)).sort();
    await conexion.query('BEGIN');
    try {
      for (const archivo of archivos) await conexion.query(await readFile(new URL(archivo, directorio), 'utf8'));
      await conexion.query('COMMIT');
    } catch (error) { await conexion.query('ROLLBACK'); throw error; }
    for (const [id, rol, nombrePerfil] of [
      [actor, 'administrador', 'Admin QA'], [terapeutaA, 'terapeuta', 'Terapeuta A QA'],
      [terapeutaB, 'terapeuta', 'Terapeuta B QA'], [marketing, 'marketing', 'Marketing QA'],
    ]) {
      await conexion.query('insert into auth.users (id) values ($1)', [id]);
      await conexion.query('insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)', [id, nombrePerfil, rol]);
    }
    db = new DatabaseService({ getOrThrow: () => url.toString() });
    api = await servidor(db, { fixture: actor, terapeutaA, terapeutaB, marketing });
  } catch {
    assert.fail('No se pudo preparar PostgreSQL QA: revisar servicio, migraciones y permisos; secretos omitidos');
  }
});

beforeEach(async () => {
  if (!habilitada) return;
  await conexion.query('truncate pacientes, casos, contexto_judicial, auditoria restart identity cascade');
  await conexion.query('update contadores_caso set ultimo_numero = 0');
  carpetas = [];
  for (const [nombrePaciente, tipo, numero, responsable, fecha] of [
    ['María Gutiérrez QA', 'voluntario', 12, terapeutaA, '2020-02-01'],
    ['José Pérez QA', 'derivado', 12, terapeutaB, '2020-02-01'],
    ['María Pérez QA', 'voluntario', 112, terapeutaB, '2020-02-01'],
    ['Ángela Sin Responsable QA', 'derivado', 13, null, '2020-01-01'],
    ['Carlos Asignado QA', 'voluntario', 14, terapeutaA, '2020-01-01'],
    ['Caso Borrado QA', 'voluntario', 15, terapeutaA, '2020-02-01'],
    ['Paciente Borrado QA', 'derivado', 16, terapeutaB, '2020-02-01'],
  ]) {
    const body = datos(nombrePaciente, tipo);
    Object.assign(body.caso, { numeroCorrelativo: numero, fechaIngreso: fecha, comentariosClinicos: 'NO EXPONER QA' });
    const res = await api.post(body); assert.equal(res.status, 201);
    const carpeta = await res.json(); carpetas.push(carpeta);
    if (responsable) await conexion.query('insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)', [carpeta.id, responsable, actor]);
  }
  await conexion.query('update casos set deleted_at = now() where id = $1', [carpetas[5].id]);
  await conexion.query('update pacientes set deleted_at = now() where id = $1', [carpetas[6].paciente.id]);
});

after(async () => {
  if (!habilitada) return;
  try { if (api) await api.close(); else if (db) await db.onModuleDestroy(); }
  finally {
    try { await conexion?.end(); }
    finally {
      try {
        if (creada) {
          assert.match(nombre, /^fe40_run_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
        }
      } finally { await admin?.end(); }
    }
  }
});

async function listado(consulta = {}, token = 'fixture') {
  const res = await api.listar(consulta, { token });
  assert.equal(res.status, 200);
  return res.json();
}

test('FE-40 PG: admin ve vigentes, sin responsable y solo campos de resumen', opciones, async () => {
  const pagina = await listado();
  assert.deepEqual([pagina.total, pagina.pagina, pagina.tamano, pagina.carpetas.length], [5, 1, 10, 5]);
  assert.deepEqual(new Set(pagina.carpetas.map((c) => c.id)), new Set(carpetas.slice(0, 5).map((c) => c.id)));
  for (const c of pagina.carpetas) {
    assert.deepEqual(Object.keys(c).sort(), ['id', 'numero', 'tipo', 'estado', 'fechaIngreso', 'paciente', 'terapeuta'].sort());
    assert.deepEqual(Object.keys(c.paciente).sort(), ['id', 'nombreCompleto']);
    assert.match(c.fechaIngreso, /^\d{4}-\d{2}-\d{2}$/);
    const original = carpetas.find((fila) => fila.id === c.id);
    assert.equal(c.paciente.id, original.paciente.id);
    assert.equal(c.numero, original.numeroCorrelativo);
  }
  assert.equal(pagina.carpetas.find((c) => c.id === carpetas[3].id).terapeuta, null);
  assert.deepEqual(pagina.carpetas.find((c) => c.id === carpetas[0].id).terapeuta, { id: terapeutaA, nombreCompleto: 'Terapeuta A QA' });
});

test('FE-40 PG: dos terapeutas filtran antes de paginar y total no revela carpetas ajenas', opciones, async () => {
  for (const [token, indices] of [['terapeutaA', [0, 4]], ['terapeutaB', [1, 2]]]) {
    const primera = await listado({ tamano: 1 }, token);
    const segunda = await listado({ tamano: 1, pagina: 2 }, token);
    assert.equal(primera.total, 2); assert.equal(segunda.total, 2);
    assert.deepEqual(new Set([...primera.carpetas, ...segunda.carpetas].map((c) => c.id)), new Set(indices.map((i) => carpetas[i].id)));
    const vacia = await listado({ pagina: 3, tamano: 1 }, token);
    assert.equal(vacia.total, 2); assert.deepEqual(vacia.carpetas, []);
  }
});

test('FE-40 PG: reasignar retira acceso al responsable anterior inmediatamente', opciones, async () => {
  await conexion.query('update asignaciones_caso set perfil_id = $1 where caso_id = $2', [terapeutaB, carpetas[0].id]);
  assert.equal((await listado({ busqueda: 'gutierrez' }, 'terapeutaA')).total, 0);
  assert.equal((await listado({ busqueda: 'gutierrez' }, 'terapeutaB')).total, 1);
});

test('FE-40 PG: nombre sin tildes, mayúsculas y palabras en diferente orden', opciones, async () => {
  for (const busqueda of ['maria gutierrez', 'MARÍA GUTIÉRREZ', 'GUTIERREZ   maria']) {
    const pagina = await listado({ busqueda });
    assert.equal(pagina.total, 1); assert.equal(pagina.carpetas[0].id, carpetas[0].id);
  }
  assert.equal((await listado({ busqueda: 'perez' })).total, 2);
  assert.equal((await listado({ busqueda: 'perez' }, 'terapeutaA')).total, 0);
});

test('FE-40 PG: número exacto devuelve ambos tipos y nunca coincidencias parciales', opciones, async () => {
  for (const busqueda of ['12', ' 00012 ']) {
    const pagina = await listado({ busqueda });
    assert.equal(pagina.total, 2);
    assert.deepEqual(new Set(pagina.carpetas.map((c) => c.tipo)), new Set(['voluntario', 'derivado']));
    assert.ok(pagina.carpetas.every((c) => c.numero === 12));
  }
  assert.equal((await listado({ busqueda: '12' }, 'terapeutaA')).total, 1);
  for (const busqueda of ['0', '2147483648', '999999999999999999999999999999999999']) {
    const pagina = await listado({ busqueda }); assert.equal(pagina.total, 0); assert.deepEqual(pagina.carpetas, []);
  }
});

test('FE-40 PG: búsqueda vacía y espacios listan solo autorizadas; sin coincidencias es vacío', opciones, async () => {
  assert.deepEqual(await listado({ busqueda: '   ' }, 'terapeutaA'), await listado({}, 'terapeutaA'));
  assert.deepEqual(await listado({ busqueda: 'NoExisteQA' }), { carpetas: [], total: 0, pagina: 1, tamano: 10 });
  assert.equal((await listado({ busqueda: 'borrado' })).total, 0);
});

test('FE-40 PG: orden determinista y paginación sin repetidos incluso con empates', opciones, async () => {
  const todo = await listado();
  const esperadas = [...carpetas.slice(0, 5)].sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso)
    || b.numeroCorrelativo - a.numeroCorrelativo || a.id.localeCompare(b.id)).map((c) => c.id);
  assert.deepEqual(todo.carpetas.map((c) => c.id), esperadas);
  const ids = [];
  for (let pagina = 1; pagina <= 3; pagina++) {
    const respuesta = await listado({ pagina, tamano: 2 }); assert.equal(respuesta.total, 5);
    ids.push(...respuesta.carpetas.map((c) => c.id));
  }
  assert.deepEqual(ids, esperadas);
  assert.deepEqual((await listado()).carpetas.map((c) => c.id), esperadas);
  assert.deepEqual((await listado({ pagina: 2147483647, tamano: 100 })).carpetas, []);
});

test('FE-40 PG: sin asignaciones devuelve total cero para terapeuta', opciones, async () => {
  await conexion.query('delete from asignaciones_caso where perfil_id = $1', [terapeutaA]);
  assert.deepEqual(await listado({}, 'terapeutaA'), { carpetas: [], total: 0, pagina: 1, tamano: 10 });
});

test('FE-40 PG: SQL parametrizado trata comodines e intentos de inyección como texto', opciones, async () => {
  for (const busqueda of ['%', '_', "' OR true --"]) {
    assert.equal((await listado({ busqueda })).total, 0);
  }
  assert.equal((await listado()).total, 5);
});

test('FE-40 PG: guard rechaza marketing con 403 y falta de sesión o token inválido con 401', opciones, async () => {
  for (const [token, estado] of [['marketing', 403], [null, 401], ['invalido', 401]]) {
    assert.equal((await api.listar({}, { token })).status, estado);
  }
});

test('FE-40 PG: no se permite elegir rol o perfil mediante parámetros', opciones, async () => {
  for (const consulta of [{ rol: 'administrador' }, { perfilId: actor }, { usuarioId: actor }]) {
    assert.equal((await api.listar(consulta, { token: 'terapeutaA' })).status, 400);
  }
});

test('FE-40 PG: paginación y búsqueda inválidas producen 400 sin llegar a errores SQL', opciones, async () => {
  for (const campo of ['pagina', 'tamano']) {
    for (const valor of ['', '0', '-1', '1.5', 'NaN', 'Infinity', 'abc', '999999999999999999999999']) {
      const res = await api.listar({ [campo]: valor }); assert.equal(res.status, 400, `${campo}=${valor}`);
    }
  }
  for (const consulta of [{ pagina: '2147483648' }, { tamano: '101' }, { busqueda: 'a'.repeat(151) }]) {
    assert.equal((await api.listar(consulta)).status, 400);
  }
  for (const consulta of ['pagina=1&pagina=2', 'tamano=1&tamano=2', 'busqueda=a&busqueda=b']) {
    assert.equal((await api.listar(new URLSearchParams(consulta))).status, 400);
  }
});

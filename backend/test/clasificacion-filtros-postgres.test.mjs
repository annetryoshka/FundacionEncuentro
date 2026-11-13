// FE-49 · Verificación de clasificación, estado y filtros (historia FE-14, implementación FE-48).
// Datos A–D y resultados esperados tomados de docs/srs/sprint-2/FE-59-clasificacion-y-filtros.md.
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
const nombre = `fe49_run_${randomUUID().replaceAll('-', '')}`;
const terapeutaA = '00000000-0000-4000-8000-000000000002';
const terapeutaB = '00000000-0000-4000-8000-000000000003';
const marketing = '00000000-0000-4000-8000-000000000004';
let admin, conexion, api, db, creada = false;
/** @type {Record<'A'|'B'|'C'|'D', any>} */
let c;

before(async () => {
  if (!habilitada) return;
  const url = new URL(process.env.FE40_PG_ADMIN_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/fe40_qa'
    && ['postgres:', 'postgresql:'].includes(url.protocol), 'Se exige PostgreSQL QA local en base fe40_qa');
  admin = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000, statement_timeout: 10000 });
  try {
    await admin.connect();
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
      [actor, 'administrador', 'Admin QA'], [terapeutaA, 'terapeuta', 'T1 QA'],
      [terapeutaB, 'terapeuta', 'T2 QA'], [marketing, 'marketing', 'Marketing QA'],
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
  c = {};
  for (const [clave, paciente, tipo, numero, clasificacion, estado, responsable, fecha] of [
    ['A', 'Ana Ficticia QA', 'voluntario', 101, 'social', 'iniciado', terapeutaA, '2024-01-10'],
    ['B', 'Beto Ficticio QA', 'derivado', 101, 'privado', 'en_proceso', terapeutaB, '2024-01-10'],
    ['C', 'Carla Ficticia QA', 'voluntario', 102, null, 'concluido', null, '2024-01-10'],
    ['D', 'Dario Ficticio QA', 'voluntario', 103, 'social', 'iniciado', terapeutaA, '2024-03-01'],
  ]) {
    const body = datos(paciente, tipo);
    Object.assign(body.caso, { numeroCorrelativo: numero, fechaIngreso: fecha, estado });
    const res = await api.post(body); assert.equal(res.status, 201);
    c[clave] = await res.json();
    if (clasificacion) await conexion.query('update casos set clasificacion = $1 where id = $2', [clasificacion, c[clave].id]);
    if (responsable) await conexion.query('insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)', [c[clave].id, responsable, actor]);
  }
  await conexion.query('truncate auditoria restart identity');
});

after(async () => {
  if (!habilitada) return;
  try { if (api) await api.close(); else if (db) await db.onModuleDestroy(); }
  finally {
    try { await conexion?.end(); }
    finally {
      try {
        if (creada) {
          assert.match(nombre, /^fe49_run_[a-f0-9]{32}$/);
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
const ids = (pagina) => pagina.carpetas.map((carpeta) => carpeta.id);
const clasificar = (id, cuerpo, token = 'fixture') => api.solicitar(`/carpetas/${id}/clasificacion`, { metodo: 'PATCH', cuerpo, token });
const cambiarEstado = (id, cuerpo, token = 'fixture') => api.solicitar(`/casos/${id}/estado`, { metodo: 'PATCH', cuerpo, token });
const detalle = async (id) => { const res = await api.detalle(id); assert.equal(res.status, 200); return res.json(); };
const fila = async (id) => (await conexion.query('select clasificacion, estado, tipo, numero_correlativo, paciente_id from casos where id = $1', [id])).rows[0];
const auditoriaCasos = async (id) => (await conexion.query(
  `select usuario_id, datos_anteriores ->> 'clasificacion' as clasif_antes, datos_nuevos ->> 'clasificacion' as clasif_despues,
          datos_anteriores ->> 'estado' as estado_antes, datos_nuevos ->> 'estado' as estado_despues, creado_en
     from auditoria where tabla = 'casos' and registro_id = $1 and accion = 'UPDATE' order by id`, [id])).rows;

// --- Listado y filtros (tabla de ejemplos de FE-59) ---

test('FE-49 PG: administración busca 101 sin filtros y obtiene A y B, cada uno con su origen', opciones, async () => {
  const pagina = await listado({ busqueda: '101' });
  assert.equal(pagina.total, 2);
  assert.deepEqual(new Set(ids(pagina)), new Set([c.A.id, c.B.id]));
  assert.deepEqual(new Set(pagina.carpetas.map((x) => x.tipo)), new Set(['voluntario', 'derivado']));
});

test('FE-49 PG: T1 busca 101 y solo ve A; el total excluye B', opciones, async () => {
  const pagina = await listado({ busqueda: '101' }, 'terapeutaA');
  assert.equal(pagina.total, 1);
  assert.deepEqual(ids(pagina), [c.A.id]);
});

test('FE-49 PG: Social + Iniciado con tamaño 1 devuelve D en página 1 y A en página 2, total 2', opciones, async () => {
  const p1 = await listado({ clasificacion: 'social', estado: 'iniciado', tamano: 1 });
  const p2 = await listado({ clasificacion: 'social', estado: 'iniciado', tamano: 1, pagina: 2 });
  assert.deepEqual([p1.total, p2.total], [2, 2]);
  assert.deepEqual(ids(p1), [c.D.id]);
  assert.deepEqual(ids(p2), [c.A.id]);
  assert.deepEqual((await listado({ clasificacion: 'social', estado: 'iniciado', tamano: 1, pagina: 3 })).carpetas, []);
});

test('FE-49 PG: T1 filtra Privado + En proceso y obtiene lista vacía con total 0; T2 sí ve B', opciones, async () => {
  assert.deepEqual(await listado({ clasificacion: 'privado', estado: 'en_proceso' }, 'terapeutaA'),
    { carpetas: [], total: 0, pagina: 1, tamano: 10 });
  const t2 = await listado({ clasificacion: 'privado', estado: 'en_proceso' }, 'terapeutaB');
  assert.deepEqual(ids(t2), [c.B.id]);
});

test('FE-49 PG: «Todos» (sin parámetro) incluye carpetas sin clasificar; un filtro de clasificación las excluye', opciones, async () => {
  const todas = await listado();
  assert.equal(todas.total, 4);
  assert.equal(todas.carpetas.find((x) => x.id === c.C.id).clasificacion, null);
  for (const x of todas.carpetas) assert.ok(Object.hasOwn(x, 'clasificacion'), 'cada fila expone clasificacion');
  assert.deepEqual(new Set(ids(await listado({ clasificacion: 'social' }))), new Set([c.A.id, c.D.id]));
  assert.deepEqual(ids(await listado({ clasificacion: 'privado' })), [c.B.id]);
  assert.deepEqual(ids(await listado({ estado: 'concluido' })), [c.C.id]);
});

test('FE-49 PG: búsqueda y filtros se aplican juntos sobre los casos autorizados', opciones, async () => {
  assert.deepEqual(ids(await listado({ busqueda: '101', clasificacion: 'privado' })), [c.B.id]);
  assert.deepEqual(ids(await listado({ busqueda: '101', estado: 'iniciado' })), [c.A.id]);
  assert.equal((await listado({ busqueda: '101', clasificacion: 'privado' }, 'terapeutaA')).total, 0);
  assert.deepEqual(ids(await listado({ busqueda: 'ficticia', estado: 'concluido' })), [c.C.id]);
});

test('FE-49 PG: filtros con valores fuera del catálogo responden 400', opciones, async () => {
  for (const consulta of [{ clasificacion: 'judicial' }, { clasificacion: '' }, { estado: 'en_conclusion' }, { estado: 'INICIADO' }]) {
    const res = await api.listar(consulta);
    assert.equal(res.status, 400, `consulta ${JSON.stringify(consulta)}`);
  }
});

// --- Escrituras ---

test('FE-49 PG: administración cambia solo la clasificación de A y al recargar se conserva el resto', opciones, async () => {
  const antes = await detalle(c.A.id);
  const res = await clasificar(c.A.id, { clasificacion: 'privado' });
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.id, c.A.id); assert.equal(cuerpo.clasificacion, 'privado'); assert.equal(cuerpo.actualizadoPor, actor);
  assert.ok(cuerpo.actualizadoEn);
  const despues = await detalle(c.A.id);
  assert.equal(despues.clasificacion, 'privado');
  for (const campo of ['id', 'numero', 'tipo', 'estado', 'fechaIngreso', 'paciente', 'terapeuta', 'creadoEn']) {
    assert.deepEqual(despues[campo], antes[campo], `se conserva ${campo}`);
  }
  assert.deepEqual(despues.actualizadoPor, { id: actor, nombreCompleto: 'Admin QA' });
  const auditoria = await auditoriaCasos(c.A.id);
  assert.equal(auditoria.length, 1);
  assert.deepEqual([auditoria[0].usuario_id, auditoria[0].clasif_antes, auditoria[0].clasif_despues], [actor, 'social', 'privado']);
});

test('FE-49 PG: clasificar una carpeta sin clasificación y re-filtrar la incluye', opciones, async () => {
  assert.equal((await clasificar(c.C.id, { clasificacion: 'social' })).status, 200);
  assert.deepEqual(new Set(ids(await listado({ clasificacion: 'social' }))), new Set([c.A.id, c.C.id, c.D.id]));
});

test('FE-49 PG: la terapeuta asignada cambia estado; los guardados de estado y clasificación son independientes', opciones, async () => {
  const res = await cambiarEstado(c.A.id, { estado: 'en_proceso' }, 'terapeutaA');
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.deepEqual([cuerpo.id, cuerpo.estado, cuerpo.actualizadoPor], [c.A.id, 'en_proceso', terapeutaA]);
  const intermedia = await fila(c.A.id);
  assert.deepEqual([intermedia.clasificacion, intermedia.estado], ['social', 'en_proceso']);
  assert.equal((await clasificar(c.A.id, { clasificacion: 'privado' }, 'terapeutaA')).status, 200);
  const final = await fila(c.A.id);
  assert.deepEqual([final.clasificacion, final.estado, final.tipo, final.numero_correlativo], ['privado', 'en_proceso', 'voluntario', 101]);
  const auditoria = await auditoriaCasos(c.A.id);
  assert.equal(auditoria.length, 2);
  assert.ok(auditoria.every((a) => a.usuario_id === terapeutaA && a.creado_en));
  assert.deepEqual([auditoria[0].estado_antes, auditoria[0].estado_despues], ['iniciado', 'en_proceso']);
  assert.deepEqual([auditoria[1].clasif_antes, auditoria[1].clasif_despues], ['social', 'privado']);
});

test('FE-49 PG: valores inválidos responden 400 y conservan los datos previos', opciones, async () => {
  const original = await fila(c.A.id);
  for (const cuerpo of [{ clasificacion: 'judicial' }, { clasificacion: null }, { clasificacion: 'Social' }, {},
    { clasificacion: 'privado', estado: 'concluido' }, { clasificacion: 'privado', tipo: 'derivado' }]) {
    assert.equal((await clasificar(c.A.id, cuerpo)).status, 400, `clasificación ${JSON.stringify(cuerpo)}`);
  }
  for (const cuerpo of [{ estado: 'en_conclusion' }, { estado: null }, {}, { estado: 'concluido', clasificacion: 'privado' }]) {
    assert.equal((await cambiarEstado(c.A.id, cuerpo)).status, 400, `estado ${JSON.stringify(cuerpo)}`);
  }
  assert.equal((await clasificar('no-es-uuid', { clasificacion: 'privado' })).status, 400);
  assert.equal((await cambiarEstado('no-es-uuid', { estado: 'concluido' })).status, 400);
  assert.deepEqual(await fila(c.A.id), original);
  assert.deepEqual(await auditoriaCasos(c.A.id), []);
});

test('FE-49 PG: T1 no puede actualizar B (404) y marketing no puede clasificar A (403), sin escrituras', opciones, async () => {
  const [a, b] = [await fila(c.A.id), await fila(c.B.id)];
  assert.equal((await clasificar(c.B.id, { clasificacion: 'social' }, 'terapeutaA')).status, 404);
  assert.equal((await cambiarEstado(c.B.id, { estado: 'concluido' }, 'terapeutaA')).status, 404);
  assert.equal((await clasificar(c.C.id, { clasificacion: 'social' }, 'terapeutaA')).status, 404, 'carpeta sin asignación');
  assert.equal((await clasificar(c.A.id, { clasificacion: 'privado' }, 'marketing')).status, 403);
  assert.equal((await cambiarEstado(c.A.id, { estado: 'concluido' }, 'marketing')).status, 403);
  assert.equal((await clasificar(c.A.id, { clasificacion: 'privado' }, null)).status, 401);
  assert.equal((await cambiarEstado(c.A.id, { estado: 'concluido' }, 'token-falso')).status, 401);
  assert.deepEqual([await fila(c.A.id), await fila(c.B.id)], [a, b]);
  assert.equal((await conexion.query("select count(*)::int as n from auditoria where tabla = 'casos'")).rows[0].n, 0);
});

test('FE-49 PG: carpetas inexistentes o eliminadas responden 404 en ambas escrituras', opciones, async () => {
  const inexistente = randomUUID();
  assert.equal((await clasificar(inexistente, { clasificacion: 'social' })).status, 404);
  assert.equal((await cambiarEstado(inexistente, { estado: 'concluido' })).status, 404);
  await conexion.query('update casos set deleted_at = now() where id = $1', [c.D.id]);
  await conexion.query('update pacientes set deleted_at = now() where id = $1', [c.C.paciente.id]);
  for (const id of [c.D.id, c.C.id]) {
    assert.equal((await clasificar(id, { clasificacion: 'privado' })).status, 404);
    assert.equal((await cambiarEstado(id, { estado: 'iniciado' })).status, 404);
  }
});

test('FE-49 PG: reasignar retira a la terapeuta anterior el permiso de escritura', opciones, async () => {
  await conexion.query('update asignaciones_caso set perfil_id = $1 where caso_id = $2', [terapeutaB, c.A.id]);
  assert.equal((await clasificar(c.A.id, { clasificacion: 'privado' }, 'terapeutaA')).status, 404);
  assert.equal((await cambiarEstado(c.A.id, { estado: 'concluido' }, 'terapeutaB')).status, 200);
});

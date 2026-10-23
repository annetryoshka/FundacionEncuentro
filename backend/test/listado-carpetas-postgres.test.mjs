import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
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
const inactiva = '00000000-0000-4000-8000-000000000005';
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
      [inactiva, 'terapeuta', 'Terapeuta Inactiva QA'],
    ]) {
      await conexion.query('insert into auth.users (id) values ($1)', [id]);
      await conexion.query('insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)', [id, nombrePerfil, rol]);
    }
    await conexion.query('update perfiles set activo = false where id = $1', [inactiva]);
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
  assert.deepEqual(await listado({ busqueda: '' }, 'terapeutaA'), await listado({}, 'terapeutaA'));
  assert.deepEqual(await listado({ busqueda: '   ' }, 'terapeutaA'), await listado({}, 'terapeutaA'));
  assert.deepEqual(await listado({ busqueda: 'NoExisteQA' }), { carpetas: [], total: 0, pagina: 1, tamano: 10 });
  assert.equal((await listado({ busqueda: 'borrado' })).total, 0);
});

test('FE-41 PG: combinar búsqueda y paginación nunca expone filas o totales ajenos', opciones, async () => {
  for (const [token, indices] of [['terapeutaA', [0, 4]], ['terapeutaB', [1, 2]]]) {
    for (const [busqueda, esperados] of [
      ['QA', indices], ['12', indices.filter((i) => i < 2)],
      ['perez', indices.filter((i) => [1, 2].includes(i))],
    ]) {
      const ids = [];
      for (let pagina = 1; pagina <= esperados.length + 1; pagina++) {
        const respuesta = await listado({ busqueda, pagina, tamano: 1 }, token);
        assert.equal(respuesta.total, esperados.length);
        assert.equal(respuesta.pagina, pagina); assert.equal(respuesta.tamano, 1);
        assert.ok(respuesta.carpetas.every((c) => c.terapeuta.id === (token === 'terapeutaA' ? terapeutaA : terapeutaB)));
        ids.push(...respuesta.carpetas.map((c) => c.id));
      }
      assert.deepEqual(new Set(ids), new Set(esperados.map((i) => carpetas[i].id)));
      assert.equal(ids.length, esperados.length);
    }
  }
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

const asignar = (id, perfilId, token = 'fixture') => api.solicitar(`/carpetas/${id}/terapeuta`, {
  metodo: 'PUT', cuerpo: { perfilId }, token,
});
const detalleComo = (id, token) => api.solicitar(`/carpetas/${id}`, { token });
async function responsables(id) {
  return (await conexion.query('select perfil_id, asignado_por from asignaciones_caso where caso_id = $1', [id])).rows;
}
async function auditorias(id) {
  return (await conexion.query(`select usuario_id, accion, datos_anteriores, datos_nuevos from auditoria
    where tabla = 'asignaciones_caso' and coalesce(datos_nuevos, datos_anteriores)->>'caso_id' = $1
    order by creado_en, accion`, [id])).rows;
}

test('FE-38 PG: alta y transferencia HTTP actualizan detalle, listado y auditoría', opciones, async () => {
  const id = carpetas[3].id;
  assert.equal((await detalleComo(id, 'terapeutaA')).status, 404);
  assert.equal((await detalleComo(id, 'terapeutaB')).status, 404);
  for (const [nueva, token, anterior] of [[terapeutaA, 'terapeutaA', 'terapeutaB'], [terapeutaB, 'terapeutaB', 'terapeutaA']]) {
    const res = await asignar(id, nueva); assert.equal(res.status, 200);
    const respuesta = await res.json();
    assert.equal(respuesta.terapeuta.id, nueva); assert.equal(respuesta.asignadoPor.id, actor);
    assert.equal(respuesta.id, id); assert.ok(respuesta.asignadoEn);
    assert.equal((await detalleComo(id, token)).status, 200);
    assert.equal((await detalleComo(id, anterior)).status, 404);
    assert.equal((await detalleComo(id, 'fixture')).status, 200);
    assert.equal((await detalleComo(id, 'marketing')).status, 403);
    assert.equal((await listado({ busqueda: 'angela' }, token)).carpetas[0].id, id);
    assert.equal((await listado({ busqueda: 'angela' }, anterior)).total, 0);
    assert.deepEqual(await responsables(id), [{ perfil_id: nueva, asignado_por: actor }]);
  }
  const eventos = await auditorias(id);
  assert.equal(eventos.length, 3);
  assert.ok(eventos.every((e) => e.usuario_id === actor));
  assert.deepEqual(eventos.filter((e) => e.accion === 'INSERT').map((e) => e.datos_nuevos.perfil_id).sort(), [terapeutaA, terapeutaB]);
  assert.equal(eventos.find((e) => e.accion === 'DELETE').datos_anteriores.perfil_id, terapeutaA);
});

test('FE-38 PG: peticiones directas de terapeutas/marketing y sin sesión no alteran responsable', opciones, async () => {
  const id = carpetas[0].id;
  for (const [token, estado] of [['terapeutaA', 403], ['terapeutaB', 403], ['marketing', 403], [null, 401], ['invalido', 401]]) {
    for (const [ruta, metodo, cuerpo] of [
      [`/carpetas/${id}/terapeuta`, 'PUT', { perfilId: terapeutaB }],
      [`/casos/${id}/asignaciones`, 'POST', { perfilId: terapeutaB }],
      [`/casos/${id}/asignaciones`, 'GET', undefined],
      [`/casos/${id}/asignaciones/${terapeutaA}`, 'DELETE', undefined],
    ]) {
      assert.equal((await api.solicitar(ruta, { token, metodo, cuerpo })).status, estado);
    }
  }
  assert.equal((await responsables(id))[0].perfil_id, terapeutaA);
});

test('FE-38 PG: UUID/cuerpos inválidos se rechazan sin cambios persistidos', opciones, async () => {
  const id = carpetas[0].id;
  const previas = await auditorias(id);
  for (const cuerpo of [{}, { perfilId: '' }, { perfilId: 'invalido' }, { perfilId: null }, { perfilId: terapeutaB, rol: 'administrador' }]) {
    assert.equal((await api.solicitar(`/carpetas/${id}/terapeuta`, { metodo: 'PUT', cuerpo })).status, 400);
  }
  assert.equal((await asignar('id-invalido', terapeutaB)).status, 400);
  assert.equal((await asignar(randomUUID(), terapeutaB)).status, 404);
  assert.equal((await asignar(carpetas[5].id, terapeutaB)).status, 404);
  assert.equal((await responsables(id))[0].perfil_id, terapeutaA);
  assert.deepEqual(await auditorias(id), previas);
});

test('FE-38 PG: inexistente, inactiva y otros roles conservan la asignación anterior', opciones, async () => {
  const id = carpetas[0].id;
  for (const [perfil, estado, mensaje] of [
    [randomUUID(), 404, 'Usuario no encontrado'],
    [inactiva, 400, 'Solo se puede asignar a terapeutas activos'],
    [actor, 400, 'Solo se puede asignar a terapeutas activos'],
    [marketing, 400, 'Solo se puede asignar a terapeutas activos'],
  ]) {
    const res = await asignar(id, perfil); assert.equal(res.status, estado);
    assert.equal((await res.json()).message, mensaje);
    assert.equal((await responsables(id))[0].perfil_id, terapeutaA);
  }
});

test('FE-38 PG: repetir asignación devuelve 409 y no duplica responsable ni auditoría', opciones, async () => {
  const id = carpetas[3].id;
  assert.equal((await asignar(id, terapeutaA)).status, 200);
  const antes = await auditorias(id);
  const repetida = await asignar(id, terapeutaA); assert.equal(repetida.status, 409);
  assert.equal((await repetida.json()).message, 'Ese terapeuta ya está asignado al caso');
  assert.deepEqual(await responsables(id), [{ perfil_id: terapeutaA, asignado_por: actor }]);
  assert.deepEqual(await auditorias(id), antes);
});

test('FE-38 PG: fallo real de INSERT revierte DELETE y auditoría de la sustitución', opciones, async () => {
  const id = carpetas[0].id;
  const antes = await responsables(id); const eventos = await auditorias(id);
  await conexion.query(`alter table asignaciones_caso add constraint fe38_fallo
    check (perfil_id <> '${terapeutaB}'::uuid) not valid`);
  try {
    assert.equal((await asignar(id, terapeutaB)).status, 500);
    assert.deepEqual(await responsables(id), antes);
    assert.deepEqual(await auditorias(id), eventos);
    assert.equal((await detalleComo(id, 'terapeutaA')).status, 200);
    assert.equal((await detalleComo(id, 'terapeutaB')).status, 404);
  } finally { await conexion.query('alter table asignaciones_caso drop constraint fe38_fallo'); }
});

test('FE-38 PG: rutas relacionadas permiten a admin listar, asignar y quitar', opciones, async () => {
  const id = carpetas[3].id;
  const ruta = `/casos/${id}/asignaciones`;
  const res = await api.solicitar(ruta, { metodo: 'POST', cuerpo: { perfilId: terapeutaA } });
  assert.equal(res.status, 201); assert.equal((await res.json())[0].perfilId, terapeutaA);
  const lista = await api.solicitar(ruta); assert.equal(lista.status, 200);
  assert.equal((await lista.json())[0].perfilId, terapeutaA);
  assert.equal((await api.solicitar(`${ruta}/${terapeutaA}`, { metodo: 'DELETE' })).status, 204);
  assert.deepEqual(await responsables(id), []);
  assert.equal((await detalleComo(id, 'terapeutaA')).status, 404);
});

test('FE-38 PG: dos asignaciones HTTP bloqueadas conservan una sola responsable', opciones, async (t) => {
  const id = carpetas[3].id;
  const bloqueo = await db.pool.connect(); let pendientes;
  try {
    await bloqueo.query('BEGIN');
    await bloqueo.query('select id from casos where id = $1 for update', [id]);
    pendientes = Promise.all([terapeutaA, terapeutaB].map((perfil) => asignar(id, perfil)
      .then(async (r) => ({ estado: r.status, cuerpo: await r.json() }), () => ({ estado: 0 }))));
    let bloqueadas = 0; const limite = Date.now() + 6000;
    while (Date.now() < limite && bloqueadas < 2) {
      bloqueadas = (await conexion.query(`select count(*)::int as n from pg_stat_activity
        where datname = current_database() and state = 'active' and wait_event_type = 'Lock'
        and query like '%from casos%for update%'`)).rows[0].n;
      if (bloqueadas < 2) await esperar(50);
    }
    assert.equal(bloqueadas, 2);
    t.diagnostic(`Conexiones PostgreSQL esperando Lock para asignación: ${bloqueadas}`);
  } finally {
    await bloqueo.query('ROLLBACK'); bloqueo.release();
    if (pendientes) await pendientes;
  }
  assert.ok((await pendientes).every((r) => r.estado === 200));
  const filas = await responsables(id); assert.equal(filas.length, 1);
  assert.ok([terapeutaA, terapeutaB].includes(filas[0].perfil_id));
  const autorizada = filas[0].perfil_id === terapeutaA ? 'terapeutaA' : 'terapeutaB';
  const ajena = autorizada === 'terapeutaA' ? 'terapeutaB' : 'terapeutaA';
  assert.equal((await detalleComo(id, autorizada)).status, 200);
  assert.equal((await detalleComo(id, ajena)).status, 404);
});

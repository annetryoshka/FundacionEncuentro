// FE-130: almacenamiento privado del genograma en PostgreSQL (migración 012).
// Base desechable local: FE_PG_QA=1 y FE_PG_ADMIN_URL (ver helpers/pg-qa.mjs).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { GenogramaAccesoService } from '../dist/modules/casos/genograma/genograma-acceso.service.js';
import { GenogramaAlmacenPostgres } from '../dist/modules/casos/genograma/genograma-almacen-postgres.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones, rechaza } from './helpers/pg-qa.mjs';

const PDF = Buffer.from('%PDF-1.7\nGenograma ficticio QA');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png QA')]);
const admin = { id: PERFILES.admin, nombreCompleto: 'admin QA', rol: 'administrador' };
const t1 = { id: PERFILES.t1, nombreCompleto: 't1 QA', rol: 'terapeuta' };
const t2 = { id: PERFILES.t2, nombreCompleto: 't2 QA', rol: 'terapeuta' };

let base, cliente, db, almacen, api, casoA, casoB, casoSin, genogramaPrevio;

before(async () => {
  if (opciones.skip) return;
  // Base con datos previos hasta la 011; la 012 se aplica encima.
  base = await crearBase('fe130', { hasta: '011' });
  cliente = base.cliente;
  casoA = await crearCaso(cliente, { nombre: 'Paciente QA A', terapeuta: PERFILES.t1 });
  casoB = await crearCaso(cliente, { nombre: 'Paciente QA B', terapeuta: PERFILES.t2 });
  casoSin = await crearCaso(cliente, { nombre: 'Paciente QA sin genograma', terapeuta: PERFILES.t1 });
  genogramaPrevio = (await cliente.query(
    `insert into genogramas (caso_id, datos) values ($1, '{"nota":"previo"}') returning *`, [casoB.id],
  )).rows[0];
  await base.migrar();

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await cliente.query('select current_database() as n')).rows[0].n}`;
  db = new DatabaseService({ getOrThrow: () => url.toString() });
  almacen = new GenogramaAlmacenPostgres(db, new GenogramaAccesoService(db));
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing });
});

after(async () => {
  await api?.close(); // también cierra el pool de db
  await base?.cerrar();
});

const vigente = async (casoId) => (await cliente.query(
  'select archivo_clave from genogramas where caso_id = $1', [casoId])).rows[0]?.archivo_clave ?? null;
const archivosDe = async (casoId) => (await cliente.query(
  'select clave, activado_en from genograma_archivos where caso_id = $1 order by creado_en', [casoId])).rows;

function cargar(casoId, token, nombre, tipo, contenido) {
  const body = new FormData();
  body.set('archivo', new Blob([contenido], { type: tipo }), nombre);
  return fetch(`${api.base}/api/carpetas/${casoId}/genograma`, {
    method: 'PUT', body, headers: { Authorization: `Bearer ${token}` },
  });
}
const pedir = (casoId, token, sufijo = '') => api.solicitar(`/carpetas/${casoId}/genograma${sufijo}`, { token });

test('la migración conserva genogramas existentes sin archivo', opciones, async () => {
  const fila = (await cliente.query('select * from genogramas where caso_id = $1', [casoB.id])).rows[0];
  assert.deepEqual(fila.datos, { nota: 'previo' });
  assert.equal(fila.id, genogramaPrevio.id);
  assert.equal(fila.archivo_clave, null);
  assert.equal(await almacen.buscarVigente(casoB.id), null);
});

test('API: carga, consulta y descarga con base real', opciones, async () => {
  assert.equal((await cargar(casoA.id, 'admin', 'genograma.pdf', 'application/pdf', PDF)).status, 204);

  const consulta = await pedir(casoA.id, 'admin');
  assert.equal(consulta.status, 200);
  const meta = await consulta.json();
  assert.deepEqual({ ...meta, actualizadoEn: undefined }, {
    nombre: 'genograma.pdf', tipo: 'application/pdf', tamanio: PDF.length, autorId: PERFILES.admin, actualizadoEn: undefined,
  });
  assert.ok(!Number.isNaN(Date.parse(meta.actualizadoEn)));

  const descarga = await pedir(casoA.id, 't1', '/archivo');
  assert.equal(descarga.status, 200);
  assert.equal(descarga.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), PDF);
});

test('API: el reemplazo conserva la versión anterior y registra la autoría', opciones, async () => {
  const anterior = await vigente(casoA.id);
  assert.equal((await cargar(casoA.id, 't1', 'genograma.png', 'image/png', PNG)).status, 204);

  const meta = await (await pedir(casoA.id, 't1')).json();
  assert.equal(meta.tipo, 'image/png');
  assert.equal(meta.autorId, PERFILES.t1);
  assert.notEqual(await vigente(casoA.id), anterior);
  const versiones = await archivosDe(casoA.id);
  assert.equal(versiones.length, 2);
  assert.ok(versiones.every((v) => v.activado_en));
  assert.deepEqual(await almacen.leer(anterior), PDF);
});

test('API: archivo inválido devuelve 415 y no guarda nada', opciones, async () => {
  const antes = await archivosDe(casoA.id);
  const clave = await vigente(casoA.id);
  const r = await cargar(casoA.id, 't1', 'falso.pdf', 'application/pdf', 'no es un PDF');
  assert.equal(r.status, 415);
  assert.equal(await vigente(casoA.id), clave);
  assert.equal((await archivosDe(casoA.id)).length, antes.length);
});

test('API: terapeuta no asignada y marketing no ven ni cargan', opciones, async () => {
  const antes = await archivosDe(casoA.id);
  assert.equal((await pedir(casoA.id, 't2')).status, 404);
  assert.equal((await pedir(casoA.id, 't2', '/archivo')).status, 404);
  assert.equal((await cargar(casoA.id, 't2', 'g.pdf', 'application/pdf', PDF)).status, 404);
  assert.equal((await pedir(casoA.id, 'mkt')).status, 403);
  assert.equal((await pedir(casoA.id, 'mkt', '/archivo')).status, 403);
  assert.equal((await cargar(casoA.id, 'mkt', 'g.pdf', 'application/pdf', PDF)).status, 403);
  assert.equal((await archivosDe(casoA.id)).length, antes.length);
});

test('API: caso sin genograma o inexistente devuelve 404', opciones, async () => {
  assert.equal((await pedir(casoSin.id, 't1')).status, 404);
  assert.equal((await pedir(casoSin.id, 't1', '/archivo')).status, 404);
  assert.equal((await pedir(randomUUID(), 'admin')).status, 404);
});

test('fallo al activar: el vigente anterior no cambia', opciones, async () => {
  const clave = await vigente(casoA.id);

  // Archivo guardado pero la persona perdió el acceso antes de activarlo.
  const huerfana = `${casoA.id}/${randomUUID()}`;
  await almacen.guardarNuevo(huerfana, PDF, 'application/pdf');
  await assert.rejects(almacen.activarVersion(casoA.id, t2, {
    clave: huerfana, nombre: 'g.pdf', tipo: 'application/pdf', tamanio: PDF.length,
  }), { status: 404 });
  assert.equal(await vigente(casoA.id), clave);

  // Datos de versión que no coinciden con lo guardado.
  await assert.rejects(almacen.activarVersion(casoA.id, t1, {
    clave: huerfana, nombre: 'g.pdf', tipo: 'image/png', tamanio: PDF.length,
  }));
  // Archivo de otro caso.
  await assert.rejects(almacen.activarVersion(casoSin.id, t1, {
    clave: huerfana, nombre: 'g.pdf', tipo: 'application/pdf', tamanio: PDF.length,
  }));
  assert.equal(await vigente(casoA.id), clave);
  assert.equal(await vigente(casoSin.id), null);

  const fila = (await cliente.query('select activado_en from genograma_archivos where clave = $1', [huerfana])).rows[0];
  assert.equal(fila.activado_en, null, 'queda como archivo descartable, sin activar');
});

test('SQL: un archivo no puede pertenecer ni apuntar a otro caso', opciones, async () => {
  await rechaza(cliente.query(
    `insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido) values ($1, $2, 'application/pdf', $3, $4)`,
    [`${casoB.id}/${randomUUID()}`, casoA.id, PDF.length, PDF]), '23514');

  const claveA = await vigente(casoA.id);
  await rechaza(comoUsuario(cliente, PERFILES.admin, () => cliente.query(
    'update genogramas set archivo_clave = $1 where caso_id = $2', [claveA, casoB.id])), '23503');
  await assert.rejects(almacen.guardarNuevo('no-es-clave', PDF, 'application/pdf'));
});

test('SQL: tamaño, tipo y activación coherentes', opciones, async () => {
  const insertar = (tipo, tamanio, contenido = PDF) => cliente.query(
    'insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido) values ($1, $2, $3, $4, $5)',
    [`${casoA.id}/${randomUUID()}`, casoA.id, tipo, tamanio, contenido]);
  await rechaza(insertar('application/pdf', PDF.length + 1), '23514');
  await rechaza(insertar('image/gif', PDF.length), '23514');
  await rechaza(insertar('application/pdf', 0, Buffer.alloc(0)), '23514');
  await rechaza(cliente.query(
    `insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido, activado_en)
     values ($1, $2, 'application/pdf', $3, $4, now())`,
    [`${casoA.id}/${randomUUID()}`, casoA.id, PDF.length, PDF]), '23514');
});

test('SQL: el contenido no cambia, no se reactiva y el vigente no se borra', opciones, async () => {
  const clave = await vigente(casoA.id);
  await rechaza(cliente.query(`update genograma_archivos set contenido = $2, tamanio = $3 where clave = $1`,
    [clave, PDF, PDF.length]), '23514');
  await rechaza(cliente.query(`update genograma_archivos set nombre = 'otro.png' where clave = $1`, [clave]), '23514');
  await rechaza(cliente.query('delete from genograma_archivos where clave = $1', [clave]), '23503');
});

test('SQL: huella sha256 y auditoría del cambio de vigente', opciones, async () => {
  const { rows } = await cliente.query(
    'select contenido, sha256 from genograma_archivos where clave = $1', [await vigente(casoA.id)]);
  assert.deepEqual(rows[0].sha256, createHash('sha256').update(rows[0].contenido).digest());

  const auditoria = await cliente.query(
    `select tabla, accion, usuario_id from auditoria where tabla in ('genogramas', 'genograma_archivos') order by id`);
  assert.ok(auditoria.rows.length >= 2);
  assert.ok(auditoria.rows.every((f) => f.tabla === 'genogramas'));
  assert.deepEqual(auditoria.rows.slice(0, 2).map((f) => [f.accion, f.usuario_id]),
    [['INSERT', PERFILES.admin], ['UPDATE', PERFILES.t1]]);
});

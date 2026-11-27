import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones } from './helpers/pg-qa.mjs';

const MAX = 5 * 1024 * 1024;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FIRMA_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const conRelleno = (firma, total) => Buffer.concat([firma, Buffer.alloc(total - firma.length, 0x41)]);
const PNG = conRelleno(FIRMA_PNG, 2048);
const JPEG = conRelleno(FIRMA_JPEG, 4096);
const PDF = Buffer.from('%PDF-1.7\nGenograma ficticio QA FE-133');
const sha = (b) => createHash('sha256').update(b).digest('hex');

let base, cliente, api, casoA, casoB, casoBorrado;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe133');
  cliente = base.cliente;
  casoA = await crearCaso(cliente, { nombre: 'Paciente QA genograma A', terapeuta: PERFILES.t1 });
  casoB = await crearCaso(cliente, { nombre: 'Paciente QA genograma B', terapeuta: PERFILES.t1 });
  casoBorrado = await crearCaso(cliente, { nombre: 'Paciente QA borrado', terapeuta: PERFILES.t1 });
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await cliente.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing });
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

function cargar(casoId, { token = 't1', nombre = 'genograma.png', tipo = 'image/png', contenido = PNG, campo = 'archivo' } = {}) {
  const body = new FormData();
  if (contenido !== null) body.set(campo, new Blob([contenido], { type: tipo }), nombre);
  return fetch(`${api.base}/api/carpetas/${casoId}/genograma`, {
    method: 'PUT', body, headers: { Authorization: `Bearer ${token}` },
  });
}
const pedir = (casoId, token = 't1', sufijo = '') =>
  api.solicitar(`/carpetas/${casoId}/genograma${sufijo}`, { token });
const archivos = async (casoId) => (await cliente.query(
  `select clave, tipo, tamanio, encode(sha256, 'hex') as sha, activado_en
     from genograma_archivos where caso_id = $1 order by creado_en`, [casoId])).rows;
const vigente = async (casoId) => (await cliente.query(
  'select archivo_clave from genogramas where caso_id = $1', [casoId])).rows[0]?.archivo_clave ?? null;

async function rechazaSinGuardar(casoId, opcionesCarga, estado, etiqueta = '') {
  const antes = await archivos(casoId);
  const claveAntes = await vigente(casoId);
  const r = await cargar(casoId, opcionesCarga);
  await r.arrayBuffer();
  assert.equal(r.status, estado, etiqueta);
  assert.deepEqual(await archivos(casoId), antes, `${etiqueta}: no debe quedar ningún archivo guardado`);
  assert.equal(await vigente(casoId), claveAntes, `${etiqueta}: el genograma vigente no cambia`);
}

test('G1 · integridad: PNG, JPEG y PDF se descargan idénticos y la huella sha256 coincide', opciones, async () => {
  for (const [contenido, tipo, nombre] of [[PNG, 'image/png', 'g.png'], [JPEG, 'image/jpeg', 'g.jpg'], [PDF, 'application/pdf', 'g.pdf']]) {
    const r = await cargar(casoA.id, { contenido, tipo, nombre });
    assert.equal(r.status, 204);
    const descarga = await pedir(casoA.id, 't1', '/archivo');
    assert.equal(descarga.status, 200);
    const bytes = Buffer.from(await descarga.arrayBuffer());
    assert.ok(bytes.equals(contenido), `${tipo}: el archivo descargado debe ser idéntico`);
    assert.equal(descarga.headers.get('content-type'), tipo);
    assert.equal(Number(descarga.headers.get('content-length')), contenido.length);
    const ultimo = (await archivos(casoA.id)).at(-1);
    assert.equal(ultimo.sha, sha(contenido), `${tipo}: la huella guardada coincide`);
  }
  assert.equal((await archivos(casoA.id)).length, 3, 'Cada reemplazo conserva la versión anterior');
});

test('G2 · confidencialidad de la respuesta: sin caché, nosniff, descarga como adjunto y sin bytes en metadatos', opciones, async () => {
  const meta = await pedir(casoA.id);
  const cuerpo = await meta.json();
  assert.equal(meta.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Object.keys(cuerpo).sort(), ['actualizadoEn', 'autorId', 'nombre', 'tamanio', 'tipo']);

  const archivo = await pedir(casoA.id, 't1', '/archivo');
  await archivo.arrayBuffer();
  assert.equal(archivo.headers.get('cache-control'), 'private, no-store');
  assert.equal(archivo.headers.get('x-content-type-options'), 'nosniff');
  assert.match(archivo.headers.get('content-disposition'), /^attachment; filename="[A-Za-z0-9._-]+"$/);
});

test('G3 · el nombre del archivo no permite inyectar cabeceras', opciones, async () => {
  const r = await cargar(casoA.id, { nombre: 'a"\r\nX-Inyectado: 1;ñ.png' });
  assert.equal(r.status, 204);
  const archivo = await pedir(casoA.id, 't1', '/archivo');
  await archivo.arrayBuffer();
  assert.equal(archivo.status, 200);
  assert.equal(archivo.headers.get('x-inyectado'), null);
  assert.match(archivo.headers.get('content-disposition'), /^attachment; filename="[A-Za-z0-9._-]+"$/);
});

test('G4 · límite de 5 MB: exactamente 5 MB se acepta; un byte más da 413 sin guardar', opciones, async () => {
  const justo = conRelleno(FIRMA_PNG, MAX);
  assert.equal((await cargar(casoB.id, { contenido: justo })).status, 204);
  const descarga = await pedir(casoB.id, 't1', '/archivo');
  assert.ok(Buffer.from(await descarga.arrayBuffer()).equals(justo));

  await rechazaSinGuardar(casoB.id, { contenido: conRelleno(FIRMA_PNG, MAX + 1) }, 413);
});

test('G5 · archivos disfrazados, vacíos o mal enviados se rechazan sin guardar', opciones, async () => {
  const casos = [
    ['PNG declarado como JPEG', { tipo: 'image/jpeg', nombre: 'g.jpg' }, 415],
    ['HTML con extensión .png', { contenido: Buffer.from('<html><script>alert(1)</script></html>') }, 415],
    ['SVG con script', { contenido: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'), tipo: 'image/svg+xml', nombre: 'g.svg' }, 415],
    ['GIF', { contenido: Buffer.from('GIF89a QA'), tipo: 'image/gif', nombre: 'g.gif' }, 415],
    ['archivo vacío', { contenido: Buffer.alloc(0) }, 400],
    ['sin archivo', { contenido: null }, 400],
    ['campo con otro nombre', { campo: 'foto' }, 400],
  ];
  for (const [nombre, carga, estado] of casos) {
    await rechazaSinGuardar(casoB.id, carga, estado, nombre);
  }
});

test('G6 · aislamiento: cada caso descarga solo su genograma', opciones, async () => {
  const a = Buffer.from(await (await pedir(casoA.id, 't1', '/archivo')).arrayBuffer());
  const b = Buffer.from(await (await pedir(casoB.id, 't1', '/archivo')).arrayBuffer());
  assert.notEqual(sha(a), sha(b));
  const clavesA = (await archivos(casoA.id)).map((f) => f.clave);
  assert.ok(clavesA.every((c) => c.startsWith(`${casoA.id}/`)));
});

test('G7 · reasignar el caso retira el acceso a la terapeuta anterior', opciones, async () => {
  await comoUsuario(cliente, PERFILES.admin, () => cliente.query(
    'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [casoB.id, PERFILES.t2]));
  try {
    for (const sufijo of ['', '/archivo']) {
      const r1 = await pedir(casoB.id, 't1', sufijo);
      await r1.arrayBuffer();
      assert.equal(r1.status, 404, `t1 ya no debe ver ${sufijo || 'metadatos'}`);
      const r2 = await pedir(casoB.id, 't2', sufijo);
      await r2.arrayBuffer();
      assert.equal(r2.status, 200, `t2 ahora sí ve ${sufijo || 'metadatos'}`);
    }
    await rechazaSinGuardar(casoB.id, { token: 't1' }, 404);
  } finally {
    await comoUsuario(cliente, PERFILES.admin, () => cliente.query(
      'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [casoB.id, PERFILES.t1]));
  }
});

test('G8 · un caso eliminado no expone su genograma ni a administración', opciones, async () => {
  assert.equal((await cargar(casoBorrado.id)).status, 204);
  await comoUsuario(cliente, PERFILES.admin, () => cliente.query(
    'update casos set deleted_at = now() where id = $1', [casoBorrado.id]));
  for (const sufijo of ['', '/archivo']) {
    const r = await pedir(casoBorrado.id, 'admin', sufijo);
    await r.arrayBuffer();
    assert.equal(r.status, 404);
  }
  await rechazaSinGuardar(casoBorrado.id, { token: 'admin' }, 404);
});

test('G9 · permisos completos y sin token', opciones, async () => {
  for (const sufijo of ['', '/archivo']) {
    for (const [token, estado] of [[null, 401], ['token-inventado', 401], ['mkt', 403], ['t2', 404], ['admin', 200]]) {
      const r = await pedir(casoA.id, token, sufijo);
      await r.arrayBuffer();
      assert.equal(r.status, estado, `${token ?? 'sin token'} en ${sufijo || 'metadatos'}`);
    }
  }
  const r = await fetch(`${api.base}/api/carpetas/${casoA.id}/genograma`, { method: 'PUT', body: new FormData() });
  await r.arrayBuffer();
  assert.equal(r.status, 401);
});

test('G10 · regresión: cargar el genograma no cambia el diagnóstico del caso', opciones, async () => {
  const ficha = { fecha: '2026-11-20', diagnosticoIngreso: 'Diagnóstico ficticio QA', hipotesisRelacional: null, comentariosClinicos: null };
  const guardado = await api.solicitar(`/carpetas/${casoA.id}/diagnostico`, { metodo: 'PUT', cuerpo: ficha, token: 't1' });
  assert.equal(guardado.status, 200);
  await guardado.json();
  const antes = await (await api.solicitar(`/carpetas/${casoA.id}/diagnostico`, { token: 't1' })).json();
  assert.equal((await cargar(casoA.id, { contenido: PDF, tipo: 'application/pdf', nombre: 'nuevo.pdf' })).status, 204);
  const despues = await (await api.solicitar(`/carpetas/${casoA.id}/diagnostico`, { token: 't1' })).json();
  assert.deepEqual(despues, antes);
});

test('G11 · dos cargas simultáneas terminan bien y dejan un vigente coherente', opciones, async () => {
  const antes = (await archivos(casoA.id)).length;
  const [r1, r2] = await Promise.all([
    cargar(casoA.id, { contenido: PNG, nombre: 'simultaneo-1.png' }),
    cargar(casoA.id, { contenido: JPEG, tipo: 'image/jpeg', nombre: 'simultaneo-2.jpg' }),
  ]);
  assert.deepEqual([r1.status, r2.status], [204, 204]);
  const todos = await archivos(casoA.id);
  assert.equal(todos.length, antes + 2);
  const clave = await vigente(casoA.id);
  const fila = todos.find((f) => f.clave === clave);
  assert.ok(fila?.activado_en, 'El vigente es uno de los archivos activados');
  const meta = await (await pedir(casoA.id)).json();
  assert.equal(meta.tipo, fila.tipo);
});

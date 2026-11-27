import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { ArticulosModule } from '../dist/modules/articulos/articulos.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, crearBase, crearCaso, opciones } from './helpers/pg-qa.mjs';

const CAMPOS_LISTADO = ['autor', 'fechaPublicacion', 'id', 'imagen', 'resumen', 'titulo'];
const CAMPOS_DETALLE = [...CAMPOS_LISTADO, 'contenido'].sort();

let base, sql, api, demo, caso;
const ids = {};

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe184');
  sql = base.cliente;
  caso = await crearCaso(sql, { nombre: 'Paciente QA no publicable', terapeuta: PERFILES.t1 });
  demo = JSON.parse(await readFile(new URL('../../docs/contenido/investigaciones/articulos-demostracion.json', import.meta.url), 'utf8'))
    .articulos.reduce((m, a) => ({ ...m, [a.alias]: a }), {});
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, mkt: PERFILES.marketing }, [ArticulosModule]);
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 'mkt', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}
const cuerpoDe = (a) => ({ titulo: a.titulo, resumen: a.resumen, contenido: a.contenido, autorVisible: a.autor, imagen: a.imagen });
const crear = (cuerpo, token = 'mkt') => pedir('/investigaciones/articulos', { token, metodo: 'POST', cuerpo });
const estado = (id, nuevo, token = 'mkt') => pedir(`/investigaciones/articulos/${id}/estado`, { token, metodo: 'PATCH', cuerpo: { estado: nuevo } });
const publico = (id) => pedir(`/publico/investigaciones${id ? `/${id}` : ''}`, { token: null });
const idsPublicos = async () => (await publico()).cuerpo.investigaciones.map((a) => a.id);
const filas = async () => (await sql.query('select count(*)::int as n from publicaciones_foro')).rows[0].n;

test('A1 · preparar I1, I2 e I3 de FE-185: marketing crea borradores con su autoría', opciones, async () => {
  for (const alias of ['I1', 'I2', 'I3']) {
    const r = await crear(cuerpoDe(demo[alias]));
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.estado, 'borrador');
    assert.equal(r.cuerpo.creadoPor, PERFILES.marketing);
    ids[alias] = r.cuerpo.id;
  }
  assert.equal((await estado(ids.I1, 'publicado')).status, 200, 'Marketing publica I1');
  assert.equal((await estado(ids.I3, 'publicado', 'admin')).status, 200, 'Administración publica I3');
  assert.equal((await estado(ids.I3, 'retirado', 'admin')).status, 200, 'y lo retira');
});

test('A2 · (FE-185 #6) I1 publicado se ve en el listado y en el detalle con el contenido aprobado', opciones, async () => {
  assert.deepEqual(await idsPublicos(), [ids.I1]);
  const r = await publico(ids.I1);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.titulo, demo.I1.titulo);
  assert.equal(r.cuerpo.resumen, demo.I1.resumen);
  assert.equal(r.cuerpo.contenido, demo.I1.contenido);
  assert.equal(r.cuerpo.autor, demo.I1.autor);
  assert.match(r.cuerpo.fechaPublicacion, /^\d{4}-\d{2}-\d{2}$/);
});

test('A3 · (FE-185 #4 y #5) I2 en borrador e I3 retirado no aparecen ni por listado ni por URL', opciones, async () => {
  const listado = await idsPublicos();
  for (const alias of ['I2', 'I3']) {
    assert.ok(!listado.includes(ids[alias]), `${alias} no está en el listado`);
    assert.equal((await publico(ids[alias])).status, 404, `${alias} responde no encontrado`);
  }
});

test('A4 · (FE-185 #9) la lectura pública solo expone los campos permitidos', opciones, async () => {
  const listado = (await publico()).cuerpo;
  assert.deepEqual(Object.keys(listado).sort(), ['investigaciones', 'pagina', 'tamano', 'total']);
  for (const a of listado.investigaciones) assert.deepEqual(Object.keys(a).sort(), CAMPOS_LISTADO);
  const detalle = (await publico(ids.I1)).cuerpo;
  assert.deepEqual(Object.keys(detalle).sort(), CAMPOS_DETALLE);
  const texto = JSON.stringify({ listado, detalle });
  for (const prohibido of ['estado', 'creadoPor', 'autor_id', 'publicadoPor', PERFILES.marketing, 'Paciente QA']) {
    assert.ok(!texto.includes(prohibido), `No expone "${prohibido}"`);
  }
  assert.equal((await publico(caso.id)).status, 404, 'El ID de una carpeta no sirve en el portal');
});

test('A5 · (FE-185 #3) no hay comentarios: ninguna ruta pública ni de gestión los recibe', opciones, async () => {
  for (const [metodo, ruta] of [
    ['POST', `/publico/investigaciones/${ids.I1}/comentarios`],
    ['GET', `/publico/investigaciones/${ids.I1}/comentarios`],
    ['POST', '/publico/investigaciones'],
    ['PUT', `/publico/investigaciones/${ids.I1}`],
    ['DELETE', `/publico/investigaciones/${ids.I1}`],
    ['POST', `/investigaciones/articulos/${ids.I1}/comentarios`],
  ]) {
    const r = await pedir(ruta, { token: null, metodo, cuerpo: metodo === 'GET' || metodo === 'DELETE' ? undefined : { texto: 'Comentario QA' } });
    assert.ok([401, 404, 405].includes(r.status), `${metodo} ${ruta} respondió ${r.status}`);
  }
  assert.equal((await sql.query('select count(*)::int as n from comentarios_foro')).rows[0].n, 0);
});

test('A6 · (FE-185 #7) terapeuta y visitante no crean, editan, publican, retiran ni eliminan', opciones, async () => {
  const antes = await filas();
  for (const [token, esperado] of [['t1', 403], [null, 401]]) {
    assert.equal((await pedir('/investigaciones/articulos', { token })).status, esperado, `listar ${token}`);
    assert.equal((await crear(cuerpoDe(demo.I2), token)).status, esperado, `crear ${token}`);
    assert.equal((await pedir(`/investigaciones/articulos/${ids.I2}`, { token, metodo: 'PUT', cuerpo: cuerpoDe(demo.I2) })).status, esperado, `editar ${token}`);
    assert.equal((await estado(ids.I2, 'publicado', token)).status, esperado, `publicar ${token}`);
    assert.equal((await estado(ids.I1, 'retirado', token)).status, esperado, `retirar ${token}`);
    assert.equal((await pedir(`/investigaciones/articulos/${ids.I2}`, { token, metodo: 'DELETE' })).status, esperado, `eliminar ${token}`);
  }
  assert.equal(await filas(), antes);
  assert.deepEqual(await idsPublicos(), [ids.I1]);
});

test('A7 · (FE-185 #8) texto inválido o excesivo se rechaza sin publicarse', opciones, async () => {
  const antes = await filas();
  const valido = cuerpoDe(demo.I2);
  for (const [nombre, cambio] of [
    ['título vacío', { titulo: '  ' }],
    ['título de 151', { titulo: 'x'.repeat(151) }],
    ['resumen de 501', { resumen: 'x'.repeat(501) }],
    ['contenido vacío', { contenido: '' }],
    ['contenido de 20001', { contenido: 'x'.repeat(20001) }],
    ['autor de 151', { autorVisible: 'x'.repeat(151) }],
    ['imagen con ruta peligrosa', { imagen: { ruta: '../clinico/genograma.png', textoAlternativo: 'x' } }],
    ['imagen sin texto alternativo', { imagen: { ruta: 'portada.png', textoAlternativo: '' } }],
    ['estado enviado por el cliente', { estado: 'publicado' }],
    ['autoría enviada por el cliente', { creadoPor: PERFILES.admin }],
  ]) {
    assert.equal((await crear({ ...valido, ...cambio })).status, 400, nombre);
  }
  assert.equal(await filas(), antes);
});

test('A8 · publicar sin resumen da 422 y conserva el borrador; un publicado no puede quedarse sin resumen', opciones, async () => {
  const { cuerpo: sinResumen } = await crear({ ...cuerpoDe(demo.I2), titulo: '[DEMO QA] Sin resumen', resumen: null });
  const r = await estado(sinResumen.id, 'publicado');
  assert.equal(r.status, 422);
  assert.deepEqual(r.cuerpo.camposFaltantes, ['resumen']);
  assert.equal((await pedir(`/investigaciones/articulos/${sinResumen.id}`)).cuerpo.estado, 'borrador');
  const quitar = await pedir(`/investigaciones/articulos/${ids.I1}`, { metodo: 'PUT', cuerpo: { ...cuerpoDe(demo.I1), resumen: '  ' } });
  assert.equal(quitar.status, 422);
  assert.equal((await publico(ids.I1)).cuerpo.resumen, demo.I1.resumen);
});

test('A9 · ciclo completo y transiciones no permitidas (409)', opciones, async () => {
  assert.equal((await estado(ids.I2, 'retirado')).status, 409, 'borrador → retirado');
  assert.equal((await estado(ids.I1, 'publicado')).status, 409, 'publicado → publicado');
  assert.equal((await estado(ids.I1, 'borrador')).status, 409, 'publicado → borrador');
  assert.equal((await estado(ids.I3, 'publicado')).status, 409, 'retirado → publicado directo');
  assert.equal((await estado(ids.I3, 'borrador')).status, 200, 'retirado → borrador');
  assert.equal((await estado(ids.I3, 'publicado')).status, 200, 'y se vuelve a publicar explícitamente');
  assert.ok((await idsPublicos()).includes(ids.I3));
  assert.equal((await estado(ids.I3, 'archivado')).status, 400);
});

test('A10 · editar un publicado actualiza lo público y conserva la autoría', opciones, async () => {
  const r = await pedir(`/investigaciones/articulos/${ids.I1}`, { token: 'admin', metodo: 'PUT', cuerpo: { ...cuerpoDe(demo.I1), titulo: '[DEMO QA] Título editado' } });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.creadoPor, PERFILES.marketing);
  assert.equal(r.cuerpo.actualizadoPor, PERFILES.admin);
  assert.equal(r.cuerpo.estado, 'publicado');
  assert.equal((await publico(ids.I1)).cuerpo.titulo, '[DEMO QA] Título editado');
});

test('A11 · eliminar: solo lo que nunca se publicó', opciones, async () => {
  assert.equal((await pedir(`/investigaciones/articulos/${ids.I3}`, { metodo: 'DELETE' })).status, 409, 'Ya publicado: se retira');
  assert.equal((await pedir(`/investigaciones/articulos/${ids.I2}`, { metodo: 'DELETE' })).status, 204);
  assert.equal((await pedir(`/investigaciones/articulos/${ids.I2}`)).status, 404);
  assert.equal((await pedir('/investigaciones/articulos/00000000-0000-4000-8000-00000000f184', { metodo: 'DELETE' })).status, 404);
});

test('A12 · listados: gestión filtra por estado; el portal pagina con total coherente y vacío sin error', opciones, async () => {
  const borradores = await pedir('/investigaciones/articulos?estado=borrador');
  assert.equal(borradores.status, 200);
  assert.ok(borradores.cuerpo.articulos.every((a) => a.estado === 'borrador'));
  assert.equal((await pedir('/investigaciones/articulos?estado=otro')).status, 400);
  const todos = (await publico()).cuerpo;
  const pagina = (await pedir('/publico/investigaciones?tamano=1&pagina=1', { token: null })).cuerpo;
  assert.equal(pagina.investigaciones.length, 1);
  assert.equal(pagina.total, todos.total);
  const vacia = await pedir('/publico/investigaciones?tamano=1&pagina=999', { token: null });
  assert.equal(vacia.status, 200);
  assert.deepEqual(vacia.cuerpo.investigaciones, []);
  assert.equal((await pedir('/publico/investigaciones?estado=borrador', { token: null })).status, 400, 'El portal no acepta filtros internos');
});

test('A13 · cada cambio queda en auditoría con su autor', opciones, async () => {
  const { rows } = await sql.query(
    `select usuario_id from auditoria where tabla = 'publicaciones_foro' and registro_id = $1`, [ids.I1]);
  assert.ok(rows.length >= 3, 'Alta, publicación y edición');
  assert.ok(rows.every((r) => [PERFILES.marketing, PERFILES.admin].includes(r.usuario_id)));
});

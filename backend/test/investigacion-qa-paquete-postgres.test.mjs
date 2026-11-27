import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import JSZip from 'jszip';
import { DatabaseService } from '../dist/database/database.service.js';
import { InvestigacionModule } from '../dist/modules/investigacion/investigacion.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

const ACENTOS = 'Niña con evolución favorable: áéíóú ÁÉÍÓÚ ñÑ ¿¡ «comillas» y emoji 🙂';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

let base, sql, api, A, B, C, sesionA, categoria;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe171');
  sql = base.cliente;
  A = await crearCaso(sql, { nombre: 'Rosario Quispe Identificable', terapeuta: PERFILES.t1 });
  B = await crearCaso(sql, { nombre: 'Mateo Choque Identificable', terapeuta: PERFILES.t1 });
  C = await crearCaso(sql, { nombre: 'Caso Ajeno Identificable', terapeuta: PERFILES.t2 });
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    "update pacientes set telefono = '77712345', fecha_nacimiento = '2014-05-09' where id = $1", [A.pacienteId]));
  await comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por) values ($1, '2026-10-05', $2::jsonb, $3, $3)`,
    [A.id, JSON.stringify({ evaluacionInicial: 'Evaluación inicial QA del caso A.', diagnosticoIngreso: 'Diagnóstico QA del caso A.' }), PERFILES.t1]));
  sesionA = await crearSesion(sql, A.id, { fecha: '2026-10-12', evolucion: ACENTOS });
  await crearSesion(sql, B.id, { fecha: '2026-10-13', evolucion: 'Evolución exclusiva del caso B.' });
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-12', '987.65', 'qr')`,
    [A.id, sesionA.id])).catch(() => {});

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing }, { modulos: [InvestigacionModule] });

  const cat = await pedir('/investigacion/categorias', { token: 'admin', metodo: 'POST', cuerpo: { codigo: 'QA-CAT-01', nombre: 'Categoría ficticia QA' } });
  assert.equal(cat.status, 201, JSON.stringify(cat.cuerpo));
  categoria = cat.cuerpo.categoria ?? cat.cuerpo;
  for (const [caso, extra] of [[A, { fichaSeguimientoId: sesionA.id, fragmento: 'Fragmento ficticio QA' }], [B, {}]]) {
    const r = await pedir(`/investigacion/casos/${caso.id}/etiquetas`, { metodo: 'POST', cuerpo: { categoriaId: categoria.id, ...extra } });
    assert.ok(r.status < 300, `etiqueta: ${JSON.stringify(r.cuerpo)}`);
  }
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 't1', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const tipo = r.headers.get('content-type') ?? '';
  if (tipo.includes('zip')) return { status: r.status, zip: Buffer.from(await r.arrayBuffer()), headers: r.headers };
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null, headers: r.headers };
}
async function preparar(cuerpo, token = 't1') {
  return pedir('/investigacion/exportaciones', { token, metodo: 'POST', cuerpo });
}
async function prepararRevisarYDescargar(cuerpo) {
  const p = await preparar(cuerpo);
  assert.equal(p.status, 201, JSON.stringify(p.cuerpo));
  const ruta = `/investigacion/exportaciones/${p.cuerpo.exportacionId}`;
  const vista = await pedir(`${ruta}/revision`);
  assert.equal(vista.status, 200);
  assert.equal((await pedir(`${ruta}/revision`, { metodo: 'PATCH', cuerpo: { huella: vista.cuerpo.huella } })).status, 200);
  const d = await pedir(`${ruta}/descarga`);
  assert.equal(d.status, 200);
  return { ruta, zip: await JSZip.loadAsync(d.zip), headers: d.headers };
}
async function textoDocx(buffer) {
  const docx = await JSZip.loadAsync(buffer);
  const xml = await docx.file('word/document.xml').async('string');
  return { docx, xml, texto: [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('\n') };
}
const desescapar = (s) => s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');

const SELECCION = () => ({ casosIds: [A.id, B.id], secciones: ['diagnostico', 'seguimiento', 'tareas'] });

test('X1 · paquete DOCX: solo el manifiesto y un documento por caso, con nombres de código', opciones, async () => {
  const { zip, headers } = await prepararRevisarYDescargar({ ...SELECCION(), formato: 'docx' });
  assert.equal(headers.get('content-type'), 'application/zip');
  assert.match(headers.get('content-disposition'), /attachment; filename="investigacion\.zip"/);
  assert.deepEqual(Object.keys(zip.files).sort(), ['INV-001.docx', 'INV-002.docx', 'manifiesto.json']);
});

test('X2 · cada DOCX es un documento Word válido (estructura OOXML) con el texto y los acentos intactos', opciones, async () => {
  const { zip } = await prepararRevisarYDescargar({ ...SELECCION(), formato: 'docx' });
  for (const archivo of ['INV-001.docx', 'INV-002.docx']) {
    const { docx, xml } = await textoDocx(await zip.file(archivo).async('nodebuffer'));
    for (const parte of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
      assert.ok(docx.file(parte), `${archivo}: falta ${parte}`);
    }
    assert.match(xml, /^<\?xml[^>]*encoding="UTF-8"/i, `${archivo}: XML en UTF-8`);
  }
  const textos = await Promise.all(['INV-001.docx', 'INV-002.docx'].map(async (a) => desescapar((await textoDocx(await zip.file(a).async('nodebuffer'))).texto)));
  const deA = textos.find((t) => t.includes('Evaluación inicial QA del caso A.'));
  assert.ok(deA, 'Un documento corresponde al caso A');
  for (const titulo of ['Categorías', 'Diagnóstico', 'Seguimiento', 'QA-CAT-01']) assert.ok(deA.includes(titulo), titulo);
  assert.ok(deA.includes(ACENTOS), 'Acentos, eñes, signos y emoji se conservan sin alterar');
});

test('X3 · paquete TXT: UTF-8 legible, mismo contenido y una línea de código por documento', opciones, async () => {
  const { zip } = await prepararRevisarYDescargar({ ...SELECCION(), formato: 'txt' });
  assert.deepEqual(Object.keys(zip.files).sort(), ['INV-001.txt', 'INV-002.txt', 'manifiesto.json']);
  const textos = {};
  for (const archivo of ['INV-001.txt', 'INV-002.txt']) {
    const bytes = await zip.file(archivo).async('nodebuffer');
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.equal(texto.split('\n')[0], archivo.replace('.txt', ''), 'La primera línea es el código');
    textos[archivo] = texto;
  }
  const deA = Object.values(textos).find((t) => t.includes('caso A'));
  assert.ok(deA.includes(ACENTOS));
  assert.ok(deA.includes('Fragmento: Fragmento ficticio QA'), 'El fragmento etiquetado acompaña a su categoría');
});

test('X4 · el manifiesto describe exactamente los archivos del paquete', opciones, async () => {
  const { zip } = await prepararRevisarYDescargar({ ...SELECCION(), formato: 'docx' });
  const manifiesto = JSON.parse(await zip.file('manifiesto.json').async('string'));
  assert.equal(manifiesto.formato, 'docx');
  assert.equal(manifiesto.documentos.length, 2);
  for (const doc of manifiesto.documentos) {
    assert.match(doc.idExportacion, /^INV-\d{3,}$/);
    assert.equal(doc.archivo, `${doc.idExportacion}.docx`);
    assert.ok(zip.file(doc.archivo), `${doc.archivo} existe en el ZIP`);
    assert.ok(JSON.stringify(doc.categorias).includes('QA-CAT-01'));
  }
  assert.doesNotMatch(JSON.stringify(manifiesto), UUID, 'Sin identificadores internos');
});

test('X5 · privacidad: ningún archivo trae nombres, teléfono, nacimiento, IDs internos, número de carpeta ni pagos', opciones, async () => {
  for (const formato of ['docx', 'txt']) {
    const { zip } = await prepararRevisarYDescargar({ ...SELECCION(), formato });
    for (const [nombre, archivo] of Object.entries(zip.files)) {
      const contenido = nombre.endsWith('.docx')
        ? desescapar((await textoDocx(await archivo.async('nodebuffer'))).texto)
        : await archivo.async('string');
      for (const prohibido of ['Rosario', 'Quispe', 'Mateo', 'Choque', 'Identificable', '77712345', '2014-05-09', '09/05/2014', '987', 'Bs ']) {
        assert.ok(!contenido.includes(prohibido), `${formato}/${nombre} contiene "${prohibido}"`);
      }
      assert.doesNotMatch(contenido, UUID, `${formato}/${nombre}: sin UUID`);
      assert.doesNotMatch(contenido, /2026-10-12|12\/10\/2026/, `${formato}/${nombre}: la sesión va por mes, no por día exacto`);
    }
  }
});

test('X6 · sin mezcla: cada documento tiene solo los datos de su caso', opciones, async () => {
  const { zip } = await prepararRevisarYDescargar({ ...SELECCION(), formato: 'txt' });
  const textos = await Promise.all(['INV-001.txt', 'INV-002.txt'].map((a) => zip.file(a).async('string')));
  const deA = textos.find((t) => t.includes('caso A'));
  const deB = textos.find((t) => t.includes('caso B'));
  assert.ok(deA && deB && deA !== deB);
  assert.ok(!deA.includes('Evolución exclusiva del caso B.'));
  assert.ok(!deB.includes('Evaluación inicial QA del caso A.'));
});

test('X7 · la descarga exige la revisión vigente', opciones, async () => {
  const p = await preparar({ casosIds: [A.id], secciones: ['seguimiento'], formato: 'txt' });
  const ruta = `/investigacion/exportaciones/${p.cuerpo.exportacionId}`;
  assert.equal((await pedir(`${ruta}/descarga`)).status, 409, 'Sin revisar no se descarga');
  assert.equal((await pedir(`${ruta}/revision`, { metodo: 'PATCH', cuerpo: { huella: '0'.repeat(64) } })).status, 409, 'Huella que no coincide');
  const vista = await pedir(`${ruta}/revision`);
  assert.ok(JSON.stringify(vista.cuerpo).includes(ACENTOS), 'La vista de revisión muestra el texto libre que se va a exportar');
  await pedir(`${ruta}/revision`, { metodo: 'PATCH', cuerpo: { huella: vista.cuerpo.huella } });
  assert.equal((await pedir(`${ruta}/descarga`)).status, 200);
  await comoUsuario(sql, PERFILES.t1, () => sql.query(
    'update fichas_seguimiento set evolucion = $2 where id = $1', [sesionA.id, `${ACENTOS} Corregida.`]));
  assert.equal((await pedir(`${ruta}/descarga`)).status, 409, 'Si el texto cambia después de revisar, hay que revisar otra vez');
  await comoUsuario(sql, PERFILES.t1, () => sql.query('update fichas_seguimiento set evolucion = $2 where id = $1', [sesionA.id, ACENTOS]));
});

test('X8 · permisos: un caso ajeno anula el paquete; marketing no exporta; otra terapeuta no descarga', opciones, async () => {
  const antes = (await sql.query('select count(*)::int as n from exportaciones')).rows[0].n;
  const ajeno = await preparar({ casosIds: [A.id, C.id], secciones: ['seguimiento'], formato: 'txt' });
  assert.ok([403, 404].includes(ajeno.status), `caso ajeno: ${ajeno.status}`);
  assert.equal((await preparar({ casosIds: [A.id], secciones: ['seguimiento'], formato: 'txt' }, 'mkt')).status, 403);
  assert.equal((await sql.query('select count(*)::int as n from exportaciones')).rows[0].n, antes, 'Ningún paquete parcial');
  const { ruta } = await prepararRevisarYDescargar({ casosIds: [A.id], secciones: ['seguimiento'], formato: 'txt' });
  for (const sufijo of ['/descarga', '/manifiesto', '/revision']) {
    const r = await pedir(`${ruta}${sufijo}`, { token: 't2' });
    assert.ok([403, 404].includes(r.status), `t2 en ${sufijo}: ${r.status}`);
  }
});

test('X9 · solicitudes inválidas: 400', opciones, async () => {
  for (const cuerpo of [
    { casosIds: [A.id], secciones: ['tareas'], formato: 'txt' },
    { casosIds: [A.id], secciones: ['seguimiento'], formato: 'pdf' },
    { casosIds: [A.id], secciones: ['pagos'], formato: 'txt' },
    { casosIds: [], secciones: ['seguimiento'], formato: 'txt' },
    { casosIds: [A.id], secciones: ['seguimiento'], formato: 'txt', desde: '2026-11-30', hasta: '2026-11-01' },
  ]) {
    assert.equal((await preparar(cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
});

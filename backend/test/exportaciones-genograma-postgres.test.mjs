// FE-156: documentos reales desde HTTP y PostgreSQL; exclusivamente datos ficticios.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ExportacionesModule } from '../dist/modules/exportaciones/exportaciones.module.js';
import { servidor } from './helpers/casos.mjs';
import { comoUsuario, crearBase, crearCaso, opciones, PERFILES } from './helpers/pg-qa.mjs';

let base, api, carpeta;
const conUsuario = (fn) => comoUsuario(base.cliente, PERFILES.t1, fn);
const solicitud = (caso, cuerpo, token = 't1') => api.solicitar(`/carpetas/${caso.id}/exportaciones`, { token, metodo: 'POST', cuerpo });

before(async () => {
  if (opciones.skip) return;
  carpeta = await mkdtemp(join(tmpdir(), 'fe156-'));
  base = await crearBase('fe156');
  api = await servidor({
    query: base.cliente.query.bind(base.cliente),
    transaction: (usuarioId, ejecutar) => comoUsuario(base.cliente, usuarioId, () => ejecutar(base.cliente)),
  }, PERFILES, { modulos: [ExportacionesModule], configuracion: { EXPORTACIONES_DIR: carpeta } });
});
after(async () => {
  try { await api?.close(); } finally {
    try { await base?.cerrar(); } finally { if (carpeta) await rm(carpeta, { recursive: true, force: true }); }
  }
});

function imagen(tipo = 'image/png', color = '#165a43') {
  const canvas = createCanvas(1400, 600);
  const c = canvas.getContext('2d');
  c.fillStyle = 'white'; c.fillRect(0, 0, 1400, 600);
  c.strokeStyle = color; c.lineWidth = 5;
  c.strokeRect(300, 90, 100, 100);
  c.beginPath(); c.arc(900, 140, 50, 0, 2 * Math.PI); c.stroke();
  c.beginPath(); c.moveTo(400, 140); c.lineTo(850, 140); c.moveTo(625, 140); c.lineTo(625, 340); c.stroke();
  c.strokeRect(575, 340, 100, 100);
  c.font = '28px sans-serif'; c.fillStyle = '#172a24';
  c.fillText('Padre ficticio · 44 años · Conductor', 120, 240);
  c.fillText('Madre ficticia · 41 años · Comerciante', 760, 240);
  c.fillText('Hijo ficticio · 12 años · Estudiante', 400, 500);
  return canvas.toBuffer(tipo);
}

async function pdfGenograma(paginas = 2) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const partes = [];
  const fin = new Promise((resolve, reject) => { doc.on('data', (b) => partes.push(b)); doc.on('end', () => resolve(Buffer.concat(partes))); doc.on('error', reject); });
  for (let i = 0; i < paginas; i++) {
    if (i) doc.addPage();
    doc.text(`Genograma ficticio · hoja ${i + 1}`);
    doc.image(imagen(), { fit: [760, 450] });
  }
  doc.end(); return fin;
}

async function activar(caso, contenido, tipo, nombre = 'genograma-ficticio.png') {
  const clave = `${caso.id}/${randomUUID()}`;
  await base.cliente.query(
    `insert into genograma_archivos(clave, caso_id, tipo, tamanio, contenido, nombre, subido_por, activado_en)
       values($1,$2,$3,$4,$5,$6,$7,now())`,
    [clave, caso.id, tipo, contenido.length, contenido, nombre, PERFILES.t1],
  );
  await conUsuario(() => base.cliente.query(
    `insert into genogramas(caso_id,archivo_clave,actualizado_por) values($1,$2,$3)
       on conflict(caso_id) do update set archivo_clave=excluded.archivo_clave, actualizado_por=excluded.actualizado_por`,
    [caso.id, clave, PERFILES.t1],
  ));
  return clave;
}

async function descargar(caso, pedido, nombre) {
  const creada = await solicitud(caso, pedido);
  assert.equal(creada.status, 201, await creada.clone().text());
  const { exportacionId } = await creada.json();
  const descarga = await api.solicitar(`/carpetas/${caso.id}/exportaciones/${exportacionId}/archivo`, { token: 't1' });
  assert.equal(descarga.status, 200);
  const contenido = Buffer.from(await descarga.arrayBuffer());
  if (process.env.FE156_ARTEFACTOS && nombre) {
    await mkdir(process.env.FE156_ARTEFACTOS, { recursive: true });
    await writeFile(join(process.env.FE156_ARTEFACTOS, nombre), contenido);
  }
  return contenido;
}

async function paginasPdf(contenido) {
  const tarea = getDocument({ data: new Uint8Array(contenido) });
  try {
    const doc = await tarea.promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n);
      const texto = await p.getTextContent();
      paginas.push(texto.items.map((item) => item.str).join(' '));
      // Las páginas del anexo deben contener un operador de imagen, no solo el rótulo.
      const ops = await p.getOperatorList();
      if (paginas.at(-1).includes('Genograma familiar')) assert.ok(ops.fnArray.includes(OPS.paintImageXObject), 'falta imagen del genograma');
    }
    return paginas;
  } finally { await tarea.destroy(); }
}

for (const tipo of ['image/png', 'image/jpeg', 'application/pdf']) {
  test(`FE-156: incrusta ${tipo} completo en PDF y DOCX reales`, opciones, async () => {
    const caso = await crearCaso(base.cliente, { nombre: 'Paciente ficticio FE-156', terapeuta: PERFILES.t1 });
    const esPdf = tipo === 'application/pdf';
    await activar(caso, esPdf ? await pdfGenograma() : imagen(tipo), tipo, `familia-ficticia.${esPdf ? 'pdf' : tipo.split('/')[1]}`);
    const paginasEsperadas = esPdf ? 2 : 1;
    for (const formato of ['pdf', 'docx']) {
      const contenido = await descargar(caso, { documento: 'ficha', formato, incluirGenograma: true }, `ficha-${tipo.split('/')[1]}.${formato}`);
      if (formato === 'docx') {
        const zip = await JSZip.loadAsync(contenido);
        assert.equal(Object.keys(zip.files).filter((n) => /^word\/media\/.+\.png$/.test(n)).length, paginasEsperadas);
        const xml = await zip.file('word/document.xml').async('string');
        assert.match(xml, /Genograma familiar/);
        assert.match(xml, /Paciente ficticio FE-156/);
        assert.match(xml, /w:tbl/);
      } else {
        const paginas = await paginasPdf(contenido);
        assert.equal(paginas.filter((p) => p.includes('Genograma familiar')).length, paginasEsperadas);
        assert.match(paginas.join(' '), /Paciente ficticio FE-156/);
      }
    }
  });
}

test('FE-156: informe revisado conserva la imagen anterior tras reemplazar el vigente', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: PERFILES.t1 });
  await activar(caso, imagen(), 'image/png', 'anterior-ficticio.png');
  const id = await conUsuario(async () => {
    const { rows: [{ id: informeId }] } = await base.cliente.query("insert into informes(caso_id,tipo) values($1,'intervencion_sistemica') returning id", [caso.id]);
    const { rows: [{ f }] } = await base.cliente.query('select fotografia_informe($1,array[]::uuid[],false,true) as f', [caso.id]);
    const { rows: [{ id }] } = await base.cliente.query(
      `insert into informe_versiones(informe_id,caso_id,version_plantilla,datos_origen,secciones)
       values($1,$2,'fe156-qa',$3,$4) returning id`,
      [informeId, caso.id, f, JSON.stringify([{ titulo: 'Conclusiones', contenido: 'Texto profesional ficticio revisado.' }])],
    );
    await base.cliente.query("update informe_versiones set estado='revisado' where id=$1", [id]);
    return id;
  });
  const anterior = await descargar(caso, { documento: 'informe', formato: 'docx', informeVersionId: id });
  await activar(caso, imagen('image/png', '#ab1f35'), 'image/png', 'nuevo-ficticio.png');
  const despues = await descargar(caso, { documento: 'informe', formato: 'docx', informeVersionId: id }, 'informe-revisado.docx');
  const zip1 = await JSZip.loadAsync(anterior), zip2 = await JSZip.loadAsync(despues);
  const media = Object.keys(zip1.files).find((n) => /^word\/media\/.+\.png$/.test(n));
  assert.deepEqual(await zip1.file(media).async('nodebuffer'), await zip2.file(media).async('nodebuffer'));
  assert.match(await zip2.file('word/document.xml').async('string'), /anterior-ficticio.png/);
  assert.doesNotMatch(await zip2.file('word/document.xml').async('string'), /nuevo-ficticio.png/);
  await descargar(caso, { documento: 'informe', formato: 'pdf', informeVersionId: id }, 'informe-revisado.pdf');
});

test('FE-156: selección omitida o genograma ausente no agrega imágenes', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: PERFILES.t1 });
  for (const incluirGenograma of [false, true]) {
    const contenido = await descargar(caso, { documento: 'ficha', formato: 'docx', incluirGenograma });
    const zip = await JSZip.loadAsync(contenido);
    assert.equal(Object.keys(zip.files).filter((n) => /^word\/media\/.+\.png$/.test(n)).length, 0);
    if (incluirGenograma) assert.match(await zip.file('word/document.xml').async('string'), /Genograma · Vigente/);
  }
});

test('FE-156: archivo corrupto o PDF de más de 20 páginas registra fallo, sin descarga vacía', opciones, async () => {
  for (const bytes of [Buffer.from('%PDF-invalido'), await pdfGenograma(21)]) {
    const caso = await crearCaso(base.cliente, { terapeuta: PERFILES.t1 });
    await activar(caso, bytes, 'application/pdf', 'fallo-ficticio.pdf');
    const respuesta = await solicitud(caso, { documento: 'ficha', formato: 'pdf', incluirGenograma: true });
    assert.equal(respuesta.status, 500);
    const { rows: [e] } = await base.cliente.query('select estado, archivo_path, archivo_bytes from exportaciones where caso_id=$1', [caso.id]);
    assert.deepEqual(e, { estado: 'fallida', archivo_path: null, archivo_bytes: null });
  }
});

test('FE-156: no permite exportar genogramas de casos ajenos ni a marketing', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: PERFILES.t2 });
  const pedido = { documento: 'ficha', formato: 'docx', incluirGenograma: true };
  for (const [token, esperado] of [['t1', 404], ['marketing', 403], [null, 401]]) {
    assert.equal((await solicitud(caso, pedido, token)).status, esperado);
  }
});

test('FE-156: historial extenso conserva tablas, texto y anexo sin ocultar datos', opciones, async () => {
  const caso = await crearCaso(base.cliente, { nombre: 'Familia ficticia extensa', terapeuta: PERFILES.t1 });
  await conUsuario(async () => {
    await base.cliente.query('insert into fichas_familiares(caso_id) values($1)', [caso.id]);
    for (let i = 1; i <= 24; i++) await base.cliente.query(
      `insert into familiares(caso_id,parentesco,parentesco_detalle,nombre_completo,ocupacion,convive_con_paciente)
       values($1,'otro','Familia extensa',$2,$3,false)`, [caso.id, `Familiar ficticio ${i}`, `Ocupación ficticia ${i}`],
    );
  });
  await activar(caso, await pdfGenograma(), 'application/pdf', 'familia-extensa-ficticia.pdf');
  for (const formato of ['pdf', 'docx']) {
    const bytes = await descargar(caso, { documento: 'historial', formato, incluirGenograma: true }, `historial-extenso.${formato}`);
    if (formato === 'pdf') {
      const paginas = await paginasPdf(bytes);
      assert.ok(paginas.length >= 4);
      assert.match(paginas.join(' '), /Familiar ficticio 24/);
    } else {
      const zip = await JSZip.loadAsync(bytes);
      assert.match(await zip.file('word/document.xml').async('string'), /Familiar ficticio 24/);
    }
  }
});

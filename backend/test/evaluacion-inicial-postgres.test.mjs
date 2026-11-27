import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { ExportacionesModule } from '../dist/modules/exportaciones/exportaciones.module.js';
import { InformesModule } from '../dist/modules/informes/informes.module.js';
import { InvestigacionModule } from '../dist/modules/investigacion/investigacion.module.js';
import { servidor } from './helpers/casos.mjs';
import { comoUsuario, crearBase, crearCaso, opciones, PERFILES } from './helpers/pg-qa.mjs';

const evaluacion = 'Entrevista inicial nueva QA sin diagnostico definitivo.';
const legado = {
  diagnosticoIngreso: 'Diagnóstico histórico ficticio',
  hipotesisRelacional: 'Hipótesis histórica ficticia',
  comentariosClinicos: 'Comentarios históricos: no son evaluación inicial',
  campoFuturo: { conservar: true },
};
let base, api, carpeta, caso, previa, fotoPrevia, informePrevio, familiaPrevia, genogramaPrevio;
const ruta = (sufijo = '') => `/carpetas/${caso.id}${sufijo}`;
const pedir = (sufijo, { token = 't1', metodo = 'GET', cuerpo } = {}) =>
  api.solicitar(ruta(sufijo), { token, metodo, cuerpo });
async function json(respuesta, estado = 200) {
  const r = await respuesta;
  const datos = await r.json();
  assert.equal(r.status, estado, JSON.stringify(datos));
  return datos;
}
const foto = async () => (await base.cliente.query(
  'select fotografia_informe($1) as datos', [caso.id],
)).rows[0].datos;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe_eval', { hasta: '020' });
  caso = await crearCaso(base.cliente, { nombre: 'Paciente ficticio evaluación', terapeuta: PERFILES.t1 });
  await comoUsuario(base.cliente, PERFILES.t1, async () => {
    previa = (await base.cliente.query(
      `insert into fichas_diagnostico(caso_id, fecha, contenido)
       values ($1, '2026-11-20', $2) returning *`, [caso.id, legado],
    )).rows[0];
    await base.cliente.query('update casos set diagnostico_ingreso = $2 where id = $1',
      [caso.id, 'Antecedente del alta, nunca rellenar un diagnóstico null']);
    fotoPrevia = await foto();
    const informe = (await base.cliente.query(
      `insert into informes(caso_id, tipo) values ($1, 'intervencion_sistemica') returning id`, [caso.id],
    )).rows[0];
    const v = (await base.cliente.query(
      `insert into informe_versiones(informe_id, caso_id, version_plantilla, datos_origen, secciones)
       values ($1,$2,'fe151-sistemica-v1',$3,'[{"titulo":"Evaluación","contenido":"Texto histórico revisado"}]') returning id`,
      [informe.id, caso.id, fotoPrevia],
    )).rows[0];
    await base.cliente.query("update informe_versiones set estado='revisado' where id=$1", [v.id]);
    informePrevio = (await base.cliente.query('select to_jsonb(v) as datos from informe_versiones v where id=$1', [v.id])).rows[0].datos;
  });
  await base.migrar();
  carpeta = await mkdtemp(join(tmpdir(), 'fe-evaluacion-'));
  const db = {
    query: base.cliente.query.bind(base.cliente),
    transaction: (usuarioId, ejecutar) => comoUsuario(base.cliente, usuarioId, () => ejecutar(base.cliente)),
  };
  api = await servidor(db, PERFILES, {
    modulos: [ExportacionesModule, InformesModule, InvestigacionModule], configuracion: { EXPORTACIONES_DIR: carpeta },
  });
  familiaPrevia = await json(pedir('/familia', { metodo: 'PUT', cuerpo: {
    version: null, familiares: [{ parentesco: 'padre', edadReferida: 44, fechaReferencia: '2026-11-20', ocupacion: 'Conductor QA' }],
  } }));
  const body = new FormData();
  body.set('archivo', new Blob(['%PDF-1.7\nGenograma ficticio de regresión QA'], { type: 'application/pdf' }), 'familia-qa.pdf');
  const cargado = await fetch(`${api.base}/api${ruta('/genograma')}`, { method: 'PUT', headers: { Authorization: 'Bearer t1' }, body });
  assert.equal(cargado.status, 204, await cargado.text());
  genogramaPrevio = await json(pedir('/genograma'));
});

after(async () => {
  try { await api?.close(); } finally {
    try { await base?.cerrar(); } finally {
      if (carpeta) await rm(carpeta, { recursive: true, force: true });
    }
  }
});

test('la 021 conserva JSON, fotografía e informe revisado anteriores sin inventar una evaluación', opciones, async () => {
  const actual = (await base.cliente.query('select * from fichas_diagnostico where id=$1', [previa.id])).rows[0];
  assert.deepEqual(actual, previa);
  assert.deepEqual(await foto(), fotoPrevia);
  const vieja = (await base.cliente.query('select to_jsonb(v) as datos from informe_versiones v where id=$1', [informePrevio.id])).rows[0].datos;
  assert.deepEqual(vieja, informePrevio);
  const { diagnostico } = await json(pedir('/diagnostico'));
  assert.equal(diagnostico.evaluacionInicial, null);
  assert.equal(diagnostico.comentariosClinicos, legado.comentariosClinicos);
});

test('la edición exige evaluación aunque el registro antiguo tenga diagnóstico; un error conserva todo', opciones, async () => {
  for (const valor of [undefined, null, '', '   ', 123, 'x'.repeat(10001)]) {
    await json(pedir('/diagnostico', { metodo: 'PUT', cuerpo: {
      fecha: '2026-11-21', diagnosticoIngreso: 'Diagnóstico QA', evaluacionInicial: valor,
    } }), 400);
  }
  assert.deepEqual((await base.cliente.query('select contenido from fichas_diagnostico where id=$1', [previa.id])).rows[0].contenido, legado);
});

test('guarda evaluación sin diagnóstico, conserva identidad, autoría, claves adicionales y contexto familiar', opciones, async () => {
  const { diagnostico } = await json(pedir('/diagnostico', { metodo: 'PUT', cuerpo: {
    fecha: '2026-11-21', evaluacionInicial: `  ${evaluacion}  `,
    diagnosticoIngreso: null, hipotesisRelacional: null, comentariosClinicos: 'Comentario nuevo QA',
  } }));
  assert.equal(diagnostico.evaluacionInicial, evaluacion);
  assert.equal(diagnostico.diagnosticoIngreso, null);
  assert.equal(diagnostico.id, previa.id);
  assert.equal(diagnostico.creadoPor, previa.creado_por);
  assert.equal(new Date(diagnostico.creadoEn).getTime(), previa.creado_en.getTime());
  const contenido = (await base.cliente.query('select contenido from fichas_diagnostico where id=$1', [previa.id])).rows[0].contenido;
  assert.deepEqual(contenido.campoFuturo, legado.campoFuturo);
  assert.deepEqual(await json(pedir('/familia')), familiaPrevia);
  assert.deepEqual(await json(pedir('/genograma')), genogramaPrevio);
  assert.equal((await base.cliente.query('select count(*)::int as n from fichas_diagnostico where caso_id=$1', [caso.id])).rows[0].n, 1);
});

test('fuente vigente e historial incluyen la evaluación y no rellenan diagnóstico null desde el alta', opciones, async () => {
  const vigente = await json(pedir('/diagnostico/vigente'));
  assert.equal(vigente.evaluacionInicial, evaluacion);
  assert.equal(vigente.diagnosticoIngreso, null);
  assert.equal(vigente.alta.diagnosticoIngreso, 'Antecedente del alta, nunca rellenar un diagnóstico null');
  const historial = await json(pedir('/historial'));
  assert.equal(historial.diagnostico.evaluacionInicial, evaluacion);
  assert.equal(historial.diagnostico.diagnosticoIngreso, null);
  const snapshot = await foto();
  assert.equal(snapshot.diagnostico.evaluacionInicial, evaluacion);
});

test('genera un informe con la evaluación y conserva intacto el informe revisado anterior', opciones, async () => {
  const informe = await json(pedir('/informes', { metodo: 'POST', cuerpo: {
    tipo: 'intervencion_sistemica', sesionesIds: [],
  } }), 201);
  const detalle = await json(pedir(`/informes/${informe.id}`));
  assert.ok(JSON.stringify(detalle).includes(evaluacion), JSON.stringify(detalle));
  const vieja = (await base.cliente.query('select to_jsonb(v) as datos from informe_versiones v where id=$1', [informePrevio.id])).rows[0].datos;
  assert.deepEqual(vieja, informePrevio);
});

test('exporta la evaluación a Word editable y genera PDF desde la ficha sin exigir diagnóstico', opciones, async () => {
  for (const formato of ['docx', 'pdf']) {
    const { exportacionId } = await json(pedir('/exportaciones', { metodo: 'POST', cuerpo: {
      documento: 'ficha', formato, secciones: ['identificacion', 'diagnostico'],
    } }), 201);
    const r = await pedir(`/exportaciones/${exportacionId}/archivo`);
    assert.equal(r.status, 200);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (formato === 'docx') {
      const zip = await JSZip.loadAsync(bytes);
      const xml = await zip.file('word/document.xml').async('string');
      assert.ok(xml.includes(evaluacion));
      assert.ok(xml.includes('Evaluación inicial'));
    } else assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  }
});

test('la evaluación mantiene permisos clínicos y rechaza escrituras ajenas sin filtrar texto', opciones, async () => {
  for (const [token, estado] of [[null, 401], ['marketing', 403], ['t2', 404]]) {
    for (const sufijo of ['/diagnostico', '/diagnostico/vigente', '/historial']) {
      const r = await pedir(sufijo, { token });
      assert.equal(r.status, estado);
      assert.ok(!(await r.text()).includes(evaluacion));
    }
    await json(pedir('/diagnostico', { token, metodo: 'PUT', cuerpo: {
      fecha: '2026-11-22', evaluacionInicial: 'No debe guardarse', diagnosticoIngreso: null,
    } }), estado);
  }
  assert.equal((await json(pedir('/diagnostico'))).diagnostico.evaluacionInicial, evaluacion);
});

test('investigación muestra la evaluación antes de revisar y bloquea la descarga si cambia después', opciones, async () => {
  const paquete = await json(api.solicitar('/investigacion/exportaciones', {
    token: 't1', metodo: 'POST', cuerpo: {
      casosIds: [caso.id], secciones: ['diagnostico'], formato: 'txt',
    },
  }), 201);
  const basePaquete = `/investigacion/exportaciones/${paquete.exportacionId}`;
  const previaRevision = await json(api.solicitar(`${basePaquete}/revision`, { token: 't1' }));
  assert.equal(previaRevision.documentos[0].diagnostico.evaluacionInicial, evaluacion);
  const pendiente = await api.solicitar(`${basePaquete}/descarga`, { token: 't1' });
  assert.notEqual(pendiente.status, 200);
  await pendiente.text();
  await json(api.solicitar(`${basePaquete}/revision`, {
    token: 't1', metodo: 'PATCH', cuerpo: { huella: previaRevision.huella },
  }));
  const descarga = await api.solicitar(`${basePaquete}/descarga`, { token: 't1' });
  assert.equal(descarga.status, 200);
  const zip = await JSZip.loadAsync(Buffer.from(await descarga.arrayBuffer()));
  const texto = await zip.file('INV-001.txt').async('string');
  assert.ok(texto.includes(evaluacion));
  assert.ok(texto.includes('Evaluación inicial:'));
  await json(pedir('/diagnostico', { metodo: 'PUT', cuerpo: {
    fecha: '2026-11-21', evaluacionInicial: `${evaluacion} Modificada.`,
    diagnosticoIngreso: null, hipotesisRelacional: null, comentariosClinicos: 'Comentario nuevo QA',
  } }));
  const cambio = await api.solicitar(`${basePaquete}/descarga`, { token: 't1' });
  assert.equal(cambio.status, 409, await cambio.text());
});

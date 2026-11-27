// FE-168: categorías de investigación, selección autorizada y paquete para Atlas.ti (migración 018).
// Pruebas de docs/srs/sprint-3/FE-167-investigacion-atlasti.md §6 más integridad y permisos.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
const cat = {};
const casos = {};
const sesiones = {};
const fichas = {};

// Datos que nunca deben salir en el paquete.
const IDENTIFICADORES = ['Rosa Identificable Quispe', 'Bruno Identificable Mamani', 'Carmen Ajena Rojas', 'Diana Sin Asignar',
  '79999999', '1990-05-05', 'Localidad Secreta', 'Juzgado Secreto', 'EXP-SECRETO-1', 'Tío Secreto', '123.45', 'admin QA', 't1 QA'];

const como = (usuario, texto, params = []) => comoUsuario(sql, usuario, async () => (await sql.query(texto, params)).rows);
const etiquetar = (usuario, datos) => como(usuario,
  `insert into caso_categorias (caso_id, categoria_id, ficha_diagnostico_id, ficha_seguimiento_id, fragmento, nota)
   values ($1, $2, $3, $4, $5, $6) returning *`,
  [datos.caso, datos.categoria, datos.diagnostico ?? null, datos.sesion ?? null, datos.fragmento ?? null, datos.nota ?? null]);
const crearCategoria = async (codigo, nombre, padre = null) => (await como(PERFILES.admin,
  'insert into categorias_investigacion (codigo, nombre, padre_id) values ($1, $2, $3) returning *', [codigo, nombre, padre]))[0];
const seleccion = async (perfil, filtros = {}) => (await sql.query(
  'select * from seleccion_investigacion($1, $2, $3, $4, $5)',
  [perfil, filtros.categorias ?? null, filtros.desde ?? null, filtros.hasta ?? null, filtros.residencias ?? null])).rows;
const preparar = async (usuario, casosIds, { secciones = ['diagnostico', 'seguimiento'], formato = 'docx', desde = null, hasta = null } = {}) =>
  (await como(usuario, 'select preparar_exportacion_investigacion($1, $2, $3, $4, $5) as id',
    [casosIds, secciones, formato, desde, hasta]))[0].id;
const manifiesto = async (usuario, id) => (await como(usuario, 'select manifiesto_exportacion($1) as m', [id]))[0].m;
const documento = async (usuario, id, inv) => (await como(usuario, 'select datos_documento_investigacion($1, $2) as d', [id, inv]))[0].d;
const docsDe = async (id) => (await sql.query(
  'select orden, id_exportacion, archivo, caso_id, categorias, secciones from exportacion_documentos where exportacion_id = $1 order by orden', [id])).rows;

before(async () => {
  if (opciones.skip) return;
  // 001–017 con una categoría y una etiqueta previas: la 018 se aplica sobre datos existentes.
  base = await crearBase('fe168', { hasta: '017' });
  sql = base.cliente;
  const previo = await crearCaso(sql, { nombre: 'Caso previo QA', terapeuta: PERFILES.t1 });
  const [antigua] = await como(PERFILES.admin,
    `insert into categorias_investigacion (nombre) values ('Categoría previa') returning id`);
  await como(PERFILES.admin, 'insert into caso_categorias (caso_id, categoria_id) values ($1, $2)', [previo.id, antigua.id]);
  await base.migrar();
  casos.previo = previo.id;

  // A y B de t1, C de t2, D sin asignar, E de t1 dada de baja.
  casos.A = (await crearCaso(sql, { nombre: 'Rosa Identificable Quispe', terapeuta: PERFILES.t1 })).id;
  casos.B = (await crearCaso(sql, { nombre: 'Bruno Identificable Mamani', tipo: 'derivado', terapeuta: PERFILES.t1 })).id;
  casos.C = (await crearCaso(sql, { nombre: 'Carmen Ajena Rojas', terapeuta: PERFILES.t2 })).id;
  casos.D = (await crearCaso(sql, { nombre: 'Diana Sin Asignar' })).id;
  casos.E = (await crearCaso(sql, { nombre: 'Elsa Baja QA', terapeuta: PERFILES.t1 })).id;

  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`update pacientes set telefono = '79999999', fecha_nacimiento = '1990-05-05', ciudad_residencia = 'la_paz'
                      where id = (select paciente_id from casos where id = $1)`, [casos.A]);
    await sql.query(`update pacientes set ciudad_residencia = 'el_alto' where id = (select paciente_id from casos where id = $1)`, [casos.B]);
    await sql.query(`update pacientes set ciudad_residencia = 'otra', otra_localidad = 'Localidad Secreta'
                      where id = (select paciente_id from casos where id = $1)`, [casos.D]);
    await sql.query(`update casos set diagnostico_ingreso = 'Diagnóstico del alta de B' where id = $1`, [casos.B]);
    await sql.query(`insert into contexto_judicial (caso_id, juzgado, nro_expediente) values ($1, 'Juzgado Secreto N.º 9', 'EXP-SECRETO-1')`, [casos.B]);
    fichas.A = (await sql.query(
      `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
       values ($1, '2026-10-01', $2, $3, $3) returning id`,
      [casos.A, { diagnosticoIngreso: 'Diagnóstico de A', hipotesisRelacional: 'Hipótesis de A', comentariosClinicos: null }, PERFILES.t1])).rows[0].id;
    fichas.C = (await sql.query(
      `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
       values ($1, '2026-10-01', '{"diagnosticoIngreso": "Diagnóstico de C"}', $2, $2) returning id`, [casos.C, PERFILES.t2])).rows[0].id;
    await sql.query('insert into fichas_familiares (caso_id) values ($1)', [casos.A]);
    await sql.query(`insert into familiares (caso_id, parentesco, nombre_completo) values ($1, 'tio', 'Tío Secreto')`, [casos.A]);
  });
  sesiones.A1 = (await crearSesion(sql, casos.A, { fecha: '2026-08-10', evolucion: 'Evolución A1 de agosto' })).id;
  sesiones.A2 = (await crearSesion(sql, casos.A, { fecha: '2026-10-12', evolucion: 'Evolución A2 de octubre' })).id;
  sesiones.A3 = (await crearSesion(sql, casos.A, { fecha: '2026-10-19', evolucion: 'Evolución A3 de octubre' })).id;
  sesiones.B1 = (await crearSesion(sql, casos.B, { fecha: '2026-10-14', evolucion: 'Evolución B1' })).id;
  sesiones.C1 = (await crearSesion(sql, casos.C, { fecha: '2026-10-15', evolucion: 'Evolución C1', responsable: PERFILES.t2 })).id;
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query(`insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, 'Tarea de A2', $3)`,
      [casos.A, sesiones.A2, PERFILES.t1]);
    await sql.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo, registrado_por) values ($1, $2, '2026-10-12', 123.45, 'qr', $3)`,
      [casos.A, sesiones.A2, PERFILES.admin]);
  });

  cat.c1 = await crearCategoria('QA-CAT-01', 'Categoría de prueba 1');
  cat.c2 = await crearCategoria('QA-CAT-02', 'Categoría de prueba 2');
  cat.c1a = await crearCategoria('QA-CAT-01-A', 'Subcategoría de prueba 1', cat.c1.id);
  cat.ret = await crearCategoria('QA-CAT-09', 'Categoría a retirar');

  // FE-167 §2: QA-CAT-01 en el caso A y en su ficha; QA-CAT-02 en B. Más etiquetas para conteos y período.
  await etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c1.id });
  await etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c1.id, diagnostico: fichas.A, fragmento: 'Hipótesis de A' });
  await etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c1a.id, sesion: sesiones.A1, nota: 'Sesión de agosto' });
  await etiquetar(PERFILES.t1, { caso: casos.B, categoria: cat.c2.id });
  await etiquetar(PERFILES.t2, { caso: casos.C, categoria: cat.c1.id, sesion: sesiones.C1 });
  await etiquetar(PERFILES.admin, { caso: casos.D, categoria: cat.c2.id });
  await etiquetar(PERFILES.t1, { caso: casos.E, categoria: cat.c1.id });
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update casos set deleted_at = now() where id = $1', [casos.E]));
});

after(async () => {
  if (base) await base.cerrar();
});

test('la 018 conserva la categoría y la etiqueta previas y les da código', opciones, async () => {
  const { rows: [previa] } = await sql.query(`select codigo, activa from categorias_investigacion where nombre = 'Categoría previa'`);
  assert.deepEqual(previa, { codigo: 'CAT-001', activa: true });
  const { rows } = await sql.query('select count(*)::int as n from caso_categorias where caso_id = $1', [casos.previo]);
  assert.equal(rows[0].n, 1);
});

test('catálogo: normaliza, no repite nombre en el nivel y valida código, nombre y color', opciones, async () => {
  const c = await crearCategoria('  qa-cat-05 ', '  Vínculos   familiares ');
  assert.equal(c.codigo, 'QA-CAT-05');
  assert.equal(c.nombre, 'Vínculos familiares');
  assert.equal(c.creado_por, PERFILES.admin);
  await rechaza(crearCategoria('QA-CAT-06', 'VÍNCULOS FAMILIARES'), '23505');
  await rechaza(crearCategoria('QA-CAT-01', 'Otro nombre'), '23505');
  // Mismo nombre bajo otra categoría: permitido.
  await crearCategoria('QA-CAT-07', 'Vínculos familiares', cat.c1.id);
  await rechaza(crearCategoria('QA-CAT-08', '   '), '23514');
  await rechaza(crearCategoria('QA CAT', 'Código con espacio'), '23514');
  await rechaza(crearCategoria(null, 'Sin código'), '23502');
  await rechaza(como(PERFILES.admin, `insert into categorias_investigacion (codigo, nombre, color) values ('QA-COLOR', 'Color', 'rojo')`), '23514');
});

test('catálogo: sin ciclos, código fijo y una categoría usada o con subcategorías no se borra', opciones, async () => {
  await rechaza(como(PERFILES.admin, 'update categorias_investigacion set padre_id = $1 where id = $1', [cat.c1.id]), '23514');
  await rechaza(como(PERFILES.admin, 'update categorias_investigacion set padre_id = $1 where id = $2', [cat.c1a.id, cat.c1.id]), '23514');
  await rechaza(como(PERFILES.admin, `update categorias_investigacion set codigo = 'QA-OTRO' where id = $1`, [cat.c2.id]), '23514');
  await rechaza(como(PERFILES.admin, 'delete from categorias_investigacion where id = $1', [cat.c2.id]), '23503');
  const padre = await crearCategoria('QA-PADRE', 'Padre sin etiquetas');
  await crearCategoria('QA-HIJA', 'Hija sin etiquetas', padre.id);
  await rechaza(como(PERFILES.admin, 'delete from categorias_investigacion where id = $1', [padre.id]), '23503');
  const sinUso = await crearCategoria('QA-BORRABLE', 'Sin uso');
  await como(PERFILES.admin, 'delete from categorias_investigacion where id = $1', [sinUso.id]);
});

test('etiquetas: la ficha debe ser del mismo caso; sin duplicados ni cambios de destino', opciones, async () => {
  // FE-167 §6: sesión de B asignada a A → rechazo.
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c2.id, sesion: sesiones.B1 }), '23503');
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c2.id, diagnostico: fichas.C }), '23503');
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c2.id, diagnostico: fichas.A, sesion: sesiones.A2 }), '23514');
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c1.id }), '23505');
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c1.id, diagnostico: fichas.A }), '23505');
  await rechaza(etiquetar(PERFILES.admin, { caso: casos.E, categoria: cat.c2.id }), '23514');

  const [nueva] = await etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.ret.id, nota: '   ' });
  assert.equal(nueva.etiquetado_por, PERFILES.t1);
  assert.equal(nueva.nota, null);
  await rechaza(como(PERFILES.t1, 'update caso_categorias set caso_id = $1 where id = $2', [casos.B, nueva.id]), '23514');
  const [editada] = await como(PERFILES.admin, `update caso_categorias set nota = 'Nota revisada' where id = $1 returning *`, [nueva.id]);
  assert.equal(editada.etiquetado_por, PERFILES.t1);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  const { rows: [aud] } = await sql.query(
    `select usuario_id from auditoria where tabla = 'caso_categorias' and registro_id = $1 and accion = 'UPDATE'`, [nueva.id]);
  assert.equal(aud.usuario_id, PERFILES.admin);

  // Retirada: conserva sus etiquetas y no admite nuevas.
  await como(PERFILES.admin, 'update categorias_investigacion set activa = false where id = $1', [cat.ret.id]);
  await rechaza(etiquetar(PERFILES.t1, { caso: casos.B, categoria: cat.ret.id }), '23514');
  await como(PERFILES.admin, 'delete from caso_categorias where id = $1', [nueva.id]);
});

test('selección: cada rol ve solo su alcance; un caso ajeno nunca aparece', opciones, async () => {
  const ids = (filas) => filas.map((f) => f.caso_id).sort();
  const todos = [casos.previo, casos.A, casos.B, casos.C, casos.D].sort();
  assert.deepEqual(ids(await seleccion(PERFILES.admin)), todos);
  assert.deepEqual(ids(await seleccion(PERFILES.t1)), [casos.previo, casos.A, casos.B].sort());
  assert.deepEqual(ids(await seleccion(PERFILES.t2)), [casos.C]);
  assert.deepEqual(await seleccion(PERFILES.marketing), []);
  assert.deepEqual(await seleccion('00000000-0000-4000-8000-0000000000ff'), []);

  const a = (await seleccion(PERFILES.t1)).find((f) => f.caso_id === casos.A);
  assert.deepEqual(a.categorias, ['QA-CAT-01', 'QA-CAT-01-A']);
  assert.equal(a.sesiones_en_periodo, 3);
  assert.equal(a.tiene_diagnostico, true);

  // Terapeuta inactiva: nada.
  await sql.query('update perfiles set activo = false where id = $1', [PERFILES.t2]);
  assert.deepEqual(await seleccion(PERFILES.t2), []);
  await sql.query('update perfiles set activo = true where id = $1', [PERFILES.t2]);
});

test('selección: categorías (con subcategorías, cualquiera), período y residencia', opciones, async () => {
  const ids = async (perfil, filtros) => (await seleccion(perfil, filtros)).map((f) => f.caso_id).sort();
  assert.deepEqual(await ids(PERFILES.admin, { categorias: [cat.c1.id] }), [casos.A, casos.C].sort());
  assert.deepEqual(await ids(PERFILES.admin, { categorias: [cat.c1a.id] }), [casos.A]);
  assert.deepEqual(await ids(PERFILES.admin, { categorias: [cat.c1.id, cat.c2.id] }), [casos.A, casos.B, casos.C, casos.D].sort());
  assert.deepEqual(await ids(PERFILES.t1, { categorias: [cat.c1.id, cat.c2.id] }), [casos.A, casos.B].sort());
  assert.deepEqual(await ids(PERFILES.admin, { desde: '2026-10-13', hasta: '2026-10-14' }), [casos.B]);
  const enOctubre = (await seleccion(PERFILES.admin, { desde: '2026-10-01', hasta: '2026-10-31' })).find((f) => f.caso_id === casos.A);
  assert.equal(enOctubre.sesiones_en_periodo, 2);
  assert.deepEqual(await ids(PERFILES.admin, { residencias: ['el_alto', 'otra'] }), [casos.B, casos.D].sort());
  assert.deepEqual(await ids(PERFILES.admin, { residencias: ['sin_registrar'] }), [casos.previo, casos.C].sort());
  await rechaza(seleccion(PERFILES.admin, { residencias: ['cochabamba'] }), '22023');
  await rechaza(seleccion(PERFILES.admin, { desde: '2026-11-01', hasta: '2026-10-01' }), '22023');
});

test('conteos por categoría dentro del alcance autorizado y del período', opciones, async () => {
  const conteo = async (perfil, desde = null, hasta = null) => Object.fromEntries((await sql.query(
    'select codigo, casos, etiquetas_caso, etiquetas_diagnostico, etiquetas_sesion from conteo_categorias($1, $2, $3)',
    [perfil, desde, hasta])).rows.map(({ codigo, ...n }) => [codigo, n]));
  const admin = await conteo(PERFILES.admin);
  assert.deepEqual(admin['QA-CAT-01'], { casos: 2, etiquetas_caso: 1, etiquetas_diagnostico: 1, etiquetas_sesion: 1 });
  assert.deepEqual(admin['QA-CAT-02'], { casos: 2, etiquetas_caso: 2, etiquetas_diagnostico: 0, etiquetas_sesion: 0 });
  assert.deepEqual(admin['QA-CAT-01-A'], { casos: 1, etiquetas_caso: 0, etiquetas_diagnostico: 0, etiquetas_sesion: 1 });
  assert.deepEqual(admin['QA-CAT-09'], { casos: 0, etiquetas_caso: 0, etiquetas_diagnostico: 0, etiquetas_sesion: 0 });
  // La etiqueta de la carpeta dada de baja (E) no cuenta.
  const t1 = await conteo(PERFILES.t1);
  assert.deepEqual(t1['QA-CAT-01'], { casos: 1, etiquetas_caso: 1, etiquetas_diagnostico: 1, etiquetas_sesion: 0 });
  assert.deepEqual(t1['QA-CAT-02'], { casos: 1, etiquetas_caso: 1, etiquetas_diagnostico: 0, etiquetas_sesion: 0 });
  // Octubre: la sesión de agosto de A queda fuera.
  const octubre = await conteo(PERFILES.admin, '2026-10-01', '2026-10-31');
  assert.equal(octubre['QA-CAT-01-A'].etiquetas_sesion, 0);
  assert.equal(octubre['QA-CAT-01'].etiquetas_sesion, 1);
  assert.deepEqual(Object.values(await conteo(PERFILES.marketing)).map((n) => n.casos).filter(Boolean), []);
});

test('paquete: dos casos → dos documentos y dos entradas de manifiesto, sin mezcla', opciones, async () => {
  const id = await preparar(PERFILES.t1, [casos.A, casos.B, casos.A]);
  const docs = await docsDe(id);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map((d) => d.id_exportacion), ['INV-001', 'INV-002']);
  assert.deepEqual(docs.map((d) => d.archivo), ['INV-001.docx', 'INV-002.docx']);
  assert.deepEqual(docs.map((d) => d.caso_id).sort(), [casos.A, casos.B].sort());

  const m = await manifiesto(PERFILES.t1, id);
  assert.equal(m.formatoVersion, 1);
  assert.equal(m.formato, 'docx');
  assert.deepEqual(m.documentos, docs.map((d) => ({
    idExportacion: d.id_exportacion, archivo: d.archivo, categorias: d.categorias, secciones: ['diagnostico', 'seguimiento'] })));
  const delA = m.documentos[docs.findIndex((d) => d.caso_id === casos.A)];
  const delB = m.documentos[docs.findIndex((d) => d.caso_id === casos.B)];
  assert.deepEqual(delA.categorias, ['QA-CAT-01', 'QA-CAT-01-A']);
  assert.deepEqual(delB.categorias, ['QA-CAT-02']);
  assert.deepEqual(m.catalogo.map((c) => [c.codigo, c.padre]), [['QA-CAT-01', null], ['QA-CAT-01-A', 'QA-CAT-01'], ['QA-CAT-02', null]]);

  // Cada documento trae solo lo de su caso; las categorías coinciden con su entrada del manifiesto.
  for (const entrada of m.documentos) {
    const d = await documento(PERFILES.t1, id, entrada.idExportacion);
    assert.equal(d.archivo, entrada.archivo);
    assert.deepEqual([...new Set(d.categorias.map((c) => c.codigo))].sort(), entrada.categorias);
    const texto = JSON.stringify(d);
    if (entrada === delA) {
      assert.equal(d.diagnostico.origen, 'ficha');
      assert.deepEqual(d.seguimiento.map((s) => [s.nroSesion, s.mes]), [[1, '2026-08'], [2, '2026-10'], [3, '2026-10']]);
      assert.equal(d.seguimiento[0].tareas, undefined);
      assert.ok(!texto.includes('Evolución B1') && !texto.includes('Diagnóstico del alta de B'));
    } else {
      assert.deepEqual(d.diagnostico, { origen: 'alta', diagnosticoIngreso: 'Diagnóstico del alta de B', hipotesisRelacional: null, comentariosClinicos: null });
      assert.deepEqual(d.seguimiento.map((s) => s.evolucion), ['Evolución B1']);
      assert.ok(!texto.includes('Evolución A') && !texto.includes('Diagnóstico de A'));
    }
    assert.ok(!texto.includes('Evolución C1'));
  }
});

test('paquete: secciones, período y formato definen contenido y categorías', opciones, async () => {
  // Etiqueta solo del diagnóstico: sin la sección diagnóstico no entra al paquete.
  const [soloDx] = await etiquetar(PERFILES.t1, { caso: casos.A, categoria: cat.c2.id, diagnostico: fichas.A });
  const conDx = await preparar(PERFILES.admin, [casos.A], { secciones: ['diagnostico'] });
  assert.deepEqual((await docsDe(conDx))[0].categorias, ['QA-CAT-01', 'QA-CAT-02']);
  const id = await preparar(PERFILES.admin, [casos.A], { secciones: ['tareas', 'seguimiento'], formato: 'txt', desde: '2026-10-01', hasta: '2026-10-31' });
  const [doc] = await docsDe(id);
  assert.equal(doc.archivo, 'INV-001.txt');
  assert.deepEqual(doc.secciones, ['seguimiento', 'tareas']);
  // Sin diagnóstico ni la sesión de agosto: solo la etiqueta del caso.
  assert.deepEqual(doc.categorias, ['QA-CAT-01']);
  const d = await documento(PERFILES.admin, id, 'INV-001');
  assert.equal(d.diagnostico, undefined);
  assert.deepEqual(d.seguimiento.map((s) => s.nroSesion), [2, 3]);
  assert.deepEqual(d.seguimiento[0].tareas, [{ descripcion: 'Tarea de A2', completada: false }]);
  assert.deepEqual(d.categorias.map((c) => c.ambito), ['caso']);
  const m = await manifiesto(PERFILES.admin, id);
  assert.deepEqual(m.periodo, { desde: '2026-10-01', hasta: '2026-10-31' });
  await como(PERFILES.admin, 'delete from caso_categorias where id = $1', [soloDx.id]);

  await rechaza(preparar(PERFILES.admin, [casos.A], { secciones: ['tareas'] }), '22023');
  await rechaza(preparar(PERFILES.admin, [casos.A], { secciones: ['familia'] }), '22023');
  await rechaza(preparar(PERFILES.admin, [casos.A], { secciones: [] }), '22023');
  await rechaza(preparar(PERFILES.admin, [casos.A], { formato: 'pdf' }), '22023');
  await rechaza(preparar(PERFILES.admin, []), '22023');
});

test('paquete: caso ajeno, dado de baja o inexistente anula todo; marketing no exporta', opciones, async () => {
  const antes = (await sql.query('select count(*)::int as n from exportaciones')).rows[0].n;
  await rechaza(preparar(PERFILES.t1, [casos.A, casos.C]), 'P0002');
  await rechaza(preparar(PERFILES.t1, [casos.D]), 'P0002');
  await rechaza(preparar(PERFILES.admin, [casos.E]), 'P0002');
  await rechaza(preparar(PERFILES.admin, ['00000000-0000-4000-8000-0000000000ee']), 'P0002');
  await rechaza(preparar(PERFILES.marketing, [casos.A]), '42501');
  await rechaza(sql.query('select preparar_exportacion_investigacion($1)', [[casos.A]]), '42501');
  assert.equal((await sql.query('select count(*)::int as n from exportaciones')).rows[0].n, antes);

  // Un documento insertado a mano también exige caso autorizado para quien prepara.
  const id = await preparar(PERFILES.t1, [casos.A]);
  await rechaza(como(PERFILES.t1, `insert into exportacion_documentos (exportacion_id, orden, archivo, caso_id, secciones)
    values ($1, 2, 'INV-002.docx', $2, '{seguimiento}')`, [id, casos.C]), '42501');
  await rechaza(como(PERFILES.t1, `insert into exportacion_documentos (exportacion_id, orden, archivo, caso_id, secciones)
    values ($1, 2, 'INV-001.docx', $2, '{seguimiento}')`, [id, casos.B]), '23514');
});

test('paquete: solo lo lee quien lo preparó o administración, y solo con el caso aún autorizado', opciones, async () => {
  const id = await preparar(PERFILES.t1, [casos.A, casos.B]);
  await rechaza(manifiesto(PERFILES.t2, id), 'P0002');
  await rechaza(documento(PERFILES.t2, id, 'INV-001'), 'P0002');
  await rechaza(manifiesto(PERFILES.marketing, id), 'P0002');
  await manifiesto(PERFILES.admin, id);
  await rechaza(documento(PERFILES.t1, id, 'INV-009'), 'P0002');

  // B pasa a t2: t1 ya no puede leer ese documento ni el manifiesto completo.
  const invB = (await docsDe(id)).find((d) => d.caso_id === casos.B).id_exportacion;
  const invA = (await docsDe(id)).find((d) => d.caso_id === casos.A).id_exportacion;
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update asignaciones_caso set perfil_id = $1 where caso_id = $2', [PERFILES.t2, casos.B]));
  try {
    await rechaza(documento(PERFILES.t1, id, invB), 'P0002');
    await rechaza(manifiesto(PERFILES.t1, id), 'P0002');
    await documento(PERFILES.t1, id, invA);
  } finally {
    await comoUsuario(sql, PERFILES.admin, () => sql.query('update asignaciones_caso set perfil_id = $1 where caso_id = $2', [PERFILES.t1, casos.B]));
  }
});

test('correspondencia: si cambian las categorías el paquete se rechaza; revisado no cambia', opciones, async () => {
  const id = await preparar(PERFILES.t1, [casos.A, casos.B]);
  const invB = (await docsDe(id)).find((d) => d.caso_id === casos.B).id_exportacion;
  const [extra] = await etiquetar(PERFILES.t1, { caso: casos.B, categoria: cat.c1a.id, sesion: sesiones.B1 });
  await assert.rejects(manifiesto(PERFILES.t1, id), (e) => e.code === 'FEX01' && JSON.parse(e.detail).includes(invB));
  await assert.rejects(documento(PERFILES.t1, id, invB), (e) => e.code === 'FEX01');
  await assert.rejects(como(PERFILES.t1, 'select marcar_revision_exportacion($1)', [id]), (e) => e.code === 'FEX01');
  await como(PERFILES.t1, 'delete from caso_categorias where id = $1', [extra.id]);

  await rechaza(como(PERFILES.t1, `update exportaciones set archivo_path = 'investigacion/x.zip' where id = $1`, [id]), '23514');
  await como(PERFILES.t1, 'select marcar_revision_exportacion($1)', [id]);
  const { rows: [e] } = await sql.query('select revisado_por, revisado_en from exportaciones where id = $1', [id]);
  assert.equal(e.revisado_por, PERFILES.t1);
  assert.ok(e.revisado_en);
  await rechaza(como(PERFILES.t1, 'select marcar_revision_exportacion($1)', [id]), '23514');
  await como(PERFILES.t1, `update exportaciones set archivo_path = 'investigacion/x.zip' where id = $1`, [id]);
  await rechaza(como(PERFILES.t1, `update exportaciones set archivo_path = 'investigacion/y.zip' where id = $1`, [id]), '23514');
  await rechaza(como(PERFILES.t1, `update exportaciones set parametros = '{}' where id = $1`, [id]), '23514');
  await rechaza(como(PERFILES.t1, `update exportacion_documentos set categorias = '{}' where exportacion_id = $1`, [id]), '23514');
  await rechaza(como(PERFILES.t1, `delete from exportacion_documentos where exportacion_id = $1 and orden = 1`, [id]), '23514');
  await rechaza(como(PERFILES.admin, `insert into exportacion_documentos (exportacion_id, orden, archivo, caso_id, secciones)
    values ($1, 3, 'INV-003.docx', $2, '{seguimiento}')`, [id, casos.D]), '23514');
  // El paquete completo sí se elimina, con sus documentos.
  await como(PERFILES.admin, 'delete from exportaciones where id = $1', [id]);
  assert.deepEqual(await docsDe(id), []);
  const { rows: aud } = await sql.query(`select accion from auditoria where tabla = 'exportaciones' and registro_id = $1 order by id`, [id]);
  assert.ok(aud.some((a) => a.accion === 'INSERT') && aud.some((a) => a.accion === 'DELETE'));
});

test('privacidad: manifiesto y documentos sin identificadores directos ni ids internos', opciones, async () => {
  const id = await preparar(PERFILES.admin, [casos.A, casos.B, casos.D], { secciones: ['diagnostico', 'seguimiento', 'tareas'] });
  const m = await manifiesto(PERFILES.admin, id);
  const docs = [];
  for (const e of m.documentos) docs.push(await documento(PERFILES.admin, id, e.idExportacion));
  const texto = JSON.stringify({ m, docs });
  const internos = [id, ...Object.values(casos), ...Object.values(sesiones), ...Object.values(fichas), ...Object.values(PERFILES)];
  for (const dato of [...IDENTIFICADORES, ...internos]) assert.ok(!texto.includes(dato), `El paquete incluye ${dato}`);
  for (const clave of ['nombreCompleto', 'telefono', 'fechaNacimiento', 'numeroCorrelativo', 'juzgado', 'nroExpediente', 'monto', 'casoId', 'fecha']) {
    assert.ok(!texto.includes(`"${clave}"`), `El paquete incluye la clave ${clave}`);
  }
  // El texto libre no se anonimiza solo: lo que se escribió en la evolución sale igual y se revisa antes de descargar.
  assert.ok(texto.includes('Evolución A1 de agosto'));
});

test('sin permisos para anon/authenticated en tablas y funciones nuevas', opciones, async () => {
  const { rows } = await sql.query(`select c.relname, c.relrowsecurity from pg_class c
    where c.relname in ('categorias_investigacion', 'caso_categorias', 'exportaciones', 'exportacion_documentos') order by 1`);
  assert.deepEqual(rows.map((r) => r.relrowsecurity), [true, true, true, true]);
  const { rows: publicas } = await sql.query(`select p.proname from pg_proc p
    where p.proname in ('seleccion_investigacion', 'conteo_categorias', 'preparar_exportacion_investigacion', 'manifiesto_exportacion',
                        'datos_documento_investigacion', 'marcar_revision_exportacion', 'casos_investigacion_autorizados')
      and has_function_privilege('public', p.oid, 'execute')`);
  assert.deepEqual(publicas, []);
});

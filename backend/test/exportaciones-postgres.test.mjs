// FE-158: consulta consistente y registro de exportaciones PDF/Word (migración 020).
// Contrato de docs/srs/sprint-3/FE-156-exportacion-documentos.md (propuesta). Datos ficticios.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
let A, B, sesA, sesB, vRevA, vBorradorA, vRevB, atlasId;
const ids = {};

const json = (v) => (v == null ? null : JSON.stringify(v));
const preparar = (usuario, casoId, parametros, datos = null) => comoUsuario(sql, usuario, async () =>
  (await sql.query('select preparar_exportacion_documento($1, $2, $3) as id', [casoId, json(parametros), json(datos)])).rows[0].id);
const vistaPrevia = (usuario, casoId, parametros) => comoUsuario(sql, usuario, async () =>
  (await sql.query('select datos_exportacion_actuales($1, $2) as d', [casoId, json(parametros)])).rows[0].d);
const llamar = (usuario, consulta, valores) => comoUsuario(sql, usuario, async () => (await sql.query(consulta, valores)).rows);
const leer = async (usuario, id) => (await llamar(usuario, 'select datos_exportacion_documento($1) as d', [id]))[0].d;
const fila = async (id) => (await sql.query('select * from exportaciones where id = $1', [id])).rows[0];
const sha = (texto) => createHash('sha256').update(texto).digest('hex');

const crearInforme = (casoId, usuario, tipo = 'intervencion_sistemica') => comoUsuario(sql, usuario, async () =>
  (await sql.query('insert into informes (caso_id, tipo) values ($1, $2) returning id', [casoId, tipo])).rows[0].id);
const guardarVersion = (informeId, casoId, sesiones, usuario) => comoUsuario(sql, usuario, async () => {
  const f = (await sql.query('select fotografia_informe($1, $2::uuid[]) as f', [casoId, sesiones])).rows[0].f;
  return (await sql.query(
    `insert into informe_versiones (informe_id, caso_id, version_plantilla, datos_origen, secciones)
     values ($1, $2, 'fe151-v1', $3, $4) returning id`,
    [informeId, casoId, json(f), json([{ titulo: 'Motivo', contenido: `Texto revisado ${casoId.slice(0, 4)}` }])])).rows[0].id;
});
const revisar = (versionId, usuario) => llamar(usuario,
  `update informe_versiones set estado = 'revisado' where id = $1`, [versionId]);

before(async () => {
  if (opciones.skip) return;
  // Datos cargados con 001–018; la 020 se aplica después, como en Supabase.
  base = await crearBase('fe158', { hasta: '018' });
  sql = base.cliente;

  // A: voluntario, terapeuta t1, ficha, dos sesiones (registradas fuera de orden), tareas, familia y pagos.
  A = await crearCaso(sql, { nombre: 'Lucía Exportación Ficticia', terapeuta: PERFILES.t1 });
  await llamar(PERFILES.t1, `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por) values ($1, '2026-10-05', $2, $3)`,
    [A.id, json({ diagnosticoIngreso: 'Diagnóstico ficticio A', hipotesisRelacional: 'Hipótesis A' }), PERFILES.t1]);
  sesA = {
    s2: await crearSesion(sql, A.id, { fecha: '2026-10-19', evolucion: 'Evolución A2' }),
    s1: await crearSesion(sql, A.id, { fecha: '2026-10-12', evolucion: 'Evolución A1' }),
  };
  for (const [sesion, d] of [[sesA.s1, 'Tarea A1'], [sesA.s2, 'Tarea A2']]) {
    await llamar(PERFILES.t1, 'insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, $3, $4)',
      [A.id, sesion.id, d, PERFILES.t1]);
  }
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query('insert into fichas_familiares (caso_id) values ($1)', [A.id]);
    await sql.query(`insert into familiares (caso_id, parentesco, nombre_completo, convive_con_paciente)
                     values ($1, 'madre', 'Madre Ficticia A', true), ($1, 'hermano', 'Hermano Ficticio A', false)`, [A.id]);
  });
  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-20', '40', 'qr')`, [A.id, sesA.s2.id]);
    await sql.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo, referencia)
                     values ($1, $2, '2026-10-12', '50.5', 'transferencia', 'TRX-QA-1')`, [A.id, sesA.s1.id]);
  });

  // B: derivado, terapeuta t2, sin ficha (diagnóstico del alta), contexto judicial, una sesión y un pago.
  B = await crearCaso(sql, { nombre: 'Mateo Exportación Ficticio', tipo: 'derivado', terapeuta: PERFILES.t2 });
  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`update casos set diagnostico_ingreso = 'Diagnóstico de alta B' where id = $1`, [B.id]);
    await sql.query(`insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion)
                     values ($1, 'Juzgado Ficticio B', 'EXP-QA-B', '2026-09-30')`, [B.id]);
  });
  sesB = await crearSesion(sql, B.id, { fecha: '2026-10-12', evolucion: 'Evolución B1', responsable: PERFILES.t2 });
  await llamar(PERFILES.admin, `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-12', '99', 'efectivo')`,
    [B.id, sesB.id]);

  // Informes (016): A revisado, A en borrador, B revisado.
  vRevA = await guardarVersion(await crearInforme(A.id, PERFILES.t1), A.id, [sesA.s1.id], PERFILES.t1);
  await revisar(vRevA, PERFILES.t1);
  vBorradorA = await guardarVersion(await crearInforme(A.id, PERFILES.t1, 'judicial'), A.id, [], PERFILES.t1);
  vRevB = await guardarVersion(await crearInforme(B.id, PERFILES.t2), B.id, [sesB.id], PERFILES.t2);
  await revisar(vRevB, PERFILES.t2);

  // Un paquete atlas_ti (018) ya preparado.
  atlasId = (await llamar(PERFILES.admin, `select preparar_exportacion_investigacion($1::uuid[], array['diagnostico']) as id`,
    [[A.id]]))[0].id;

  await base.migrar();
});

after(async () => {
  if (base) await base.cerrar();
});

test('la 020 se aplica sobre datos existentes y no cambia el paquete atlas_ti', opciones, async () => {
  const atlas = await fila(atlasId);
  assert.equal(atlas.tipo, 'atlas_ti');
  for (const campo of ['documento', 'informe_version_id', 'datos_origen', 'estado', 'archivo_nombre']) {
    assert.equal(atlas[campo], null, campo);
  }
  await llamar(PERFILES.admin, 'select marcar_revision_exportacion($1)', [atlasId]);
  await llamar(PERFILES.admin, `update exportaciones set archivo_path = 'investigacion/paquete.zip' where id = $1`, [atlasId]);
  const manifiesto = (await llamar(PERFILES.admin, 'select manifiesto_exportacion($1) as m', [atlasId]))[0].m;
  assert.equal(manifiesto.documentos.length, 1);
  // Un atlas_ti no admite campos de documento.
  await rechaza(sql.query(`update exportaciones set estado = 'generada' where id = $1`, [atlasId]), '23514');
});

test('historial de A (administración): secciones completas, sesiones en orden, pagos con dos decimales, nada de B', opciones, async () => {
  const id = await preparar(PERFILES.admin, A.id, { documento: 'historial', formato: 'pdf', incluirPagos: true });
  ids.historialAdmin = id;
  const f = await fila(id);
  assert.equal(f.tipo, 'pdf');
  assert.equal(f.estado, 'preparada');
  assert.equal(f.perfil_id, PERFILES.admin);
  assert.equal(f.documento, 'historial');
  assert.equal(f.archivo_nombre, `exportacion-${id}.pdf`);
  assert.ok(!f.archivo_nombre.includes('Lucía'));
  assert.deepEqual(f.parametros, {
    formatoVersion: 1, documento: 'historial', formato: 'pdf',
    secciones: ['identificacion', 'familia', 'diagnostico', 'sesiones'],
    informeVersionId: null, incluirGenograma: false, incluirPagos: true,
  });

  const d = f.datos_origen;
  assert.equal(d.caso.id, A.id);
  assert.equal(d.paciente.nombreCompleto, 'Lucía Exportación Ficticia');
  assert.equal(d.responsable.id, PERFILES.t1);
  assert.equal(d.judicial, null);
  assert.equal(d.diagnostico.origen, 'ficha');
  assert.deepEqual(d.familia.integrantes.map((x) => x.nombreCompleto), ['Madre Ficticia A', 'Hermano Ficticio A']);
  assert.deepEqual(d.sesiones.map((s) => s.evolucion), ['Evolución A1', 'Evolución A2']);
  assert.deepEqual(d.sesiones.map((s) => s.tareas.map((t) => t.descripcion)), [['Tarea A1'], ['Tarea A2']]);
  assert.deepEqual(d.pagos.map((p) => [p.fecha, p.monto, p.nroSesion, p.referencia]),
    [['2026-10-12', '50.50', 2, 'TRX-QA-1'], ['2026-10-20', '40.00', 1, null]]);
  assert.ok(d.pagos.every((p) => [sesA.s1.id, sesA.s2.id].includes(p.sesionId)));

  // Reutiliza la fotografía de FE-152: mismas sesiones, diagnóstico y familia.
  const foto = (await sql.query('select fotografia_informe($1, $2::uuid[], true) as f', [A.id, [sesA.s1.id, sesA.s2.id]])).rows[0].f;
  assert.deepEqual(d.sesiones, foto.sesiones);
  assert.deepEqual(d.diagnostico, foto.diagnostico);
  assert.deepEqual(d.familia, foto.familia);

  const texto = JSON.stringify(d);
  for (const ajeno of [B.id, B.pacienteId, sesB.id, 'Mateo', 'Juzgado Ficticio B', '99.00']) {
    assert.ok(!texto.includes(ajeno), `el historial de A contiene ${ajeno}`);
  }
});

test('ficha por defecto (terapeuta asignada): identificación y diagnóstico, sin sesiones, familia ni pagos', opciones, async () => {
  const id = await preparar(PERFILES.t1, A.id, { documento: 'ficha', formato: 'docx' });
  ids.fichaT1 = id;
  const f = await fila(id);
  assert.equal(f.tipo, 'word');
  assert.equal(f.archivo_nombre, `exportacion-${id}.docx`);
  assert.deepEqual(f.parametros.secciones, ['identificacion', 'diagnostico']);
  assert.deepEqual(Object.keys(f.datos_origen).sort(),
    ['caso', 'diagnostico', 'documento', 'judicial', 'paciente', 'responsable', 'seleccion']);

  // Secciones sin repetir y en el orden del documento.
  const id2 = await preparar(PERFILES.t1, A.id, { documento: 'historial', formato: 'pdf', secciones: ['sesiones', 'identificacion', 'sesiones'] });
  const f2 = await fila(id2);
  assert.deepEqual(f2.parametros.secciones, ['identificacion', 'sesiones']);
  assert.equal(f2.datos_origen.diagnostico, undefined);
  assert.equal(f2.datos_origen.pagos, undefined);
});

test('informe: solo una versión revisada del mismo caso, exportada tal como se revisó', opciones, async () => {
  const params = { documento: 'informe', formato: 'pdf', informeVersionId: vRevA };
  const id1 = await preparar(PERFILES.t1, A.id, params);
  ids.informeT1 = id1;
  const version = (await sql.query('select * from informe_versiones where id = $1', [vRevA])).rows[0];
  const f1 = await fila(id1);
  assert.equal(f1.informe_version_id, vRevA);
  assert.deepEqual(f1.datos_origen.secciones, version.secciones);
  assert.deepEqual(f1.datos_origen.fotografia, version.datos_origen);
  assert.equal(f1.datos_origen.informe.nroVersion, 1);
  assert.equal(f1.datos_origen.informe.huellaOrigen, version.huella_origen.toString('hex'));

  // El expediente cambia: el informe no se regenera; la ficha sí toma el dato nuevo.
  await llamar(PERFILES.t1, `update fichas_diagnostico set contenido = jsonb_set(contenido, '{diagnosticoIngreso}', '"Diagnóstico cambiado A"')
                             where caso_id = $1`, [A.id]);
  const f2 = await fila(await preparar(PERFILES.t1, A.id, params));
  assert.deepEqual(f2.datos_origen, f1.datos_origen);
  const ficha = await fila(await preparar(PERFILES.t1, A.id, { documento: 'ficha', formato: 'pdf' }));
  assert.equal(ficha.datos_origen.diagnostico.diagnosticoIngreso, 'Diagnóstico cambiado A');

  await rechaza(preparar(PERFILES.t1, A.id, { ...params, informeVersionId: vBorradorA }), '23514');
  await rechaza(preparar(PERFILES.t1, A.id, { ...params, informeVersionId: vRevB }), 'P0002');
  await rechaza(preparar(PERFILES.admin, A.id, { ...params, informeVersionId: vRevB }), 'P0002');
  await rechaza(preparar(PERFILES.t1, A.id, { ...params, informeVersionId: '00000000-0000-4000-8000-0000000000ff' }), 'P0002');
});

test('permisos: caso ajeno 404, marketing o sin usuario 42501, pagos solo administración', opciones, async () => {
  const historial = { documento: 'historial', formato: 'pdf' };
  await rechaza(preparar(PERFILES.t2, A.id, historial), 'P0002');
  await rechaza(preparar(PERFILES.t1, '00000000-0000-4000-8000-0000000000aa', historial), 'P0002');
  await rechaza(preparar(PERFILES.marketing, A.id, historial), '42501');
  await rechaza(sql.query('select preparar_exportacion_documento($1, $2)', [A.id, json(historial)]), '42501');
  await rechaza(preparar(PERFILES.t1, A.id, { ...historial, incluirPagos: true }), '42501');
  await rechaza(vistaPrevia(PERFILES.t1, A.id, { ...historial, incluirPagos: true }), '42501');
  assert.equal((await vistaPrevia(PERFILES.t1, A.id, historial)).pagos, undefined);
  // Carpeta dada de baja: como inexistente.
  const C = await crearCaso(sql, { nombre: 'Caso Baja Ficticio', terapeuta: PERFILES.t1 });
  await llamar(PERFILES.admin, 'update casos set deleted_at = now() where id = $1', [C.id]);
  await rechaza(preparar(PERFILES.admin, C.id, historial), 'P0002');
});

test('parámetros inválidos → 22023', opciones, async () => {
  const malos = [
    { documento: 'carta', formato: 'pdf' },
    { documento: 'ficha', formato: 'doc' },
    { documento: 'ficha' },
    { documento: 'ficha', formato: 'pdf', secciones: ['sesiones'] },
    { documento: 'ficha', formato: 'pdf', secciones: [] },
    { documento: 'ficha', formato: 'pdf', secciones: [null] },
    { documento: 'ficha', formato: 'pdf', incluirPagos: true },
    { documento: 'ficha', formato: 'pdf', informeVersionId: vRevA },
    { documento: 'historial', formato: 'pdf', secciones: 'sesiones' },
    { documento: 'historial', formato: 'pdf', incluirPagos: 'si' },
    { documento: 'historial', formato: 'pdf', formatoVersion: 2 },
    { documento: 'historial', formato: 'pdf', casoId: B.id },
    { documento: 'informe', formato: 'pdf' },
    { documento: 'informe', formato: 'pdf', informeVersionId: 'no-es-uuid' },
    { documento: 'informe', formato: 'pdf', informeVersionId: vRevA, secciones: ['diagnostico'] },
    { documento: 'informe', formato: 'pdf', informeVersionId: vRevA, incluirGenograma: true },
    [],
  ];
  for (const p of malos) {
    await rechaza(preparar(PERFILES.admin, A.id, p), '22023');
  }
  await rechaza(preparar(PERFILES.admin, A.id, null), '22023');
});

test('vista previa: lo mostrado es lo registrado; una vista previa vieja, alterada o de otro caso se rechaza', opciones, async () => {
  const params = { documento: 'historial', formato: 'docx' };
  const previa = await vistaPrevia(PERFILES.t1, A.id, params);
  const id = await preparar(PERFILES.t1, A.id, params, previa);
  assert.deepEqual((await fila(id)).datos_origen, previa);

  const alterada = { ...previa, paciente: { ...previa.paciente, nombreCompleto: 'Otro Nombre' } };
  await rechaza(preparar(PERFILES.t1, A.id, params, alterada), '23514');
  const deB = await vistaPrevia(PERFILES.t2, B.id, params);
  await rechaza(preparar(PERFILES.t1, A.id, params, deB), '23514');

  await crearSesion(sql, A.id, { fecha: '2026-10-26', evolucion: 'Evolución A3' });
  await rechaza(preparar(PERFILES.t1, A.id, params, previa), '23514');
});

test('registro directo: no se cruzan casos ni se registra un archivo al preparar', opciones, async () => {
  const historial = json({ documento: 'historial', formato: 'pdf' });
  const datosA = await vistaPrevia(PERFILES.admin, A.id, { documento: 'historial', formato: 'pdf' });
  const insertar = (columnas, valores) => llamar(PERFILES.admin,
    `insert into exportaciones (perfil_id, ${columnas}) values ($1, ${valores.map((_, i) => `$${i + 2}`).join(', ')})`,
    [PERFILES.admin, ...valores]);

  await rechaza(insertar('tipo, caso_id, parametros, datos_origen', ['pdf', B.id, historial, json(datosA)]), '23514');
  await rechaza(insertar('tipo, caso_id, parametros', ['word', A.id, historial]), '22023');
  await rechaza(insertar('tipo, caso_id, parametros', ['pdf', A.id,
    json({ documento: 'informe', formato: 'pdf', informeVersionId: vRevB })]), 'P0002');
  await rechaza(insertar('tipo, caso_id, parametros, archivo_path', ['pdf', A.id, historial, `${A.id}/x.pdf`]), '23514');
  await rechaza(insertar('tipo, parametros', ['pdf', historial]), 'P0002');

  // El autor lo pone la base aunque se envíe otro.
  const [{ id }] = await llamar(PERFILES.t1,
    'insert into exportaciones (perfil_id, tipo, caso_id, parametros) values ($1, $2, $3, $4) returning id',
    [PERFILES.admin, 'pdf', A.id, historial]);
  assert.equal((await fila(id)).perfil_id, PERFILES.t1);
});

test('archivo: ruta fija del caso, se registra una vez, sin cambios ni borrado; un fallo queda registrado', opciones, async () => {
  const id = await preparar(PERFILES.admin, A.id, { documento: 'ficha', formato: 'pdf' });
  ids.generada = id;
  const d = await leer(PERFILES.admin, id);
  assert.equal(d.archivoPath, `${A.id}/${id}.pdf`);
  assert.equal(d.archivoNombre, `exportacion-${id}.pdf`);
  assert.equal(d.estado, 'preparada');
  assert.equal(d.formato, 'pdf');
  assert.deepEqual(d.datos, (await fila(id)).datos_origen);

  await rechaza(llamar(PERFILES.admin, 'select archivo_exportacion($1)', [id]), '55000');
  await rechaza(llamar(PERFILES.admin, 'select registrar_archivo_exportacion($1, $2, 10)', [id, 'xyz']), '22023');
  await rechaza(llamar(PERFILES.admin, 'select registrar_archivo_exportacion($1, $2, 0)', [id, sha('a')]), '22023');
  // Ruta de otro caso, aunque se escriba directo.
  await rechaza(llamar(PERFILES.admin,
    `update exportaciones set estado = 'generada', archivo_path = $2, archivo_sha256 = decode($3, 'hex'), archivo_bytes = 1 where id = $1`,
    [id, `${B.id}/${id}.pdf`, sha('a')]), '23514');

  await llamar(PERFILES.admin, 'select registrar_archivo_exportacion($1, $2, 1234)', [id, sha('contenido')]);
  const f = await fila(id);
  assert.equal(f.estado, 'generada');
  assert.equal(f.archivo_path, `${A.id}/${id}.pdf`);
  assert.ok(f.generado_en);
  const archivo = (await llamar(PERFILES.admin, 'select archivo_exportacion($1) as a', [id]))[0].a;
  assert.deepEqual(archivo, { archivoPath: `${A.id}/${id}.pdf`, archivoNombre: `exportacion-${id}.pdf`,
    tipoContenido: 'application/pdf', bytes: 1234, sha256: sha('contenido') });

  await rechaza(llamar(PERFILES.admin, 'select registrar_archivo_exportacion($1, $2, 1)', [id, sha('otro')]), '23514');
  await rechaza(llamar(PERFILES.admin, 'select registrar_fallo_exportacion($1, $2)', [id, 'x']), '23514');
  for (const cambio of [`caso_id = '${B.id}'`, `datos_origen = '{}'`, `parametros = '{}'`, `perfil_id = '${PERFILES.t1}'`,
    `archivo_path = null`]) {
    await rechaza(llamar(PERFILES.admin, `update exportaciones set ${cambio} where id = $1`, [id]), '23514');
  }
  await rechaza(llamar(PERFILES.admin, 'delete from exportaciones where id = $1', [id]), '23514');
  // Última barrera, sin el trigger: la fotografía debe ser del caso registrado.
  await sql.query('begin');
  try {
    await sql.query('alter table exportaciones disable trigger trg_exportaciones_proteger_clinica');
    await rechaza(sql.query(`update exportaciones set datos_origen = jsonb_set(datos_origen, '{caso,id}', to_jsonb($2::text))
                             where id = $1`, [id, B.id]), '23514');
  } finally {
    await sql.query('rollback');
  }

  const fallida = await preparar(PERFILES.admin, A.id, { documento: 'ficha', formato: 'docx' });
  await llamar(PERFILES.admin, 'select registrar_fallo_exportacion($1, $2)', [fallida, '   ']);
  const ff = await fila(fallida);
  assert.equal(ff.estado, 'fallida');
  assert.equal(ff.error, 'Error del generador');
  assert.equal(ff.archivo_path, null);
  await rechaza(llamar(PERFILES.admin, 'select registrar_archivo_exportacion($1, $2, 10)', [fallida, sha('a')]), '23514');
  await rechaza(llamar(PERFILES.admin, 'select archivo_exportacion($1)', [fallida]), '55000');
  await rechaza(llamar(PERFILES.admin, 'delete from exportaciones where id = $1', [fallida]), '23514');

  // Auditoría: alta y cierre con su autor.
  const aud = (await sql.query(
    `select accion, usuario_id from auditoria where tabla = 'exportaciones' and registro_id = $1 order by id`, [id])).rows;
  assert.ok(aud.length >= 2, JSON.stringify(aud));
  assert.ok(aud.every((a) => a.usuario_id === PERFILES.admin));
});

test('lectura, descarga y trazabilidad: quien preparó o administración, mientras el caso siga autorizado', opciones, async () => {
  // Exportación de t1: t2 y marketing no la ven; administración sí.
  await leer(PERFILES.t1, ids.fichaT1);
  await leer(PERFILES.admin, ids.fichaT1);
  await rechaza(leer(PERFILES.t2, ids.fichaT1), 'P0002');
  await rechaza(leer(PERFILES.marketing, ids.fichaT1), 'P0002');
  await rechaza(sql.query('select datos_exportacion_documento($1)', [ids.fichaT1]), '42501');
  // Con pagos: solo administración, aunque el caso sea de la terapeuta.
  await rechaza(leer(PERFILES.t1, ids.historialAdmin), 'P0002');
  // El atlas_ti no se lee por aquí.
  await rechaza(leer(PERFILES.admin, atlasId), 'P0002');
  // Quien exportó pagos como administración y pasa a terapeuta (asignada) deja de verlos.
  const exAdmin = '00000000-0000-4000-8000-000000000005';
  await sql.query('insert into auth.users (id) values ($1)', [exAdmin]);
  await sql.query(`insert into perfiles (id, nombre_completo, rol) values ($1, 'ex admin QA', 'administrador')`, [exAdmin]);
  const conPagos = await preparar(exAdmin, A.id, { documento: 'historial', formato: 'pdf', incluirPagos: true });
  await leer(exAdmin, conPagos);
  await llamar(PERFILES.admin, `update perfiles set rol = 'terapeuta' where id = $1`, [exAdmin]);
  await llamar(PERFILES.admin, 'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [A.id, exAdmin]);
  try {
    await rechaza(leer(exAdmin, conPagos), 'P0002');
    await rechaza(llamar(exAdmin, 'select archivo_exportacion($1)', [conPagos]), 'P0002');
  } finally {
    await llamar(PERFILES.admin, 'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [A.id, PERFILES.t1]);
  }

  const lista = async (usuario, caso) => llamar(usuario, 'select * from exportaciones_documentos_caso($1)', [caso]);
  const deAdmin = await lista(PERFILES.admin, A.id);
  assert.ok(deAdmin.some((r) => r.exportacion_id === ids.historialAdmin && r.incluir_pagos));
  assert.ok(deAdmin.some((r) => r.exportacion_id === ids.fichaT1));
  const informe = deAdmin.find((r) => r.exportacion_id === ids.informeT1);
  assert.deepEqual([informe.documento, informe.formato, informe.nro_version, informe.perfil_nombre], ['informe', 'pdf', 1, 't1 QA']);
  const generada = deAdmin.find((r) => r.exportacion_id === ids.generada);
  assert.equal(generada.estado, 'generada');
  const deT1 = await lista(PERFILES.t1, A.id);
  assert.ok(deT1.length > 0 && deT1.every((r) => r.perfil_id === PERFILES.t1));
  await rechaza(lista(PERFILES.t2, A.id), 'P0002');
  await rechaza(lista(PERFILES.marketing, A.id), '42501');
  const deB = await lista(PERFILES.admin, B.id);
  assert.ok(deB.every((r) => !deAdmin.some((x) => x.exportacion_id === r.exportacion_id)));

  // Si A pasa a t2, t1 deja de ver sus exportaciones de A.
  await llamar(PERFILES.admin, 'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [A.id, PERFILES.t2]);
  try {
    await rechaza(leer(PERFILES.t1, ids.fichaT1), 'P0002');
    await rechaza(lista(PERFILES.t1, A.id), 'P0002');
    await rechaza(leer(PERFILES.t2, ids.fichaT1), 'P0002');
  } finally {
    await llamar(PERFILES.admin, 'update asignaciones_caso set perfil_id = $2 where caso_id = $1', [A.id, PERFILES.t1]);
  }
  await leer(PERFILES.t1, ids.fichaT1);
});

test('genograma: requiere la migración 012', opciones, async () => {
  const params = { documento: 'historial', formato: 'pdf', incluirGenograma: true };
  const con012 = (await sql.query(`select to_regclass('public.genograma_archivos') is not null as hay`)).rows[0].hay;
  if (!con012) {
    await rechaza(preparar(PERFILES.t1, A.id, params), '0A000');
    return;
  }
  const f = await fila(await preparar(PERFILES.t1, A.id, params));
  assert.deepEqual(f.datos_origen.genograma, { vigente: false });
});

test('anon y authenticated no acceden (si existen)', opciones, async () => {
  const funciones = (await sql.query(
    `select p.proname, has_function_privilege('public', p.oid, 'execute') as publico
       from pg_proc p where p.pronamespace = 'public'::regnamespace
        and p.proname in ('preparar_exportacion_documento', 'datos_exportacion_actuales', 'datos_exportacion_documento',
                          'registrar_archivo_exportacion', 'archivo_exportacion', 'exportaciones_documentos_caso',
                          'fotografia_exportacion')`)).rows;
  assert.equal(funciones.length, 7);
  assert.ok(funciones.every((f) => !f.publico), JSON.stringify(funciones));
});

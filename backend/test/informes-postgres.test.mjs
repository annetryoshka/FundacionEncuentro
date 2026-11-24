// FE-152: fotografía de datos y versiones de informes (migración 016).
// Casos A y B de docs/srs/sprint-3/FE-151-plantillas-informes.md, sección 6.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
let A, B, sesA, sesB, fichaA;

const fotografia = async (casoId, sesiones = [], familia = false, genograma = false, cliente = sql) =>
  (await cliente.query('select fotografia_informe($1, $2::uuid[], $3, $4) as f', [casoId, sesiones, familia, genograma]))
    .rows[0].f;

const crearInforme = (casoId, tipo = 'intervencion_sistemica', usuario = PERFILES.t1) =>
  comoUsuario(sql, usuario, async () =>
    (await sql.query('insert into informes (caso_id, tipo) values ($1, $2) returning id, generado_por', [casoId, tipo]))
      .rows[0]);

// Igual que hará FE-153: leer la fotografía y guardarla con el texto en la misma transacción.
const guardarVersion = (informeId, casoId, datos, usuario = PERFILES.t1, secciones = [{ titulo: 'Motivo', contenido: null }]) =>
  comoUsuario(sql, usuario, async () => (await sql.query(
    `insert into informe_versiones (informe_id, caso_id, version_plantilla, datos_origen, secciones)
     values ($1, $2, 'fe151-v1', $3, $4)
     returning id, nro_version, estado, creado_por, encode(huella_origen, 'hex') as huella, ficha_diagnostico_id`,
    [informeId, casoId, JSON.stringify(datos), JSON.stringify(secciones)])).rows[0]);

const version = async (id) => (await sql.query('select * from informe_versiones where id = $1', [id])).rows[0];
const alDia = async (id, cliente = sql) =>
  (await cliente.query('select informe_version_al_dia($1) as r', [id])).rows[0].r;

const cambiarDiagnostico = (casoId, texto, usuario = PERFILES.t1) => comoUsuario(sql, usuario, () => sql.query(
  `update fichas_diagnostico set contenido = jsonb_set(contenido, '{diagnosticoIngreso}', to_jsonb($2::text))
   where caso_id = $1`, [casoId, texto]));

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe152');
  sql = base.cliente;

  // Caso A: ficha de diagnóstico, tres sesiones (registradas fuera de orden), tareas y familia.
  A = await crearCaso(sql, { nombre: 'Lucía Prueba Ficticia', terapeuta: PERFILES.t1 });
  fichaA = await comoUsuario(sql, PERFILES.t1, async () => (await sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por)
     values ($1, '2026-10-05', $2, $3) returning id`,
    [A.id, { diagnosticoIngreso: 'Diagnóstico ficticio A', hipotesisRelacional: 'Hipótesis ficticia A',
      comentariosClinicos: null }, PERFILES.t1])).rows[0].id);
  sesA = {
    s3: await crearSesion(sql, A.id, { fecha: '2026-10-26', evolucion: 'Evolución A3' }),
    s1: await crearSesion(sql, A.id, { fecha: '2026-10-12', evolucion: 'Evolución A1' }),
    s2: await crearSesion(sql, A.id, { fecha: '2026-10-19', evolucion: 'Evolución A2' }),
  };
  // Una transacción por tarea, como la API: el orden es el de creado_en (igual que historial y tareas).
  for (const [sesion, d] of [[sesA.s1, 'Tarea A1-a'], [sesA.s1, 'Tarea A1-b'], [sesA.s2, 'Tarea A2']]) {
    await comoUsuario(sql, PERFILES.t1, () => sql.query(
      'insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, $3, $4)',
      [A.id, sesion.id, d, PERFILES.t1]));
  }
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query('insert into fichas_familiares (caso_id) values ($1)', [A.id]);
    await sql.query(`insert into familiares (caso_id, parentesco, nombre_completo, convive_con_paciente)
                     values ($1, 'madre', 'Madre Ficticia A', true), ($1, 'hermano', 'Hermano Ficticio A', false)`, [A.id]);
  });

  // Caso B: derivado, sin ficha (solo datos clínicos del alta), con contexto judicial y una sesión.
  B = await crearCaso(sql, { nombre: 'Mateo Prueba Ficticio', tipo: 'derivado', terapeuta: PERFILES.t2 });
  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`update casos set diagnostico_ingreso = 'Diagnóstico de alta B' where id = $1`, [B.id]);
    await sql.query(`insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion)
                     values ($1, 'Juzgado Ficticio 1', 'EXP-QA-001', '2026-09-30')`, [B.id]);
  });
  sesB = await crearSesion(sql, B.id, { fecha: '2026-10-14', evolucion: 'Evolución B1', responsable: PERFILES.t2 });
});

after(async () => {
  if (base) await base.cerrar();
});

test('caso A: solo las sesiones elegidas, sin repetir, en orden de fecha y con sus tareas', opciones, async () => {
  const f = await fotografia(A.id, [sesA.s2.id, sesA.s1.id, sesA.s2.id]);

  assert.deepEqual(f.seleccion, { sesionesIds: [sesA.s1.id, sesA.s2.id], incluirFamilia: false, incluirGenograma: false });
  assert.deepEqual(f.sesiones.map((s) => [s.evolucion, s.nroSesion]), [['Evolución A1', 2], ['Evolución A2', 3]]);
  assert.deepEqual(f.sesiones[0].tareas.map((t) => t.descripcion), ['Tarea A1-a', 'Tarea A1-b']);
  assert.deepEqual(f.sesiones[1].tareas.map((t) => t.descripcion), ['Tarea A2']);
  assert.equal(f.caso.id, A.id);
  assert.equal(f.paciente.nombreCompleto, 'Lucía Prueba Ficticia');
  assert.deepEqual(f.responsable, { id: PERFILES.t1, nombreCompleto: 't1 QA' });
  assert.equal(f.diagnostico.origen, 'ficha');
  assert.equal(f.diagnostico.fichaId, fichaA);
  assert.equal(f.diagnostico.diagnosticoIngreso, 'Diagnóstico ficticio A');
  assert.equal(f.diagnostico.comentariosClinicos, null);
  assert.equal(f.judicial, null);
  assert.equal(f.familia, null, 'familia no incluida');
  assert.equal(f.genograma, null, 'genograma no incluido');
});

test('caso B: sin ficha usa el alta como antecedente y no toma nada del caso A', opciones, async () => {
  const f = await fotografia(B.id, [sesB.id], true);
  const texto = JSON.stringify(f);

  assert.equal(f.diagnostico.origen, 'alta');
  assert.equal(f.diagnostico.diagnosticoIngreso, 'Diagnóstico de alta B');
  assert.equal(f.diagnostico.fichaId, null);
  assert.deepEqual(f.judicial, { juzgado: 'Juzgado Ficticio 1', nroExpediente: 'EXP-QA-001',
    fechaDerivacion: '2026-09-30', observaciones: null });
  assert.deepEqual(f.familia, { registrada: false }, 'sin composición familiar registrada');
  assert.deepEqual(f.sesiones.map((s) => s.evolucion), ['Evolución B1']);
  for (const ajeno of [A.id, fichaA, sesA.s1.id, 'Lucía', 'ficticio A', 'Tarea A']) {
    assert.ok(!texto.includes(ajeno), `la fotografía de B contiene ${ajeno}`);
  }
});

test('una sesión de otro caso o inexistente se rechaza; un caso inexistente también', opciones, async () => {
  await rechaza(fotografia(A.id, [sesA.s1.id, sesB.id]), '23514');
  await rechaza(fotografia(A.id, ['00000000-0000-4000-8000-0000000000ff']), '23514');
  await rechaza(fotografia('00000000-0000-4000-8000-0000000000ff'), 'P0002');
});

test('familia incluida: versión de la ficha familiar e integrantes en orden de registro', opciones, async () => {
  const f = await fotografia(A.id, [], true);
  assert.equal(f.familia.registrada, true);
  assert.equal(f.familia.version, 1);
  assert.deepEqual(f.familia.integrantes.map((i) => [i.parentesco, i.nombreCompleto, i.conviveConPaciente]),
    [['madre', 'Madre Ficticia A', true], ['hermano', 'Hermano Ficticio A', false]]);
});

test('guardar una versión: borrador nº 1, autoría, sesiones citadas y huella', opciones, async () => {
  const informe = await crearInforme(A.id);
  const f = await fotografia(A.id, [sesA.s2.id, sesA.s1.id], true);
  const v = await guardarVersion(informe.id, A.id, f);

  assert.equal(informe.generado_por, PERFILES.t1);
  assert.equal(v.nro_version, 1);
  assert.equal(v.estado, 'borrador');
  assert.equal(v.creado_por, PERFILES.t1);
  assert.equal(v.ficha_diagnostico_id, fichaA);
  const { rows } = await sql.query(
    'select sesion_id, orden, caso_id from informe_version_sesiones where version_id = $1 order by orden', [v.id]);
  assert.deepEqual(rows.map((r) => [r.sesion_id, r.orden, r.caso_id]), [[sesA.s1.id, 1, A.id], [sesA.s2.id, 2, A.id]]);
  const texto = (await sql.query('select datos_origen::text as t from informe_versiones where id = $1', [v.id])).rows[0].t;
  assert.equal(v.huella, createHash('sha256').update(texto, 'utf8').digest('hex'));
  assert.equal(await alDia(v.id), true);
});

test('no se guarda una fotografía alterada, de otro caso o desactualizada', opciones, async () => {
  const informe = await crearInforme(A.id);
  const f = await fotografia(A.id, [sesA.s1.id]);

  // Texto clínico inventado.
  await rechaza(guardarVersion(informe.id, A.id,
    { ...f, diagnostico: { ...f.diagnostico, diagnosticoIngreso: 'Conclusión inventada' } }), '23514');
  // Sesión de otro caso añadida a la fotografía.
  const conAjena = { ...f, seleccion: { ...f.seleccion, sesionesIds: [sesA.s1.id, sesB.id] } };
  await rechaza(guardarVersion(informe.id, A.id, conAjena), '23514');
  // Fotografía del caso B en un informe del caso A.
  await rechaza(guardarVersion(informe.id, A.id, await fotografia(B.id, [sesB.id])), '23514');
  // Versión con el caso B colgada del informe del caso A.
  await rechaza(guardarVersion(informe.id, B.id, await fotografia(B.id, [sesB.id]), PERFILES.t2), '23503');

  // Diagnóstico cambiado entre la lectura y el guardado: fuente antigua.
  await cambiarDiagnostico(A.id, 'Diagnóstico ficticio A (corregido)');
  await rechaza(guardarVersion(informe.id, A.id, f), '23514');
  const vigente = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id]));
  assert.equal(vigente.nro_version, 1, 'los intentos rechazados no consumen número');
  await cambiarDiagnostico(A.id, 'Diagnóstico ficticio A');
});

test('borrador editable con autoría; un solo borrador abierto; no se crea ya revisado', opciones, async () => {
  const informe = await crearInforme(A.id);
  const v = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id]));

  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update informe_versiones set secciones = $2 where id = $1`,
    [v.id, JSON.stringify([{ titulo: 'Motivo', contenido: 'Motivo escrito por la profesional (ficticio).' }])]));
  const editada = await version(v.id);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  assert.equal(editada.creado_por, PERFILES.t1);
  const { rows: aud } = await sql.query(
    `select usuario_id, datos_anteriores -> 'secciones' as antes from auditoria
      where tabla = 'informe_versiones' and registro_id = $1 and accion = 'UPDATE'`, [v.id]);
  assert.deepEqual(aud.map((a) => [a.usuario_id, a.antes]), [[PERFILES.admin, [{ titulo: 'Motivo', contenido: null }]]]);

  await rechaza(guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id])), '23505');
  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `update informe_versiones set datos_origen = jsonb_set(datos_origen, '{paciente,nombreCompleto}', '"Otro"')
      where id = $1`, [v.id])), '23514');
  const otro = await crearInforme(A.id);
  const datos = JSON.stringify(await fotografia(A.id));
  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into informe_versiones (informe_id, caso_id, version_plantilla, datos_origen, estado, revisado_por, revisado_en)
     values ($1, $2, 'fe151-v1', $3, 'revisado', $4, now())`,
    [otro.id, A.id, datos, PERFILES.t1])), '23514');
});

test('revisar es definitivo y un cambio posterior del expediente genera otra versión', opciones, async () => {
  const informe = await crearInforme(A.id);
  const v1 = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id, sesA.s2.id]));

  await comoUsuario(sql, PERFILES.t1, () => sql.query(`update informe_versiones set estado = 'revisado' where id = $1`, [v1.id]));
  const revisada = await version(v1.id);
  assert.equal(revisada.revisado_por, PERFILES.t1);
  assert.ok(revisada.revisado_en);

  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `update informe_versiones set secciones = '[]' where id = $1`, [v1.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `update informe_versiones set estado = 'borrador' where id = $1`, [v1.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('delete from informe_versiones where id = $1', [v1.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    'delete from informe_version_sesiones where version_id = $1', [v1.id])), '23514');

  // El diagnóstico cambia después de revisar.
  await cambiarDiagnostico(A.id, 'Diagnóstico ficticio A v2');
  assert.equal(await alDia(v1.id), false);
  assert.equal((await version(v1.id)).datos_origen.diagnostico.diagnosticoIngreso, 'Diagnóstico ficticio A');

  const v2 = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id, sesA.s2.id]));
  assert.equal(v2.nro_version, 2);
  assert.notEqual(v2.huella, (await sql.query(`select encode(huella_origen, 'hex') as h from informe_versiones
                                                 where id = $1`, [v1.id])).rows[0].h);
  assert.equal((await version(v2.id)).datos_origen.diagnostico.diagnosticoIngreso, 'Diagnóstico ficticio A v2');
  assert.equal((await version(v1.id)).estado, 'revisado');
  await cambiarDiagnostico(A.id, 'Diagnóstico ficticio A');
});

test('un borrador se puede descartar y se lleva sus sesiones citadas', opciones, async () => {
  const informe = await crearInforme(A.id);
  const v = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s3.id]));
  await comoUsuario(sql, PERFILES.t1, () => sql.query('delete from informe_versiones where id = $1', [v.id]));
  const { rows } = await sql.query('select count(*)::int as n from informe_version_sesiones where version_id = $1', [v.id]);
  assert.equal(rows[0].n, 0);
  const { rows: aud } = await sql.query(
    `select count(*)::int as n from auditoria where tabla = 'informe_versiones' and registro_id = $1 and accion = 'DELETE'`, [v.id]);
  assert.equal(aud[0].n, 1, 'el borrador descartado queda en auditoría');
});

test('una sesión citada no se puede borrar y el informe no cambia de caso ni de tipo', opciones, async () => {
  const informe = await crearInforme(B.id, 'judicial', PERFILES.t2);
  await guardarVersion(informe.id, B.id, await fotografia(B.id, [sesB.id]), PERFILES.t2);

  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('delete from fichas_seguimiento where id = $1', [sesB.id])), '23503');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update informes set tipo = 'intervencion_sistemica' where id = $1`, [informe.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    'update informes set caso_id = $2 where id = $1', [informe.id, A.id])), '23514');
});

test('la comprobación no depende de la zona horaria de la conexión', opciones, async () => {
  const informe = await crearInforme(A.id);
  const v = await guardarVersion(informe.id, A.id, await fotografia(A.id, [sesA.s1.id], true));
  const otra = await base.conectar();
  try {
    await otra.query(`set time zone 'Asia/Tokyo'`);
    assert.equal(await alDia(v.id, otra), true);
    assert.equal((await fotografia(A.id, [sesA.s1.id], true, false, otra)).diagnostico.fichaActualizadaEn,
      (await version(v.id)).datos_origen.diagnostico.fichaActualizadaEn);
  } finally {
    await otra.end();
  }
});

test('genograma: sin la migración 012 se informa en lugar de omitirlo', opciones, async (t) => {
  const { rows } = await sql.query(`select to_regclass('public.genograma_archivos') is not null as hay`);
  if (rows[0].hay) return t.skip('la base tiene la 012: ver la prueba siguiente');
  await rechaza(fotografia(A.id, [], false, true), '0A000');
});

test('genograma (con 012): archivo vigente del mismo caso, sin contenido', opciones, async (t) => {
  const { rows } = await sql.query(`select to_regclass('public.genograma_archivos') is not null as hay`);
  if (!rows[0].hay) return t.skip('requiere la migración 012 (FE-130)');

  const sinArchivo = await fotografia(B.id, [], false, true);
  assert.deepEqual(sinArchivo.genograma, { vigente: false });

  const clave = `${A.id}/${'1'.repeat(8)}-1111-4111-8111-${'1'.repeat(12)}`;
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query(`insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido)
                     values ($1, $2, 'image/png', 3, '\\x010203')`, [clave, A.id]);
    await sql.query(`update genograma_archivos set activado_en = now(), nombre = 'genograma-a.png', subido_por = $2
                      where clave = $1`, [clave, PERFILES.t1]);
    await sql.query(`insert into genogramas (caso_id, archivo_clave) values ($1, $2)
                     on conflict (caso_id) do update set archivo_clave = excluded.archivo_clave`, [A.id, clave]);
  });
  const f = await fotografia(A.id, [], false, true);
  assert.equal(f.genograma.clave, clave);
  assert.equal(f.genograma.nombre, 'genograma-a.png');
  assert.equal(f.genograma.sha256, createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex'));
  assert.ok(!('contenido' in f.genograma));

  const informe = await crearInforme(A.id);
  const v = await guardarVersion(informe.id, A.id, f);
  assert.equal((await version(v.id)).genograma_clave, clave);
});

test('RLS activa en las tablas nuevas y funciones sin SECURITY DEFINER', opciones, async () => {
  const { rows } = await sql.query(
    `select relname, relrowsecurity from pg_class where relname in ('informe_versiones', 'informe_version_sesiones')
      order by relname`);
  assert.deepEqual(rows.map((r) => [r.relname, r.relrowsecurity]),
    [['informe_version_sesiones', true], ['informe_versiones', true]]);
  const { rows: fn } = await sql.query(
    `select proname from pg_proc where proname in ('fotografia_informe', 'informe_version_al_dia') and prosecdef`);
  assert.deepEqual(fn, []);
});

test('la migración 016 no cambia datos existentes', opciones, async () => {
  const previa = await crearBase('fe152m', { hasta: '015' });
  try {
    const c = previa.cliente;
    const caso = await crearCaso(c, { nombre: 'Paciente Previo Ficticio', terapeuta: PERFILES.t1 });
    await crearSesion(c, caso.id);
    await comoUsuario(c, PERFILES.t1, () => c.query(
      `insert into informes (caso_id, tipo, generado_por) values ($1, 'judicial', $2)`, [caso.id, PERFILES.t1]));
    const huella = async () => (await c.query(
      `select (select md5(string_agg(t::text, '|' order by t::text)) from informes t) as informes,
              (select md5(string_agg(t::text, '|' order by t::text)) from casos t) as casos,
              (select md5(string_agg(t::text, '|' order by t::text)) from fichas_seguimiento t) as sesiones,
              (select count(*) from auditoria) as auditoria`)).rows[0];
    const antes = await huella();
    await previa.migrar();
    assert.deepEqual(await huella(), antes);
  } finally {
    await previa.cerrar();
  }
});

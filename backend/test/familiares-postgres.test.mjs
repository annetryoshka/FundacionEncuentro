// FE-125: familiares por caso, migración 015 sobre datos existentes y fuente clínica vigente.
// Fichas A y B y reglas de docs/srs/sprint-3/FE-123-ficha-familiar-y-diagnostico.md (secciones 2, 3, 6 y 7).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, casos;
const REFERENCIA = '2026-11-20';
const hoyBolivia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
const pasadoManana = () => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

// Huella de cada tabla: cantidad de filas y md5 del contenido completo.
async function huella(cliente) {
  const { rows: tablas } = await cliente.query(`select tablename from pg_tables where schemaname = 'public' order by 1`);
  const resultado = {};
  for (const { tablename } of tablas) {
    const { rows } = await cliente.query(
      `select count(*)::int as filas, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as md5
         from public."${tablename}" t`);
    resultado[tablename] = rows[0];
  }
  return resultado;
}

const COLUMNAS = ['parentesco', 'parentesco_detalle', 'nombre_completo', 'fecha_nacimiento', 'edad_referida',
  'fecha_referencia', 'ocupacion', 'lugar_trabajo_estudio', 'convive_con_paciente', 'observaciones'];

const insertarFamiliar = (casoId, datos) => sql.query(
  `insert into familiares (caso_id, ${COLUMNAS.join(', ')})
   values ($1, ${COLUMNAS.map((_, i) => `$${i + 2}`).join(', ')}) returning id`,
  [casoId, ...COLUMNAS.map((c) => datos[c] ?? null)]).then((r) => r.rows[0].id);

/** Registra la composición familiar (cabecera + integrantes) en una transacción. */
const registrarFamilia = (casoId, integrantes, usuario = PERFILES.t1) => comoUsuario(sql, usuario, async () => {
  await sql.query('insert into fichas_familiares (caso_id) values ($1)', [casoId]);
  const ids = [];
  for (const datos of integrantes) ids.push(await insertarFamiliar(casoId, datos));
  return ids;
});

const familia = async (casoId) => (await sql.query(
  `select id, ${COLUMNAS.join(', ')}, to_char(fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
          to_char(fecha_referencia, 'YYYY-MM-DD') as fecha_referencia, creado_por, actualizado_por
     from familiares where caso_id = $1 and deleted_at is null order by orden_registro`, [casoId])).rows;

const cabecera = async (casoId) => (await sql.query(
  'select id, version, creado_por, actualizado_por from fichas_familiares where caso_id = $1', [casoId])).rows[0] ?? null;

// Forma que puede usar FE-126: bloquear la cabecera, comparar la versión y aplicar los cambios.
async function guardarConVersion(cliente, usuario, casoId, versionEsperada, cambios) {
  return comoUsuario(cliente, usuario, async () => {
    const { rows } = await cliente.query('select version from fichas_familiares where caso_id = $1 for update', [casoId]);
    if (rows[0].version !== versionEsperada) throw Object.assign(new Error('Versión desactualizada'), { code: 'conflicto' });
    await cambios(cliente);
    return (await cliente.query('select version from fichas_familiares where caso_id = $1', [casoId])).rows[0].version;
  });
}

// Misma autorización que DiagnosticoService.verificarAcceso: administración o terapeuta asignada.
const familiaVisible = async (rol, usuario, casoId) => (await sql.query(
  `select f.id from familiares f
     join casos c on c.id = f.caso_id
     join pacientes p on p.id = c.paciente_id
    where f.caso_id = $3 and f.deleted_at is null and c.deleted_at is null and p.deleted_at is null
      and ($1::text = 'administrador'
           or ($1::text = 'terapeuta' and exists (
                 select 1 from asignaciones_caso where caso_id = $3 and perfil_id = $2)))`,
  [rol, usuario, casoId])).rows.length;

// Mismo upsert que DiagnosticoService.guardar: reemplaza todo el JSON de la ficha.
const guardarDiagnostico = (casoId, contenido, usuario = PERFILES.t1) => comoUsuario(sql, usuario, () => sql.query(
  `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
   values ($1, '2026-11-21', $2::jsonb, $3, $3)
   on conflict (caso_id) do update set fecha = excluded.fecha, contenido = excluded.contenido,
     actualizado_por = excluded.actualizado_por`, [casoId, JSON.stringify(contenido), usuario]));

before(async () => {
  if (opciones.skip) return;
  // Base con las migraciones anteriores y datos ficticios del Sprint 2; la 015 se aplica después.
  base = await crearBase('fe125', { hasta: '014' }); sql = base.cliente;
  const A = await crearCaso(sql, { nombre: 'QA ficha A', estado: 'en_proceso', terapeuta: PERFILES.t1 });
  const B = await crearCaso(sql, { nombre: 'QA ficha B', estado: 'iniciado', terapeuta: PERFILES.t1, tipo: 'derivado' });
  const C = await crearCaso(sql, { nombre: 'QA caso C', terapeuta: PERFILES.t2 });
  const D = await crearCaso(sql, { nombre: 'QA caso D' });
  casos = { A, B, C, D };
  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`update pacientes set fecha_nacimiento = '2014-03-02' where id = $1`, [A.pacienteId]);
    await sql.query(`update pacientes set fecha_nacimiento = '1980-06-15' where id = $1`, [B.pacienteId]);
    // Datos clínicos del alta en A, B y C; D no tiene.
    await sql.query(`update casos set diagnostico_ingreso = 'Alta A: conflicto familiar', hipotesis_relacional = 'Alta A: hipótesis'
                      where id = $1`, [A.id]);
    await sql.query(`update casos set diagnostico_ingreso = 'Alta B: derivación judicial' where id = $1`, [B.id]);
    await sql.query(`update casos set comentarios_clinicos = 'Alta C: comentario' where id = $1`, [C.id]);
    await sql.query(`insert into genogramas (caso_id, datos) values ($1, '{"nodos": 5}')`, [A.id]);
  });
  // A tiene ficha; su hipótesis se dejó en NULL a propósito y guarda un campo que la API actual no conoce.
  await comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
     values ($1, '2026-10-05', $2::jsonb, $3, $3)`,
    [A.id, JSON.stringify({ diagnosticoIngreso: 'Ficha A: crisis vital', hipotesisRelacional: null,
      comentariosClinicos: 'Ficha A: comentario', campoAnterior: 'se conserva' }), PERFILES.t1]));
  const sesion = await crearSesion(sql, A.id, { fecha: '2026-10-12' });
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query(`insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, 'Tarea QA', $3)`,
      [A.id, sesion.id, PERFILES.t1]);
    await sql.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-12', '50.00', 'efectivo')`,
      [A.id, sesion.id]);
  });
});
after(async () => { await base?.cerrar(); });

test('FE-125: la migración 015 se aplica sobre datos existentes sin cambiar ninguna tabla', opciones, async () => {
  const antes = await huella(sql);
  for (const tabla of ['casos', 'pacientes', 'fichas_diagnostico', 'genogramas', 'fichas_seguimiento',
    'tareas_terapeuticas', 'pagos', 'asignaciones_caso', 'auditoria']) {
    assert.ok(antes[tabla].filas > 0, `${tabla} debe tener datos antes de migrar`);
  }
  assert.equal(antes.familiares, undefined);
  await base.migrar();
  const despues = await huella(sql);
  for (const [tabla, valor] of Object.entries(antes)) assert.deepEqual(despues[tabla], valor, `cambió ${tabla}`);
  const nuevas = Object.keys(despues).filter((t) => !(t in antes));
  assert.ok(nuevas.includes('familiares') && nuevas.includes('fichas_familiares'), nuevas.join(', '));
  // Nadie recibe familia automáticamente: todos los casos quedan "sin registrar".
  assert.equal(despues.fichas_familiares.filas, 0);
  assert.equal(despues.familiares.filas, 0);
  const { rows } = await sql.query(
    `select relname, relrowsecurity from pg_class where relname in ('familiares', 'fichas_familiares') order by 1`);
  assert.deepEqual(rows, [{ relname: 'familiares', relrowsecurity: true }, { relname: 'fichas_familiares', relrowsecurity: true }]);
});

test('FE-125: fuente clínica vigente; ficha primero, alta como antecedente, sin rellenar NULL', opciones, async () => {
  const { rows } = await sql.query(
    `select caso_id, origen, diagnostico_ingreso, hipotesis_relacional, comentarios_clinicos,
            alta_diagnostico_ingreso, alta_hipotesis_relacional, alta_comentarios_clinicos
       from v_fuente_clinica_vigente where caso_id = any($1)`, [Object.values(casos).map((c) => c.id)]);
  const por = Object.fromEntries(rows.map((f) => [f.caso_id, f]));
  assert.deepEqual(por[casos.A.id], {
    caso_id: casos.A.id, origen: 'ficha', diagnostico_ingreso: 'Ficha A: crisis vital',
    // NULL de la ficha: no se completa con la hipótesis del alta.
    hipotesis_relacional: null, comentarios_clinicos: 'Ficha A: comentario',
    alta_diagnostico_ingreso: 'Alta A: conflicto familiar', alta_hipotesis_relacional: 'Alta A: hipótesis', alta_comentarios_clinicos: null,
  });
  assert.equal(por[casos.B.id].origen, 'alta');
  assert.equal(por[casos.B.id].diagnostico_ingreso, 'Alta B: derivación judicial');
  assert.equal(por[casos.C.id].origen, 'alta');
  assert.equal(por[casos.C.id].comentarios_clinicos, 'Alta C: comentario');
  assert.equal(por[casos.D.id].origen, 'sin_datos');
  assert.equal(por[casos.D.id].diagnostico_ingreso, null);
});

test('FE-125: ficha A, cuatro familiares con edad referida y parentesco respecto del paciente', opciones, async () => {
  await registrarFamilia(casos.A.id, [
    { parentesco: 'padre', nombre_completo: 'Padre QA', edad_referida: 44, fecha_referencia: REFERENCIA,
      ocupacion: 'Conductor', lugar_trabajo_estudio: 'Empresa ficticia', convive_con_paciente: true },
    { parentesco: 'madre', nombre_completo: 'Madre QA', edad_referida: 41, fecha_referencia: REFERENCIA, convive_con_paciente: true },
    { parentesco: 'hermana', nombre_completo: 'Hermana QA', edad_referida: 8, fecha_referencia: REFERENCIA,
      ocupacion: 'Estudiante', convive_con_paciente: true },
    { parentesco: 'abuela_materna', nombre_completo: 'Abuela QA', edad_referida: 68, fecha_referencia: REFERENCIA,
      convive_con_paciente: false },
  ]);
  const filas = await familia(casos.A.id);
  assert.deepEqual(filas.map((f) => [f.parentesco, f.edad_referida, f.fecha_referencia]), [
    ['padre', 44, REFERENCIA], ['madre', 41, REFERENCIA], ['hermana', 8, REFERENCIA], ['abuela_materna', 68, REFERENCIA]]);
  assert.ok(filas.every((f) => f.creado_por === PERFILES.t1 && f.actualizado_por === PERFILES.t1));
  // Cabecera e integrantes en la misma transacción: versión 1.
  const { id: _, ...cab } = await cabecera(casos.A.id);
  assert.deepEqual(cab, { version: 1, creado_por: PERFILES.t1, actualizado_por: PERFILES.t1 });
  // La edad del paciente se calcula a una fecha; la edad referida queda como se informó.
  const { rows } = await sql.query(
    `select edad_en(p.fecha_nacimiento, $2::date) as edad_paciente from casos c join pacientes p on p.id = c.paciente_id where c.id = $1`,
    [casos.A.id, REFERENCIA]);
  assert.equal(rows[0].edad_paciente, 12);
});

test('FE-125: ficha B, parentescos repetidos, datos desconocidos y "otro" con detalle', opciones, async () => {
  await registrarFamilia(casos.B.id, [
    { parentesco: 'hijo', nombre_completo: 'Hijo QA', fecha_nacimiento: '2008-04-10', ocupacion: 'Estudiante',
      lugar_trabajo_estudio: 'Colegio ficticio', convive_con_paciente: true },
    { parentesco: 'tio', nombre_completo: 'Tío QA 1' },
    { parentesco: 'tio', nombre_completo: 'Tío QA 2', convive_con_paciente: false },
    // Abuelo: nombre, nacimiento, edad y convivencia desconocidos (NULL), sin inventar valores.
    { parentesco: 'abuelo_paterno' },
    { parentesco: 'otro', parentesco_detalle: 'Padrino', observaciones: 'Acompaña al paciente (dato ficticio).' },
  ], PERFILES.admin);
  const filas = await familia(casos.B.id);
  assert.deepEqual(filas.map((f) => f.parentesco), ['hijo', 'tio', 'tio', 'abuelo_paterno', 'otro']);
  const abuelo = filas[3];
  for (const c of ['nombre_completo', 'fecha_nacimiento', 'edad_referida', 'fecha_referencia', 'convive_con_paciente']) {
    assert.equal(abuelo[c], null, c);
  }
  assert.equal(filas[4].parentesco_detalle, 'Padrino');
  const { rows } = await sql.query(`select edad_en('2008-04-10', $1::date) as edad`, [REFERENCIA]);
  assert.equal(rows[0].edad, 18);
  // B no tiene genograma; eso no impide registrar la familia.
  assert.equal((await sql.query('select count(*)::int as n from genogramas where caso_id = $1', [casos.B.id])).rows[0].n, 0);
});

test('FE-125: sin registrar se distingue de registrada sin integrantes', opciones, async () => {
  assert.equal(await cabecera(casos.D.id), null);
  await registrarFamilia(casos.C.id, [], PERFILES.t2);
  assert.equal((await cabecera(casos.C.id)).version, 1);
  assert.deepEqual(await familia(casos.C.id), []);
});

test('FE-125: datos inválidos se rechazan y no dejan escrituras parciales', opciones, async () => {
  const invalidos = [
    { parentesco: 'vecino' }, { parentesco: 'otro' }, { parentesco: 'otro', parentesco_detalle: '  ' },
    { parentesco: 'padre', parentesco_detalle: 'Padrastro' }, { parentesco: 'otro', parentesco_detalle: 'x'.repeat(101) },
    { parentesco: 'madre', nombre_completo: '   ' }, { parentesco: 'madre', nombre_completo: 'x'.repeat(151) },
    { parentesco: 'madre', ocupacion: 'x'.repeat(201) }, { parentesco: 'madre', lugar_trabajo_estudio: 'x'.repeat(151) },
    { parentesco: 'madre', observaciones: 'x'.repeat(2001) }, { parentesco: 'madre', observaciones: '' },
    { parentesco: 'madre', edad_referida: -1, fecha_referencia: REFERENCIA },
    { parentesco: 'madre', edad_referida: 131, fecha_referencia: REFERENCIA },
    { parentesco: 'madre', edad_referida: 40 }, { parentesco: 'madre', fecha_referencia: REFERENCIA },
    { parentesco: 'madre', fecha_nacimiento: '1985-01-01', edad_referida: 41, fecha_referencia: REFERENCIA },
    { parentesco: 'madre', fecha_nacimiento: '1899-12-31' },
    { parentesco: 'madre', fecha_nacimiento: pasadoManana() },
    { parentesco: 'madre', edad_referida: 40, fecha_referencia: pasadoManana() },
  ];
  for (const datos of invalidos) {
    await rechaza(comoUsuario(sql, PERFILES.t1, () => insertarFamiliar(casos.A.id, datos)), '23514');
  }
  await rechaza(comoUsuario(sql, PERFILES.t1, () => insertarFamiliar(casos.A.id, { parentesco: null })), '23502');
  // Hoy (Bolivia) sí es válido.
  const hoy = await comoUsuario(sql, PERFILES.t1, () => insertarFamiliar(casos.C.id, { parentesco: 'pareja', fecha_nacimiento: hoyBolivia() }));
  await comoUsuario(sql, PERFILES.t2, () => sql.query('delete from familiares where id = $1', [hoy]));

  // Dos válidos y uno inválido en la misma transacción: no queda ninguno y la versión no cambia.
  const antes = { filas: (await familia(casos.A.id)).length, version: (await cabecera(casos.A.id)).version };
  await rechaza(comoUsuario(sql, PERFILES.t1, async () => {
    await insertarFamiliar(casos.A.id, { parentesco: 'tio', nombre_completo: 'Tío válido' });
    await sql.query(`update familiares set ocupacion = 'Comerciante' where caso_id = $1 and parentesco = 'madre'`, [casos.A.id]);
    await insertarFamiliar(casos.A.id, { parentesco: 'vecino' });
  }), '23514');
  assert.equal((await familia(casos.A.id)).length, antes.filas);
  assert.equal((await familia(casos.A.id)).find((f) => f.parentesco === 'madre').ocupacion, null);
  assert.equal((await cabecera(casos.A.id)).version, antes.version);
});

test('FE-125: sin relaciones cruzadas ni familiares huérfanos', opciones, async () => {
  // Sin cabecera no hay familiares; la cabecera exige un caso existente y es única.
  await rechaza(comoUsuario(sql, PERFILES.admin, () => insertarFamiliar(casos.D.id, { parentesco: 'madre' })), '23503');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into fichas_familiares (caso_id) values ('00000000-0000-4000-8000-0000000000ff')`)), '23503');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('insert into fichas_familiares (caso_id) values ($1)', [casos.A.id])), '23505');
  // Un familiar no se mueve a otro caso, ni la cabecera.
  const [padre] = await familia(casos.A.id);
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('update familiares set caso_id = $1 where id = $2', [casos.B.id, padre.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    'update fichas_familiares set caso_id = $1 where caso_id = $2', [casos.D.id, casos.C.id])), '23514');
  // La familia no se pierde al borrar físicamente su cabecera o su caso.
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('delete from fichas_familiares where caso_id = $1', [casos.A.id])), '23503');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('delete from casos where id = $1', [casos.A.id])), '23503');
  assert.equal((await familia(casos.A.id)).length, 4);
  assert.equal((await familia(casos.B.id)).length, 5);
});

test('FE-125: editar un familiar conserva los demás; la versión sube una vez por transacción', opciones, async () => {
  const antes = await familia(casos.A.id);
  const version = (await cabecera(casos.A.id)).version;
  const madre = antes.find((f) => f.parentesco === 'madre');
  // Dos cambios en una transacción, hechos por administración.
  const nueva = await guardarConVersion(sql, PERFILES.admin, casos.A.id, version, async (c) => {
    await c.query(`update familiares set ocupacion = 'Comerciante', lugar_trabajo_estudio = 'Mercado ficticio' where id = $1`, [madre.id]);
    await c.query(`update familiares set convive_con_paciente = null where id = $1`, [madre.id]);
  });
  assert.equal(nueva, version + 1);
  const despues = await familia(casos.A.id);
  assert.deepEqual(despues.filter((f) => f.id !== madre.id), antes.filter((f) => f.id !== madre.id));
  const editada = despues.find((f) => f.id === madre.id);
  assert.equal(editada.ocupacion, 'Comerciante');
  assert.equal(editada.convive_con_paciente, null);
  assert.equal(editada.edad_referida, 41);
  assert.equal(editada.creado_por, PERFILES.t1);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  assert.equal((await cabecera(casos.A.id)).actualizado_por, PERFILES.admin);
  const { rows } = await sql.query(
    `select accion, usuario_id from auditoria where tabla = 'familiares' and registro_id = $1 order by id`, [madre.id]);
  assert.deepEqual(rows, [
    { accion: 'INSERT', usuario_id: PERFILES.t1 }, { accion: 'UPDATE', usuario_id: PERFILES.admin },
    { accion: 'UPDATE', usuario_id: PERFILES.admin }]);
  // Versión desactualizada: se rechaza sin cambios.
  await assert.rejects(guardarConVersion(sql, PERFILES.t1, casos.A.id, version, (c) =>
    c.query(`update familiares set ocupacion = 'Otra' where id = $1`, [madre.id])), { code: 'conflicto' });
  assert.equal((await familia(casos.A.id)).find((f) => f.id === madre.id).ocupacion, 'Comerciante');
});

test('FE-125: una edición concurrente no sobrescribe en silencio', opciones, async () => {
  const otra = await base.conectar();
  try {
    const version = (await cabecera(casos.B.id)).version;
    const [hijo] = await familia(casos.B.id);
    // Primera edición: bloquea la cabecera y todavía no confirma.
    await sql.query('begin');
    await sql.query(`select set_config('app.usuario_id', $1, true)`, [PERFILES.t1]);
    await sql.query('select version from fichas_familiares where caso_id = $1 for update', [casos.B.id]);
    await sql.query(`update familiares set ocupacion = 'Universitario' where id = $1`, [hijo.id]);
    // Segunda edición con la misma versión: espera el bloqueo y después ve la versión nueva.
    const segunda = guardarConVersion(otra, PERFILES.admin, casos.B.id, version, (c) =>
      c.query(`update familiares set ocupacion = 'Trabajador' where id = $1`, [hijo.id]));
    let esperando = false;
    for (let i = 0; i < 50 && !esperando; i++) {
      esperando = (await sql.query(
        `select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`)).rows.length > 0;
      if (!esperando) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(esperando, 'la segunda edición debe esperar el bloqueo');
    await sql.query('commit');
    await assert.rejects(segunda, { code: 'conflicto' });
    assert.equal((await familia(casos.B.id))[0].ocupacion, 'Universitario');
    assert.equal((await cabecera(casos.B.id)).version, version + 1);
  } finally {
    await otra.end();
  }
});

test('FE-125: eliminar es lógico; el familiar eliminado queda guardado y no se edita', opciones, async () => {
  const tio = (await familia(casos.B.id)).find((f) => f.nombre_completo === 'Tío QA 2');
  const version = (await cabecera(casos.B.id)).version;
  await comoUsuario(sql, PERFILES.t1, () => sql.query('update familiares set deleted_at = now() where id = $1', [tio.id]));
  assert.equal((await cabecera(casos.B.id)).version, version + 1);
  assert.deepEqual((await familia(casos.B.id)).map((f) => f.parentesco), ['hijo', 'tio', 'abuelo_paterno', 'otro']);
  const { rows } = await sql.query('select nombre_completo, actualizado_por from familiares where id = $1', [tio.id]);
  assert.deepEqual(rows[0], { nombre_completo: 'Tío QA 2', actualizado_por: PERFILES.t1 });
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(`update familiares set ocupacion = 'X' where id = $1`, [tio.id])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query('update familiares set deleted_at = null where id = $1', [tio.id])), '23514');
});

test('FE-125: guardar el diagnóstico no toca familiares y editar familiares no toca diagnóstico ni genograma', opciones, async () => {
  const fichaAntes = (await sql.query('select contenido, actualizado_en from fichas_diagnostico where caso_id = $1', [casos.A.id])).rows[0];
  const genogramaAntes = (await sql.query('select datos, actualizado_en from genogramas where caso_id = $1', [casos.A.id])).rows[0];
  const familiaAntes = await familia(casos.A.id);
  const versionAntes = (await cabecera(casos.A.id)).version;
  await comoUsuario(sql, PERFILES.t1, () => insertarFamiliar(casos.A.id, { parentesco: 'abuelo_materno', nombre_completo: 'Abuelo QA' }));
  assert.deepEqual((await sql.query('select contenido, actualizado_en from fichas_diagnostico where caso_id = $1', [casos.A.id])).rows[0], fichaAntes);
  assert.deepEqual((await sql.query('select datos, actualizado_en from genogramas where caso_id = $1', [casos.A.id])).rows[0], genogramaAntes);
  // Dos guardados del diagnóstico (reemplazan el JSON) no borran ni versionan la familia.
  await guardarDiagnostico(casos.A.id, { diagnosticoIngreso: 'Ficha A: segunda edición', hipotesisRelacional: null, comentariosClinicos: null });
  await guardarDiagnostico(casos.A.id, { diagnosticoIngreso: 'Ficha A: tercera edición', hipotesisRelacional: 'H', comentariosClinicos: null }, PERFILES.admin);
  const familiaDespues = await familia(casos.A.id);
  assert.deepEqual(familiaDespues.slice(0, familiaAntes.length), familiaAntes);
  assert.equal(familiaDespues.length, familiaAntes.length + 1);
  assert.equal((await cabecera(casos.A.id)).version, versionAntes + 1);
  const vigente = (await sql.query('select origen, diagnostico_ingreso, alta_diagnostico_ingreso from v_fuente_clinica_vigente where caso_id = $1', [casos.A.id])).rows[0];
  assert.deepEqual(vigente, { origen: 'ficha', diagnostico_ingreso: 'Ficha A: tercera edición', alta_diagnostico_ingreso: 'Alta A: conflicto familiar' });
});

test('FE-125: permisos; solo administración y la terapeuta asignada ven la familia', opciones, async () => {
  const total = (await familia(casos.A.id)).length;
  assert.equal(await familiaVisible('administrador', PERFILES.admin, casos.A.id), total);
  assert.equal(await familiaVisible('terapeuta', PERFILES.t1, casos.A.id), total);
  assert.equal(await familiaVisible('terapeuta', PERFILES.t2, casos.A.id), 0);
  assert.equal(await familiaVisible('marketing', PERFILES.marketing, casos.A.id), 0);
  // Caso eliminado lógicamente: deja de verse, pero la familia sigue guardada.
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update casos set deleted_at = now() where id = $1', [casos.B.id]));
  assert.equal(await familiaVisible('administrador', PERFILES.admin, casos.B.id), 0);
  assert.equal((await familia(casos.B.id)).length, 4);
  assert.equal((await sql.query('select count(*)::int as n from v_fuente_clinica_vigente where caso_id = $1', [casos.B.id])).rows[0].n, 0);
});

test('FE-125: edad_en calcula años cumplidos a una fecha', opciones, async () => {
  const casosEdad = [
    ['2014-11-25', '2026-11-24', 11], ['2014-11-25', '2026-11-25', 12],
    ['2012-02-29', '2026-02-28', 13], ['2012-02-29', '2026-03-01', 14],
    ['2026-11-20', '2026-11-20', 0], ['2026-11-21', '2026-11-20', null], [null, '2026-11-20', null],
  ];
  for (const [nacimiento, al, esperado] of casosEdad) {
    const { rows } = await sql.query('select edad_en($1::date, $2::date) as edad', [nacimiento, al]);
    assert.equal(rows[0].edad, esperado, `${nacimiento} → ${al}`);
  }
});

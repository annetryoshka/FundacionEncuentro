// FE-135: residencia del paciente, filtro de carpetas e indicadores por residencia.
// Datos y resultados esperados de docs/srs/sprint-3/FE-134-residencia-y-filtros.md (secciones 4 y 5).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, casos;
const PERIODO = ['2026-11-20', '2026-11-21'];

const residencia = (pacienteId, ciudad, localidad = null, usuario = PERFILES.admin) => comoUsuario(sql, usuario, () =>
  sql.query('update pacientes set ciudad_residencia = $1, otra_localidad = $2 where id = $3', [ciudad, localidad, pacienteId]));

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe135'); sql = base.cliente;
  const A = await crearCaso(sql, { nombre: 'QA caso A', estado: 'en_proceso', clasificacion: 'social', terapeuta: PERFILES.t1 });
  const B = await crearCaso(sql, { nombre: 'QA caso B', estado: 'iniciado', clasificacion: 'privado', terapeuta: PERFILES.t2 });
  const C = await crearCaso(sql, { nombre: 'QA caso C', estado: 'iniciado', clasificacion: 'social', terapeuta: PERFILES.t1 });
  const D = await crearCaso(sql, { nombre: 'QA caso D', estado: 'concluido', clasificacion: 'privado' });
  casos = { A, B, C, D };
  await residencia(A.pacienteId, 'la_paz');
  await residencia(B.pacienteId, 'el_alto');
  await residencia(D.pacienteId, 'otra', 'Viacha ficticia');
  const SA1 = await crearSesion(sql, A.id, { fecha: '2026-11-20' });
  await crearSesion(sql, A.id, { fecha: '2026-11-21' });
  const SB1 = await crearSesion(sql, B.id, { fecha: '2026-11-20', responsable: PERFILES.t2 });
  for (const [caso, sesion, monto] of [[A, SA1, '75.50'], [B, SB1, '100.00']]) {
    await comoUsuario(sql, PERFILES.admin, () => sql.query(
      `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-11-20', $3, 'qr')`,
      [caso.id, sesion.id, monto]));
  }
});
after(async () => { await base?.cerrar(); });

// Misma forma que CasosService.listarCarpetas (autorización y filtros antes del total y la paginación),
// con la condición de residencia que agrega FE-136:
//   residencia = 'sin_registrar' → p.ciudad_residencia is null
//   otro valor                   → p.ciudad_residencia = $n
async function listar(usuario, rol, filtros = {}, { pagina = 1, tamano = 10 } = {}) {
  const valores = [rol, usuario];
  const condiciones = ['c.deleted_at is null', 'p.deleted_at is null',
    "($1 = 'administrador' or ($1 = 'terapeuta' and a.perfil_id = $2))"];
  if (filtros.residencia === 'sin_registrar') {
    condiciones.push('p.ciudad_residencia is null');
  } else if (filtros.residencia) {
    valores.push(filtros.residencia); condiciones.push(`p.ciudad_residencia = $${valores.length}`);
  }
  for (const campo of ['clasificacion', 'estado']) {
    if (filtros[campo]) { valores.push(filtros[campo]); condiciones.push(`c.${campo} = $${valores.length}`); }
  }
  const origen = `from casos c join pacientes p on p.id = c.paciente_id
    left join asignaciones_caso a on a.caso_id = c.id where ${condiciones.join(' and ')}`;
  const total = Number((await sql.query(`select count(*) as total ${origen}`, valores)).rows[0].total);
  const { rows } = await sql.query(
    `select p.nombre_completo ${origen} order by p.nombre_completo
      limit $${valores.length + 1} offset $${valores.length + 2}`, [...valores, tamano, (pagina - 1) * tamano]);
  return { total, nombres: rows.map((f) => f.nombre_completo.replace('QA caso ', '')) };
}

const porResidencia = async (desde = PERIODO[0], hasta = PERIODO[1]) => (await sql.query(
  `select residencia, casos_actuales, casos_iniciados, casos_en_proceso, casos_concluidos, sesiones,
          pagos_recibidos::text as pagos_recibidos
     from indicadores_por_residencia($1, $2)`, [desde, hasta])).rows;

const resumen = (filas) => Object.fromEntries(filas.map((f) => [f.residencia, [f.casos_actuales, f.sesiones, f.pagos_recibidos]]));

test('FE-135: catálogo de residencia; NULL es sin registrar', opciones, async () => {
  const { rows } = await sql.query('select ciudad_residencia, otra_localidad from pacientes where id = $1', [casos.C.pacienteId]);
  assert.deepEqual(rows[0], { ciudad_residencia: null, otra_localidad: null });
  for (const [ciudad, localidad] of [['cochabamba', null], ['sin_registrar', null], ['otra', null], ['otra', '   '],
    ['otra', 'x'.repeat(101)], ['la_paz', 'Viacha ficticia'], [null, 'Viacha ficticia']]) {
    await rechaza(residencia(casos.C.pacienteId, ciudad, localidad), '23514');
  }
});

test('FE-135: el cambio de residencia guarda fecha y autor; otros cambios no', opciones, async () => {
  const leer = async () => (await sql.query(
    'select residencia_actualizada_en, residencia_actualizada_por from pacientes where id = $1', [casos.C.pacienteId])).rows[0];
  assert.deepEqual(await leer(), { residencia_actualizada_en: null, residencia_actualizada_por: null });
  await residencia(casos.C.pacienteId, 'el_alto', null, PERFILES.t1);
  const cambio = await leer();
  assert.equal(cambio.residencia_actualizada_por, PERFILES.t1);
  assert.ok(cambio.residencia_actualizada_en);
  await comoUsuario(sql, PERFILES.admin, () => sql.query("update pacientes set telefono = '70000000' where id = $1", [casos.C.pacienteId]));
  assert.deepEqual(await leer(), cambio);
  await residencia(casos.C.pacienteId, null);
  assert.equal((await leer()).residencia_actualizada_por, PERFILES.admin);
});

test('FE-135: indicadores por residencia del 20 al 21/11 (tabla de FE-134)', opciones, async () => {
  assert.deepEqual(await porResidencia(), [
    { residencia: 'la_paz', casos_actuales: 1, casos_iniciados: 0, casos_en_proceso: 1, casos_concluidos: 0, sesiones: 2, pagos_recibidos: '75.50' },
    { residencia: 'el_alto', casos_actuales: 1, casos_iniciados: 1, casos_en_proceso: 0, casos_concluidos: 0, sesiones: 1, pagos_recibidos: '100.00' },
    { residencia: 'otra', casos_actuales: 1, casos_iniciados: 0, casos_en_proceso: 0, casos_concluidos: 1, sesiones: 0, pagos_recibidos: '0' },
    { residencia: 'sin_registrar', casos_actuales: 1, casos_iniciados: 1, casos_en_proceso: 0, casos_concluidos: 0, sesiones: 0, pagos_recibidos: '0' },
  ]);
});

test('FE-135: la suma por residencia es igual a indicadores_operativos', opciones, async () => {
  for (const [desde, hasta] of [PERIODO, ['2026-01-01', '2026-12-31'], ['2026-10-01', '2026-10-05']]) {
    const { rows: [total] } = await sql.query(
      `select casos_actuales, casos_iniciados, casos_en_proceso, casos_concluidos, sesiones, pagos_recibidos
         from indicadores_operativos($1, $2)`, [desde, hasta]);
    const { rows: [suma] } = await sql.query(
      `select sum(casos_actuales)::int as casos_actuales, sum(casos_iniciados)::int as casos_iniciados,
              sum(casos_en_proceso)::int as casos_en_proceso, sum(casos_concluidos)::int as casos_concluidos,
              sum(sesiones)::int as sesiones, sum(pagos_recibidos) as pagos_recibidos
         from indicadores_por_residencia($1, $2)`, [desde, hasta]);
    assert.deepEqual(suma, total);
  }
  assert.equal((await sql.query(`select sum(casos_actuales)::int as n from indicadores_por_residencia($1, $2)`, PERIODO)).rows[0].n, 4);
});

test('FE-135: período sin movimientos da 0 sesiones e importe 0', opciones, async () => {
  const r = resumen(await porResidencia('2026-10-01', '2026-10-05'));
  assert.deepEqual(r, { la_paz: [1, 0, '0'], el_alto: [1, 0, '0'], otra: [1, 0, '0'], sin_registrar: [1, 0, '0'] });
});

test('FE-135: listado por perfil y filtros combinados (tabla de FE-134)', opciones, async () => {
  const admin = (f, p) => listar(PERFILES.admin, 'administrador', f, p);
  const t1 = (f) => listar(PERFILES.t1, 'terapeuta', f);
  assert.deepEqual(await admin({}), { total: 4, nombres: ['A', 'B', 'C', 'D'] });
  assert.deepEqual(await admin({ residencia: 'la_paz' }), { total: 1, nombres: ['A'] });
  assert.deepEqual(await admin({ residencia: 'el_alto' }), { total: 1, nombres: ['B'] });
  assert.deepEqual(await admin({ residencia: 'sin_registrar' }), { total: 1, nombres: ['C'] });
  assert.deepEqual(await admin({ residencia: 'otra' }), { total: 1, nombres: ['D'] });
  assert.deepEqual(await t1({}), { total: 2, nombres: ['A', 'C'] });
  assert.deepEqual(await t1({ clasificacion: 'social', estado: 'iniciado' }), { total: 1, nombres: ['C'] });
  assert.deepEqual(await t1({ residencia: 'el_alto' }), { total: 0, nombres: [] });
  assert.deepEqual(await t1({ residencia: 'la_paz', clasificacion: 'social', estado: 'en_proceso' }), { total: 1, nombres: ['A'] });
  // Total coherente con la paginación: página 2 de tamaño 1 trae un solo caso y el total sigue en 4.
  assert.deepEqual(await admin({}, { pagina: 2, tamano: 1 }), { total: 4, nombres: ['B'] });
  assert.deepEqual(await admin({ residencia: 'la_paz' }, { pagina: 2, tamano: 1 }), { total: 1, nombres: [] });
});

test('FE-135: mudar A de La Paz a El Alto conserva el caso y mueve sus conteos', opciones, async () => {
  const caso = async () => (await sql.query(
    `select c.tipo, c.numero_correlativo, c.fecha_ingreso::text, c.estado, a.perfil_id
       from casos c left join asignaciones_caso a on a.caso_id = c.id where c.id = $1`, [casos.A.id])).rows[0];
  const antes = await caso();
  await residencia(casos.A.pacienteId, 'el_alto');
  assert.deepEqual(await caso(), antes);
  const r = resumen(await porResidencia());
  assert.deepEqual(r.la_paz, [0, 0, '0']);
  assert.deepEqual(r.el_alto, [2, 3, '175.50']);
  assert.deepEqual((await listar(PERFILES.t1, 'terapeuta', { residencia: 'el_alto' })).nombres, ['A']);
  await residencia(casos.A.pacienteId, 'la_paz');
});

test('FE-135: tareas y una segunda carpeta no duplican conteos', opciones, async () => {
  const { rows: [s] } = await sql.query('select id from fichas_seguimiento where caso_id = $1 order by nro_sesion limit 1', [casos.A.id]);
  for (const descripcion of ['Tarea QA 1', 'Tarea QA 2']) {
    await comoUsuario(sql, PERFILES.t1, () => sql.query(
      'insert into tareas_terapeuticas (caso_id, sesion_id, descripcion) values ($1, $2, $3)', [casos.A.id, s.id, descripcion]));
  }
  assert.deepEqual(resumen(await porResidencia()).la_paz, [1, 2, '75.50']);
  // Segunda carpeta del mismo paciente: cuenta como un caso más de La Paz, sin repetir sesiones ni pagos.
  const { rows: [nuevo] } = await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into casos (paciente_id, tipo, estado) values ($1, 'voluntario', 'iniciado') returning id`, [casos.A.pacienteId]));
  assert.deepEqual(resumen(await porResidencia()).la_paz, [2, 2, '75.50']);
  assert.equal((await listar(PERFILES.admin, 'administrador', { residencia: 'la_paz' })).total, 2);
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update casos set deleted_at = now() where id = $1', [nuevo.id]));
  assert.deepEqual(resumen(await porResidencia()).la_paz, [1, 2, '75.50']);
});

test('FE-135: paciente eliminado deja de contar en su residencia', opciones, async () => {
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update pacientes set deleted_at = now() where id = $1', [casos.B.pacienteId]));
  assert.deepEqual(resumen(await porResidencia()).el_alto, [0, 0, '0']);
  assert.equal((await listar(PERFILES.admin, 'administrador', { residencia: 'el_alto' })).total, 0);
  await comoUsuario(sql, PERFILES.admin, () => sql.query('update pacientes set deleted_at = null where id = $1', [casos.B.pacienteId]));
});

test('FE-135: el cambio de residencia queda en auditoría', opciones, async () => {
  const { rows } = await sql.query(
    `select usuario_id, datos_anteriores ->> 'ciudad_residencia' as antes, datos_nuevos ->> 'ciudad_residencia' as despues
       from auditoria where tabla = 'pacientes' and registro_id = $1 and accion = 'UPDATE'
        and datos_anteriores ->> 'ciudad_residencia' is distinct from datos_nuevos ->> 'ciudad_residencia'
      order by id`, [casos.A.pacienteId]);
  assert.deepEqual(rows.map((f) => [f.antes, f.despues]), [[null, 'la_paz'], ['la_paz', 'el_alto'], ['el_alto', 'la_paz']]);
  assert.ok(rows.every((f) => f.usuario_id === PERFILES.admin));
});

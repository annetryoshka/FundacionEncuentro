// FE-79: tareas ligadas a una sesión del mismo caso, sin huérfanas, con trazabilidad del cumplimiento.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, casoA, casoB, sesionA1, sesionB1;
before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe79'); sql = base.cliente;
  casoA = await crearCaso(sql, { nombre: 'QA caso A', terapeuta: PERFILES.t1 });
  casoB = await crearCaso(sql, { nombre: 'QA caso B', terapeuta: PERFILES.t2 });
  sesionA1 = await crearSesion(sql, casoA.id);
  sesionB1 = await crearSesion(sql, casoB.id, { responsable: PERFILES.t2 });
});
after(async () => { await base?.cerrar(); });

const crearTarea = (casoId, sesionId, descripcion = 'Actividad de prueba') => comoUsuario(sql, PERFILES.t1, async () =>
  (await sql.query(
    `insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id)
     values ($1, $2, $3, $4) returning id, completada`, [casoId, sesionId, descripcion, PERFILES.t1])).rows[0]);
const cambiarCumplimiento = (id, completada, usuario = PERFILES.t1) => comoUsuario(sql, usuario, () =>
  sql.query('update tareas_terapeuticas set completada = $1 where id = $2', [completada, id]));

test('FE-79: ejemplos de tarea pendiente y realizada con responsable del cambio', opciones, async () => {
  const pendiente = await crearTarea(casoA.id, sesionA1.id, 'Tarea pendiente QA');
  const realizada = await crearTarea(casoA.id, sesionA1.id, 'Tarea realizada QA');
  assert.equal(pendiente.completada, false);
  await cambiarCumplimiento(realizada.id, true);

  const { rows } = await sql.query(
    `select descripcion, completada, cumplimiento_actualizado_por, cumplimiento_actualizado_en is not null as con_fecha
       from tareas_terapeuticas where sesion_id = $1 order by creado_en, id`, [sesionA1.id]);
  assert.deepEqual(rows, [
    { descripcion: 'Tarea pendiente QA', completada: false, cumplimiento_actualizado_por: null, con_fecha: false },
    { descripcion: 'Tarea realizada QA', completada: true, cumplimiento_actualizado_por: PERFILES.t1, con_fecha: true },
  ]);

  // Volver a Pendiente también registra quién lo cambió.
  await cambiarCumplimiento(realizada.id, false, PERFILES.admin);
  const vuelta = (await sql.query('select completada, cumplimiento_actualizado_por from tareas_terapeuticas where id = $1', [realizada.id])).rows[0];
  assert.deepEqual(vuelta, { completada: false, cumplimiento_actualizado_por: PERFILES.admin });

  // Y queda en auditoría.
  const auditoria = await sql.query(`select count(*)::int as n from auditoria where tabla = 'tareas_terapeuticas' and registro_id = $1`, [realizada.id]);
  assert.equal(auditoria.rows[0].n, 3);
});

test('FE-79: sin sesión, con sesión de otro caso o inexistente se rechaza', opciones, async () => {
  await rechaza(crearTarea(casoA.id, null), '23502');
  await rechaza(crearTarea(casoA.id, sesionB1.id), '23503');
  await rechaza(crearTarea(casoA.id, '00000000-0000-4000-8000-0000000000ff'), '23503');
  await rechaza(crearTarea(casoA.id, sesionA1.id, '   '), '23514');
  const { rows } = await sql.query('select count(*)::int as n from tareas_terapeuticas where caso_id = $1 and sesion_id <> $2', [casoA.id, sesionA1.id]);
  assert.equal(rows[0].n, 0);
});

test('FE-79: mover una tarea a la sesión de otro caso se rechaza y no altera el otro caso', opciones, async () => {
  const tarea = await crearTarea(casoA.id, sesionA1.id);
  await rechaza(comoUsuario(sql, PERFILES.admin, () =>
    sql.query('update tareas_terapeuticas set sesion_id = $1 where id = $2', [sesionB1.id, tarea.id])), '23503');
  const enB = await sql.query('select count(*)::int as n from tareas_terapeuticas where caso_id = $1', [casoB.id]);
  assert.equal(enB.rows[0].n, 0);
  // Borrar una sesión con tareas se rechaza: no quedan huérfanas.
  await rechaza(comoUsuario(sql, PERFILES.admin, () =>
    sql.query('delete from fichas_seguimiento where id = $1', [sesionA1.id])), '23503');
  const sesiones = await sql.query('select count(*)::int as n from fichas_seguimiento');
  assert.equal(sesiones.rows[0].n, 2);
});

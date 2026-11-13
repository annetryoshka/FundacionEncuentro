// FE-74: sesiones de dos casos, fechas iguales, más de 16 sesiones y numeración bajo concurrencia.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
before(async () => { if (opciones.skip) return; base = await crearBase('fe74'); sql = base.cliente; });
after(async () => { await base?.cerrar(); });

const sesionesDe = async (casoId) => (await sql.query(
  `select nro_sesion, to_char(fecha, 'YYYY-MM-DD') as fecha, evolucion from fichas_seguimiento
    where caso_id = $1 order by fecha, nro_sesion`, [casoId])).rows;

test('FE-74: dos casos con 17 sesiones cada uno numeran por separado', opciones, async () => {
  const a = await crearCaso(sql, { nombre: 'QA caso A', terapeuta: PERFILES.t1 });
  const b = await crearCaso(sql, { nombre: 'QA caso B', terapeuta: PERFILES.t2 });
  for (let i = 1; i <= 17; i++) {
    const fecha = `2026-09-${String(i).padStart(2, '0')}`;
    await crearSesion(sql, a.id, { fecha, evolucion: `A sesión ${i}` });
    await crearSesion(sql, b.id, { fecha, evolucion: `B sesión ${i}`, responsable: PERFILES.t2 });
  }
  const sa = await sesionesDe(a.id);
  const sb = await sesionesDe(b.id);
  assert.deepEqual(sa.map((s) => s.nro_sesion), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.deepEqual(sb.map((s) => s.nro_sesion), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.ok(sa.every((s) => s.evolucion.startsWith('A ')) && sb.every((s) => s.evolucion.startsWith('B ')));
});

test('FE-74: dos sesiones con la misma fecha se listan por número', opciones, async () => {
  const caso = await crearCaso(sql, { terapeuta: PERFILES.t1 });
  await crearSesion(sql, caso.id, { nro: 2, fecha: '2026-10-12', evolucion: 'Segunda' });
  await crearSesion(sql, caso.id, { nro: 1, fecha: '2026-10-12', evolucion: 'Primera' });
  assert.deepEqual((await sesionesDe(caso.id)).map((s) => s.evolucion), ['Primera', 'Segunda']);
  // Un número repetido en el mismo caso se rechaza.
  await rechaza(crearSesion(sql, caso.id, { nro: 2 }), '23505');
});

test('FE-74: dos altas simultáneas del mismo caso reciben números distintos', opciones, async () => {
  const caso = await crearCaso(sql, { terapeuta: PERFILES.t1 });
  const [c1, c2] = [await base.conectar(), await base.conectar()];
  try {
    // c1 inserta y deja la transacción abierta; c2 tiene que esperar a que c1 confirme.
    await c1.query('begin');
    await c1.query(`insert into fichas_seguimiento (caso_id, fecha, evolucion, responsable_id)
                    values ($1, '2026-10-12', 'Concurrente 1', $2)`, [caso.id, PERFILES.t1]);
    const segunda = c2.query(`insert into fichas_seguimiento (caso_id, fecha, evolucion, responsable_id)
                              values ($1, '2026-10-12', 'Concurrente 2', $2) returning nro_sesion`, [caso.id, PERFILES.t1]);
    await new Promise((r) => setTimeout(r, 300));
    await c1.query('commit');
    assert.equal((await segunda).rows[0].nro_sesion, 2);
  } finally {
    await c1.end(); await c2.end();
  }
  assert.deepEqual((await sesionesDe(caso.id)).map((s) => s.nro_sesion), [1, 2]);
});

test('FE-74: fecha inválida o evolución vacía no crean registro parcial', opciones, async () => {
  const caso = await crearCaso(sql, { terapeuta: PERFILES.t1 });
  await rechaza(crearSesion(sql, caso.id, { fecha: '2026-13-01' }), '22008');
  await rechaza(crearSesion(sql, caso.id, { evolucion: '  ' }), '23514');
  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into fichas_seguimiento (caso_id, evolucion, responsable_id) values ($1, 'Sin fecha', $2)`,
    [caso.id, PERFILES.t1])), '23502');
  assert.deepEqual(await sesionesDe(caso.id), []);
});

test('FE-74: la responsable registrada se conserva al reasignar el caso', opciones, async () => {
  const caso = await crearCaso(sql, { terapeuta: PERFILES.t1 });
  const sesion = await crearSesion(sql, caso.id);
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    'update asignaciones_caso set perfil_id = $1 where caso_id = $2', [PERFILES.t2, caso.id]));
  const { rows } = await sql.query('select responsable_id, creado_por from fichas_seguimiento where id = $1', [sesion.id]);
  assert.deepEqual(rows[0], { responsable_id: PERFILES.t1, creado_por: PERFILES.t1 });
});

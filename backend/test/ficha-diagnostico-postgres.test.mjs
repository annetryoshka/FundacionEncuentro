// FE-69: una ficha de diagnóstico por caso (modelo de FE-68: los campos van en contenido).
// Editar no duplica la ficha y conserva quién la creó; la versión anterior queda en auditoría.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
before(async () => { if (opciones.skip) return; base = await crearBase('fe69'); sql = base.cliente; });
after(async () => { await base?.cerrar(); });

// Igual que la API de FE-68: crea la ficha o actualiza la del caso.
const guardar = (casoId, { fecha = '2026-10-12', diagnostico = 'Diagnóstico QA', hipotesis = null } = {}, usuario = PERFILES.t1) =>
  comoUsuario(sql, usuario, async () => (await sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
     values ($1, $2::date, $3::jsonb, $4, $4)
     on conflict (caso_id) do update set
       fecha = excluded.fecha, contenido = excluded.contenido, actualizado_por = excluded.actualizado_por
     returning *`,
    [casoId, fecha, JSON.stringify({ diagnosticoIngreso: diagnostico, hipotesisRelacional: hipotesis }), usuario],
  )).rows[0]);
const fichasDe = async (casoId) => (await sql.query('select * from fichas_diagnostico where caso_id = $1', [casoId])).rows;

test('FE-69: crear con opcionales vacíos y editar conserva id y autoría de creación', opciones, async () => {
  const caso = await crearCaso(sql, { terapeuta: PERFILES.t1 });
  const creada = await guardar(caso.id);
  assert.equal(creada.contenido.hipotesisRelacional, null);

  const editada = await guardar(caso.id, { hipotesis: 'Hipótesis QA' }, PERFILES.admin);
  const fichas = await fichasDe(caso.id);
  assert.equal(fichas.length, 1);
  assert.equal(editada.id, creada.id);
  assert.equal(editada.creado_por, PERFILES.t1);
  assert.deepEqual(editada.creado_en, creada.creado_en);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  assert.ok(editada.actualizado_en > creada.actualizado_en);
  assert.equal(editada.contenido.hipotesisRelacional, 'Hipótesis QA');

  // La versión anterior queda en auditoría.
  const auditoria = (await sql.query(
    `select usuario_id, datos_anteriores -> 'contenido' ->> 'hipotesisRelacional' as antes
       from auditoria where tabla = 'fichas_diagnostico' and accion = 'UPDATE' and registro_id = $1`, [creada.id])).rows;
  assert.deepEqual(auditoria, [{ usuario_id: PERFILES.admin, antes: null }]);
});

test('FE-69: una segunda ficha del mismo caso se rechaza; otro caso tiene la suya', opciones, async () => {
  const a = await crearCaso(sql, { nombre: 'QA ficha A' });
  const b = await crearCaso(sql, { nombre: 'QA ficha B' });
  await guardar(a.id, { diagnostico: 'Diagnóstico A' });
  await guardar(b.id, { diagnostico: 'Diagnóstico B' });
  await rechaza(comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, creado_por) values ($1, '2026-10-12', $2)`, [a.id, PERFILES.t1])), '23505');
  assert.equal((await fichasDe(a.id))[0].contenido.diagnosticoIngreso, 'Diagnóstico A');
  assert.equal((await fichasDe(b.id))[0].contenido.diagnosticoIngreso, 'Diagnóstico B');
});

test('FE-69: fecha imposible o caso inexistente se rechazan sin crear ficha', opciones, async () => {
  const caso = await crearCaso(sql);
  await rechaza(guardar(caso.id, { fecha: '2026-02-30' }), '22008');
  await rechaza(guardar('00000000-0000-4000-8000-0000000000ff'), '23503');
  assert.equal((await fichasDe(caso.id)).length, 0);
});

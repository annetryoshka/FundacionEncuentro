// FE-60: persistencia de tipo, clasificación y estado sin cambiar correlativos.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
before(async () => { if (opciones.skip) return; base = await crearBase('fe60'); sql = base.cliente; });
after(async () => { await base?.cerrar(); });

const contadores = async () => Object.fromEntries(
  (await sql.query('select tipo, ultimo_numero from contadores_caso')).rows.map((f) => [f.tipo, f.ultimo_numero]),
);

test('FE-60: un caso ficticio por cada combinación de tipo, clasificación y estado', opciones, async () => {
  const casos = [];
  for (const tipo of ['voluntario', 'derivado'])
    for (const clasificacion of ['social', 'privado', null])
      for (const estado of ['iniciado', 'en_proceso', 'concluido'])
        casos.push(await crearCaso(sql, { nombre: `QA ${tipo} ${clasificacion} ${estado}`, tipo, clasificacion, estado }));

  assert.equal(casos.length, 18);
  // Cada origen tiene su propia numeración 1..9.
  for (const tipo of ['voluntario', 'derivado']) {
    assert.deepEqual(casos.filter((c) => c.tipo === tipo).map((c) => c.numero_correlativo), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  assert.deepEqual(await contadores(), { voluntario: 9, derivado: 9 });
  const { rows } = await sql.query(`select count(distinct (tipo, coalesce(clasificacion, '-'), estado))::int as n from casos`);
  assert.equal(rows[0].n, 18);
});

test('FE-60: cambiar clasificación y estado conserva id, origen, número y paciente', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA cambio', tipo: 'derivado' });
  const antes = await contadores();
  await comoUsuario(sql, PERFILES.admin, () =>
    sql.query(`update casos set clasificacion = 'privado', estado = 'en_proceso' where id = $1`, [caso.id]));
  const { rows } = await sql.query('select * from casos where id = $1', [caso.id]);
  assert.equal(rows[0].tipo, 'derivado');
  assert.equal(rows[0].numero_correlativo, caso.numero_correlativo);
  assert.equal(rows[0].paciente_id, caso.pacienteId);
  assert.equal(rows[0].clasificacion, 'privado');
  assert.equal(rows[0].estado, 'en_proceso');
  assert.deepEqual(await contadores(), antes);
});

test('FE-60: el origen y el número no se pueden cambiar; valores fuera de catálogo se rechazan', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA protegido' });
  const actualizar = (set) => comoUsuario(sql, PERFILES.admin, () => sql.query(`update casos set ${set} where id = $1`, [caso.id]));
  await rechaza(actualizar(`tipo = 'derivado'`), '23514');
  await rechaza(actualizar('numero_correlativo = 999'), '23514');
  await rechaza(actualizar(`clasificacion = 'judicial'`), '23514');
  await rechaza(actualizar(`estado = 'en_conclusion'`), '23514');
  const { rows } = await sql.query('select tipo, numero_correlativo, clasificacion, estado from casos where id = $1', [caso.id]);
  assert.deepEqual(rows[0], { tipo: 'voluntario', numero_correlativo: caso.numero_correlativo, clasificacion: null, estado: 'iniciado' });
});

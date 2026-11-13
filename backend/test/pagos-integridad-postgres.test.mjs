// FE-89: pagos por sesión con montos exactos en BOB, sin duplicación ni redondeos.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, casoA, casoB, sA1, sA2, sB1;
before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe89'); sql = base.cliente;
  casoA = await crearCaso(sql, { nombre: 'QA caso A', terapeuta: PERFILES.t1 });
  casoB = await crearCaso(sql, { nombre: 'QA caso B', terapeuta: PERFILES.t2 });
  sA1 = await crearSesion(sql, casoA.id, { fecha: '2026-10-12' });
  sA2 = await crearSesion(sql, casoA.id, { fecha: '2026-10-12' });
  sB1 = await crearSesion(sql, casoB.id, { fecha: '2026-10-19', responsable: PERFILES.t2 });
});
after(async () => { await base?.cerrar(); });

const pagar = (casoId, sesionId, monto, { fecha = '2026-10-12', metodo = 'qr', referencia = null } = {}) =>
  comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into pagos (caso_id, sesion_id, fecha, monto, metodo, referencia, registrado_por)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [casoId, sesionId, fecha, monto, metodo, referencia, PERFILES.admin]));
const total = async (casoId) => (await sql.query(
  `select coalesce(sum(monto), 0)::text as total, count(*)::int as n from pagos where caso_id = $1`, [casoId])).rows[0];

test('FE-89: pagos ficticios se guardan exactos y suman al centavo', opciones, async () => {
  await pagar(casoA.id, sA1.id, '75.50');
  await pagar(casoA.id, sA2.id, '40.25', { fecha: '2026-10-20', metodo: 'transferencia', referencia: 'TRF-QA-1' });
  await pagar(casoB.id, sB1.id, '125.00', { fecha: '2026-10-19' });
  assert.deepEqual(await total(casoA.id), { total: '115.75', n: 2 });
  assert.deepEqual(await total(casoB.id), { total: '125.00', n: 1 });
});

test('FE-89: repetir el pago de la misma sesión no duplica el total', opciones, async () => {
  await rechaza(pagar(casoA.id, sA1.id, '75.50'), '23505');
  assert.deepEqual(await total(casoA.id), { total: '115.75', n: 2 });
});

test('FE-89: cero, negativo, tres decimales y sesión de otro caso se rechazan', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA inválidos', terapeuta: PERFILES.t1 });
  const sesion = await crearSesion(sql, caso.id);
  const sesionSinPagoDeB = await crearSesion(sql, casoB.id, { responsable: PERFILES.t2 });
  await rechaza(pagar(caso.id, sesion.id, '0'), '23514');
  await rechaza(pagar(caso.id, sesion.id, '-10'), '23514');
  await rechaza(pagar(caso.id, sesion.id, '75.555'), '23514');
  await rechaza(pagar(caso.id, sesionSinPagoDeB.id, '10'), '23503');
  await rechaza(pagar(caso.id, null, '10'), '23502');
  await rechaza(pagar(caso.id, sesion.id, '10', { metodo: 'tarjeta' }), '23514');
  assert.deepEqual(await total(caso.id), { total: '0', n: 0 });
  assert.deepEqual(await total(casoB.id), { total: '125.00', n: 1 });
});

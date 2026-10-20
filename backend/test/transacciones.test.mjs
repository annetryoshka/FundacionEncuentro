import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';

function preparar() {
  const pasos = [];
  const client = { query: async (sql, params) => { pasos.push({ sql, params }); },
    release: () => pasos.push({ sql: 'RELEASE' }) };
  const servicio = Object.create(DatabaseService.prototype);
  servicio.pool = { connect: async () => client };
  return { servicio, client, pasos };
}
test('transacción asocia actor con parámetros, confirma y libera conexión', async () => {
  const { servicio, pasos, client } = preparar();
  const actor = '00000000-0000-4000-8000-000000000001';
  const resultado = await servicio.transaction(actor, async (conexion) => {
    assert.equal(conexion, client); await conexion.query('ESCRITURA SIMULADA'); return 'ok';
  });
  assert.equal(resultado, 'ok');
  assert.deepEqual(pasos.map((p) => p.sql), ['BEGIN', "select set_config('app.usuario_id', $1, true)",
    'ESCRITURA SIMULADA', 'COMMIT', 'RELEASE']);
  assert.deepEqual(pasos[1].params, [actor]);
});
test('fallo en escritura revierte, propaga error y libera conexión', async () => {
  const { servicio, pasos } = preparar();
  const fallo = new Error('Fallo simulado');
  await assert.rejects(servicio.transaction(null, async () => { throw fallo; }), (error) => error === fallo);
  assert.deepEqual(pasos.map((p) => p.sql), ['BEGIN', "select set_config('app.usuario_id', $1, true)",
    'ROLLBACK', 'RELEASE']);
  assert.deepEqual(pasos[1].params, ['']);
});

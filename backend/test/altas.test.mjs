import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, beforeEach, after, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { actor, datos, servidor } from './helpers/casos.mjs';

let api, estado, fallo, pasos;
const vacio = () => ({ pacientes: [], casos: [], judicial: [], contadores: { voluntario: 0, derivado: 0 } });
function ejecutar(sql, params, almacen) {
  const rows = (valores) => ({ rows: valores });
  if (sql.includes('select id, nombre_completo, rol, activo')) {
    return rows([{ id: actor, nombre_completo: 'Administrador ficticio', rol: 'administrador', activo: true }]);
  }
  if (sql.includes('current_date')) return rows([{ hoy: '2026-01-01' }]);
  if (sql.startsWith('insert into pacientes')) {
    if (fallo === 'paciente') throw new Error('Fallo simulado');
    const p = { id: randomUUID(), nombre_completo: params[0], fecha_nacimiento: params[1], telefono: params[4] };
    almacen.pacientes.push(p); return rows([{ id: p.id }]);
  }
  if (sql.startsWith('insert into casos')) {
    if (fallo === 'caso') throw new Error('Fallo simulado');
    const c = { id: randomUUID(), paciente_id: params[0], tipo: params[1], estado: params[2] ?? 'iniciado',
      fecha_ingreso: params[3], numero_correlativo: ++almacen.contadores[params[1]] };
    almacen.casos.push(c); return rows([{ id: c.id }]);
  }
  if (sql.startsWith('insert into contexto_judicial')) {
    if (fallo === 'judicial') throw new Error('Fallo simulado');
    almacen.judicial.push({ caso_id: params[0], judicial_id: randomUUID(), juzgado: params[1] }); return rows([]);
  }
  if (sql.includes('extensions.similarity')) {
    if (fallo === 'duplicados') throw new Error('Fallo simulado');
    return rows(almacen.pacientes.filter((p) => p.id !== params[1] && p.nombre_completo === params[0])
      .map((p) => ({ ...p, similitud: 1 })));
  }
  if (sql.includes('left join contexto_judicial')) {
    if (fallo === 'lectura') throw new Error('Fallo simulado');
    const c = almacen.casos.find((c) => c.id === params[0]);
    if (!c) return rows([]);
    const p = almacen.pacientes.find((p) => p.id === c.paciente_id);
    return rows([{ ...p, ...c, ...(almacen.judicial.find((j) => j.caso_id === c.id) ?? {}) }]);
  }
  throw new Error('SQL no previsto en el doble');
}
const db = Object.create(DatabaseService.prototype);
db.query = async (sql, params) => ejecutar(sql, params, estado);
db.pool = { end: async () => {}, connect: async () => {
  let temporal;
  return { query: async (sql, params) => {
    pasos.push(sql);
    if (sql === 'BEGIN') { temporal = structuredClone(estado); return; }
    if (sql === 'COMMIT') { estado = temporal; return; }
    if (sql === 'ROLLBACK' || sql.includes('set_config')) return;
    return ejecutar(sql, params, temporal);
  }, release() {} };
} };
before(async () => { api = await servidor(db); });
beforeEach(() => { estado = vacio(); fallo = null; pasos = []; });
after(async () => { await api?.close(); });

test('alta válida: 201, paciente/caso vinculados y lectura posterior (doble)', async () => {
  const res = await api.post(datos('  Paciente QA  '));
  assert.equal(res.status, 201);
  const c = await res.json();
  assert.equal(c.paciente.nombreCompleto, 'Paciente QA');
  assert.equal(c.fechaIngreso, '2020-01-01'); assert.equal(c.numeroCorrelativo, 1);
  assert.equal(estado.casos[0].paciente_id, estado.pacientes[0].id);
  assert.equal((await api.get(c.id)).status, 200);
  assert.ok(pasos.includes('COMMIT'));
  assert.ok(pasos.find((s) => s.startsWith('insert into casos'))?.includes('numero_correlativo') === false);
});
test('alta derivada incluye contexto judicial en la misma transacción', async () => {
  const res = await api.post({ ...datos('Paciente QA judicial', 'derivado'), contextoJudicial: { juzgado: 'Juzgado QA' } });
  assert.equal(res.status, 201);
  const c = await res.json(); assert.equal(c.contextoJudicial.juzgado, 'Juzgado QA');
  assert.equal(estado.judicial[0].caso_id, c.id);
  assert.equal(pasos.filter((s) => s === 'BEGIN').length, 1);
});
for (const nombre of ['', '   ']) {
  test(`nombre ${nombre ? 'solo espacios' : 'vacío'}: 400 sin registros`, async () => {
    assert.equal((await api.post(datos(nombre))).status, 400); assert.deepEqual(estado, vacio());
  });
}
for (const fecha of ['no-fecha', '2025-02-29', '2026-02-31', '01/01/2020', '2020-01-01T00:00:00Z', '2999-01-01']) {
  test(`fecha inválida o futura ${fecha}: 400 sin registros`, async () => {
    const body = datos(); body.caso.fechaIngreso = fecha;
    assert.equal((await api.post(body)).status, 400); assert.deepEqual(estado, vacio());
  });
}
test('fecha omitida toma current_date de la DB simulada', async () => {
  const body = datos(); delete body.caso.fechaIngreso;
  const res = await api.post(body); assert.equal(res.status, 201);
  assert.equal((await res.json()).fechaIngreso, '2026-01-01');
});
test('fecha de nacimiento posterior al ingreso: 400', async () => {
  const body = datos(); body.paciente.fechaNacimiento = '2021-01-01';
  assert.equal((await api.post(body)).status, 400); assert.deepEqual(estado, vacio());
});
test('caso voluntario con contexto judicial: 400', async () => {
  assert.equal((await api.post({ ...datos(), contextoJudicial: {} })).status, 400);
  assert.deepEqual(estado, vacio());
});
test('no se permite imponer el correlativo desde la petición', async () => {
  const body = datos(); body.caso.numeroCorrelativo = 99;
  assert.equal((await api.post(body)).status, 400); assert.deepEqual(estado, vacio());
});
for (const etapa of ['paciente', 'caso', 'judicial']) {
  test(`fallo de ${etapa}: 500 y ROLLBACK solicitado, sin parciales en el doble`, async () => {
    fallo = etapa;
    assert.equal((await api.post({ ...datos('Paciente QA fallo', 'derivado'), contextoJudicial: {} })).status, 500);
    assert.deepEqual(estado, vacio()); assert.ok(pasos.includes('ROLLBACK'));
    assert.equal(pasos.includes('COMMIT'), false);
  });
}
test('posible duplicado es advertencia, no bloqueo: crea otro paciente y carpeta', async () => {
  assert.equal((await api.post(datos())).status, 201);
  const res = await api.post(datos()); assert.equal(res.status, 201);
  const body = await res.json(); assert.equal(body.posiblesDuplicados.length, 1);
  assert.equal(body.posiblesDuplicados[0].pacienteId, estado.pacientes[0].id);
  assert.equal(estado.pacientes.length, 2); assert.equal(estado.casos.length, 2);
});
for (const etapa of ['lectura', 'duplicados']) {
  test(`DEFECTO: fallo poscommit en ${etapa} devuelve 500 aunque el alta ya existe`, async () => {
    fallo = etapa;
    assert.equal((await api.post(datos())).status, 500);
    assert.equal(estado.pacientes.length, 1); assert.equal(estado.casos.length, 1);
    assert.ok(pasos.includes('COMMIT')); assert.equal(pasos.includes('ROLLBACK'), false);
  });
}

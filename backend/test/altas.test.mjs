import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, beforeEach, after, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { actor, datos, servidor } from './helpers/casos.mjs';

let api, estado, fallo, pasos, rol;
const vacio = () => ({ pacientes: [], casos: [], judicial: [], contadores: { voluntario: 0, derivado: 0 } });
function ejecutar(sql, params, almacen) {
  const rows = (valores) => ({ rows: valores });
  if (sql.includes('select id, nombre_completo, rol, activo')) {
    return rows([{ id: actor, nombre_completo: 'Administrador ficticio', rol, activo: true }]);
  }
  if (sql.startsWith('select 1 from pacientes')) {
    const existe = almacen.pacientes.some((p) => p.id === params[0]);
    return { rows: existe ? [{}] : [], rowCount: existe ? 1 : 0 };
  }
  if (sql.includes('current_date')) return rows([{ hoy: '2026-01-01' }]);
  if (sql.startsWith('insert into pacientes')) {
    if (fallo === 'paciente') throw new Error('Fallo simulado');
    const p = { id: randomUUID(), nombre_completo: params[0], fecha_nacimiento: params[1], telefono: params[4] };
    almacen.pacientes.push(p); return rows([{ id: p.id }]);
  }
  if (sql.startsWith('insert into casos')) {
    if (fallo === 'caso') throw new Error('Fallo simulado');
    const numero = params[8] ?? almacen.contadores[params[1]] + 1;
    if (almacen.casos.some((c) => c.tipo === params[1] && c.numero_correlativo === numero)) {
      throw Object.assign(new Error('Número duplicado simulado'), { code: '23505', constraint: 'uq_caso_numero' });
    }
    almacen.contadores[params[1]] = Math.max(almacen.contadores[params[1]], numero);
    const c = { id: randomUUID(), paciente_id: params[0], tipo: params[1], estado: params[2] ?? 'iniciado',
      fecha_ingreso: params[3], numero_correlativo: numero };
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
  if (sql.includes('left join contexto_judicial') || sql.includes('left join asignaciones_caso')) {
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
beforeEach(() => { estado = vacio(); fallo = null; pasos = []; rol = 'administrador'; });
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
  const commit = pasos.indexOf('COMMIT');
  for (const consulta of ['left join contexto_judicial', 'extensions.similarity']) {
    const posicion = pasos.findIndex((sql) => sql.includes(consulta));
    assert.ok(posicion >= 0 && posicion < commit, 'Las lecturas de respuesta deben usar el cliente antes del COMMIT');
  }
  const detalle = await api.detalle(c.id); assert.equal(detalle.status, 200);
  assert.equal((await detalle.json()).numero, c.numeroCorrelativo);
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
test('FE-33 permite número manual y rechaza duplicidad con 409 sin registros parciales', async () => {
  const body = datos(); body.caso.numeroCorrelativo = 99;
  const res = await api.post(body); assert.equal(res.status, 201);
  assert.equal((await res.json()).numeroCorrelativo, 99);
  const anterior = structuredClone(estado);
  assert.equal((await api.post(body)).status, 409); assert.deepEqual(estado, anterior);
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
  test(`fallo de respuesta en ${etapa} revierte el alta antes de confirmar`, async () => {
    fallo = etapa;
    assert.equal((await api.post(datos())).status, 500);
    assert.deepEqual(estado, vacio());
    assert.equal(pasos.includes('COMMIT'), false); assert.ok(pasos.includes('ROLLBACK'));
  });
}

test('FE-33 abre otra carpeta para un paciente existente sin volver a crearlo', async () => {
  const primera = await api.post(datos()); const c = await primera.json();
  const res = await api.post({ pacienteId: c.paciente.id, caso: { tipo: 'derivado' } });
  assert.equal(res.status, 201); assert.equal((await res.json()).paciente.id, c.paciente.id);
  assert.equal(estado.pacientes.length, 1); assert.equal(estado.casos.length, 2);
});
test('pacienteId inexistente: 404; ambos identificadores o ninguno: 400', async () => {
  for (const [body, status] of [
    [{ pacienteId: randomUUID(), caso: { tipo: 'voluntario' } }, 404],
    [{ ...datos(), pacienteId: randomUUID() }, 400], [{ caso: { tipo: 'voluntario' } }, 400],
  ]) assert.equal((await api.post(body)).status, status);
  assert.deepEqual(estado, vacio());
});
test('sin autenticación o token inválido: 401 sin escrituras', async () => {
  for (const token of [null, 'invalido']) assert.equal((await api.post(datos(), { token })).status, 401);
  assert.deepEqual(estado, vacio()); assert.equal(pasos.length, 0);
});
for (const perfil of ['terapeuta', 'marketing']) {
  test(`${perfil}: alta rechazada con 403 sin escrituras`, async () => {
    rol = perfil; assert.equal((await api.post(datos())).status, 403);
    assert.deepEqual(estado, vacio()); assert.equal(pasos.length, 0);
  });
}

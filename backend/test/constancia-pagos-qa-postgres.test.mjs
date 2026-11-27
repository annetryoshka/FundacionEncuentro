import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { IndicadoresModule } from '../dist/modules/indicadores/indicadores.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, crearBase, crearCaso, opciones } from './helpers/pg-qa.mjs';

const REGISTRADA = {
  procedencia: 'Referencia ficticia QA',
  origenJudicial: false,
  estado: 'registrado',
  fechaConsentimiento: '2026-11-20',
  referenciaEvidencia: 'qa/consentimiento-A',
  explicacion: null,
  contextoJudicial: null,
};

let base, sql, api, A, B, sesiones;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe191');
  sql = base.cliente;
  A = await crearCaso(sql, { nombre: 'Paciente QA constancia A', terapeuta: PERFILES.t1, fechaIngreso: '2026-11-01' });
  B = await crearCaso(sql, { nombre: 'Paciente QA constancia B', terapeuta: PERFILES.t2, fechaIngreso: '2026-11-01' });
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing }, { modulos: [IndicadoresModule] });
  sesiones = {};
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 'admin', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}
const constancia = (caso, token = 'admin') => pedir(`/carpetas/${caso.id}/constancia`, { token });
const guardarConstancia = (caso, cuerpo, token = 'admin') => pedir(`/carpetas/${caso.id}/constancia`, { token, metodo: 'PUT', cuerpo });
const pagar = (caso, cuerpo, token = 'admin') => pedir(`/carpetas/${caso.id}/pagos`, { token, metodo: 'POST', cuerpo });
const pagos = async (caso) => (await pedir(`/carpetas/${caso.id}/pagos`)).cuerpo.pagos;
const cantidadPagos = async () => (await sql.query('select count(*)::int as n from pagos')).rows[0].n;

test('C1 · regla ratificada: con el consentimiento pendiente se atiende (se registran sesiones)', opciones, async () => {
  const pendiente = await guardarConstancia(A, { ...REGISTRADA, estado: 'pendiente', fechaConsentimiento: null, referenciaEvidencia: null });
  assert.equal(pendiente.status, 200, JSON.stringify(pendiente.cuerpo));
  for (const [clave, fecha] of [['a1', '2026-11-20'], ['a2', '2026-11-21'], ['a3', '2026-11-22']]) {
    const r = await pedir(`/carpetas/${A.id}/sesiones`, { token: 't1', metodo: 'POST', cuerpo: { fecha, evolucion: `Evolución QA ${clave}` } });
    assert.equal(r.status, 201, `La atención no se bloquea con el consentimiento pendiente: ${JSON.stringify(r.cuerpo)}`);
    sesiones[clave] = r.cuerpo.sesion.id;
  }
  const b1 = await pedir(`/carpetas/${B.id}/sesiones`, { token: 't2', metodo: 'POST', cuerpo: { fecha: '2026-11-20', evolucion: 'Evolución QA b1' } });
  sesiones.b1 = b1.cuerpo.sesion.id;
  assert.equal((await constancia(A)).cuerpo.constancia.estado, 'pendiente', 'Sigue pendiente: no se presenta como registrada');
});

test('C2 · constancia: combinaciones inválidas dan 400 y no alteran la anterior', opciones, async () => {
  assert.equal((await guardarConstancia(A, REGISTRADA)).status, 200);
  const antes = (await constancia(A)).cuerpo;
  const casos = [
    ['pendiente con fecha', { estado: 'pendiente', fechaConsentimiento: '2026-11-20', referenciaEvidencia: null }],
    ['pendiente con evidencia', { estado: 'pendiente', fechaConsentimiento: null, referenciaEvidencia: 'qa/x' }],
    ['registrada sin evidencia', { referenciaEvidencia: null }],
    ['registrada con fecha imposible', { fechaConsentimiento: '2026-02-30' }],
    ['registrada con explicación', { explicacion: 'No corresponde' }],
    ['no aplica sin explicación', { estado: 'no_aplica', fechaConsentimiento: null, referenciaEvidencia: null, explicacion: '   ' }],
    ['no aplica con fecha', { estado: 'no_aplica', referenciaEvidencia: null, explicacion: 'Motivo QA' }],
    ['judicial sin juzgado', { origenJudicial: true, contextoJudicial: null }],
    ['estado desconocido', { estado: 'firmado' }],
  ];
  for (const [nombre, cambio] of casos) {
    assert.equal((await guardarConstancia(A, { ...REGISTRADA, ...cambio })).status, 400, nombre);
  }
  assert.deepEqual((await constancia(A)).cuerpo, antes, 'La constancia anterior se conserva');
});

test('C3 · constancia: no aplica y judicial válidos se guardan y recargan; terapeuta ajena no la ve', opciones, async () => {
  const noAplica = await guardarConstancia(B, { ...REGISTRADA, estado: 'no_aplica', fechaConsentimiento: null, referenciaEvidencia: null, explicacion: 'Motivo ficticio QA' });
  assert.equal(noAplica.status, 200, JSON.stringify(noAplica.cuerpo));
  const judicial = { ...REGISTRADA, origenJudicial: true, contextoJudicial: { juzgado: 'Juzgado ficticio QA', nroExpediente: 'EXP-QA-191', fechaDerivacion: '2026-11-10' } };
  assert.equal((await guardarConstancia(B, judicial)).status, 200);
  assert.ok(JSON.stringify((await constancia(B)).cuerpo).includes('Juzgado ficticio QA'), 'Recarga el contexto judicial');
  const ajena = await constancia(B, 't1');
  assert.ok([403, 404].includes(ajena.status), `terapeuta ajena: ${ajena.status}`);
  assert.ok(!JSON.stringify(ajena.cuerpo).includes('Juzgado ficticio QA'));
});

test('P1 · regla ratificada: un pago por sesión; reintento idéntico devuelve el mismo sin duplicar', opciones, async () => {
  const cuerpo = { sesionId: sesiones.a1, monto: '75.50', fecha: '2026-11-20', metodo: 'qr', referencia: 'QA-PAGO-A1' };
  const primero = await pagar(A, cuerpo);
  assert.equal(primero.status, 200, JSON.stringify(primero.cuerpo));
  assert.equal(primero.cuerpo.reutilizado, false);
  const reintento = await pagar(A, cuerpo);
  assert.equal(reintento.status, 200);
  assert.equal(reintento.cuerpo.reutilizado, true);
  assert.equal(reintento.cuerpo.pago.id, primero.cuerpo.pago.id);
  assert.equal((await pagos(A)).length, 1);
});

test('P2 · misma sesión con otros datos: 409, sin reemplazar ni duplicar', opciones, async () => {
  const antes = await cantidadPagos();
  for (const cambio of [{ monto: '80.00' }, { metodo: 'transferencia' }, { fecha: '2026-11-21' }, { referencia: 'OTRA' }]) {
    const r = await pagar(A, { sesionId: sesiones.a1, monto: '75.50', fecha: '2026-11-20', metodo: 'qr', referencia: 'QA-PAGO-A1', ...cambio });
    assert.equal(r.status, 409, JSON.stringify(cambio));
  }
  assert.equal(await cantidadPagos(), antes);
  assert.equal((await pagos(A))[0].monto, '75.50');
});

test('P3 · regla ratificada: solo QR o transferencia (efectivo no se habilita)', opciones, async () => {
  for (const metodo of ['efectivo', 'tarjeta', 'QR', '']) {
    assert.equal((await pagar(A, { sesionId: sesiones.a2, monto: '10.00', fecha: '2026-11-21', metodo })).status, 400, metodo);
  }
  const transferencia = await pagar(A, { sesionId: sesiones.a2, monto: '100.00', fecha: '2026-11-21', metodo: 'transferencia' });
  assert.equal(transferencia.status, 200);
});

test('P4 · montos, fechas y sesiones inválidas: rechazo sin escritura parcial', opciones, async () => {
  const antes = await cantidadPagos();
  const base_ = { sesionId: sesiones.a3, monto: '10.00', fecha: '2026-11-22', metodo: 'qr' };
  for (const [nombre, cambio, esperado] of [
    ['monto cero', { monto: '0.00' }, 400],
    ['monto negativo', { monto: '-5.00' }, 400],
    ['tres decimales', { monto: '10.005' }, 400],
    ['coma decimal', { monto: '10,50' }, 400],
    ['monto numérico', { monto: 10 }, 400],
    ['fecha imposible', { fecha: '2026-02-30' }, 400],
    ['sesión de otro caso', { sesionId: sesiones.b1 }, null],
    ['sesión inexistente', { sesionId: '00000000-0000-4000-8000-00000000f191' }, null],
    ['moneda enviada por el cliente', { moneda: 'USD' }, 400],
    ['autor enviado por el cliente', { registradoPor: PERFILES.t1 }, 400],
  ]) {
    const r = await pagar(A, { ...base_, ...cambio });
    if (esperado) assert.equal(r.status, esperado, nombre);
    else assert.ok(r.status >= 400 && r.status < 500, `${nombre}: ${r.status}`);
  }
  assert.equal(await cantidadPagos(), antes);
});

test('P5 · permisos: terapeuta y marketing no registran ni ven montos; el historial clínico no los muestra', opciones, async () => {
  for (const token of ['t1', 'mkt']) {
    assert.equal((await pedir(`/carpetas/${A.id}/pagos`, { token })).status, 403, `GET ${token}`);
    assert.equal((await pagar(A, { sesionId: sesiones.a3, monto: '1.00', fecha: '2026-11-22', metodo: 'qr' }, token)).status, 403, `POST ${token}`);
  }
  const historial = await pedir(`/carpetas/${A.id}/historial`, { token: 't1' });
  assert.equal(historial.status, 200);
  assert.ok(!/75[.,]50|100[.,]00|QA-PAGO-A1|"monto"/.test(JSON.stringify(historial.cuerpo)), 'La terapeuta no recibe montos en el historial');
});

test('K1 · conciliación: los indicadores suman exactamente los pagos registrados, una vez cada uno', opciones, async () => {
  const lista = await pagos(A);
  const suma = lista.reduce((s, p) => s + Number(p.monto), 0).toFixed(2);
  assert.equal(suma, '175.50');
  const ind = await pedir('/indicadores?desde=2026-11-20&hasta=2026-11-22');
  assert.equal(ind.status, 200);
  assert.equal(ind.cuerpo.pagosRecibidos.monto, '175.50', 'El total del período coincide con la lista de pagos');
  assert.equal(ind.cuerpo.sesiones, 4, '3 sesiones de A y 1 de B en el período');
  const reintento = await pagar(A, { sesionId: sesiones.a1, monto: '75.50', fecha: '2026-11-20', metodo: 'qr', referencia: 'QA-PAGO-A1' });
  assert.equal(reintento.cuerpo.reutilizado, true);
  assert.equal((await pedir('/indicadores?desde=2026-11-20&hasta=2026-11-22')).cuerpo.pagosRecibidos.monto, '175.50', 'Un reintento no duplica el ingreso');
  const fuera = await pedir('/indicadores?desde=2026-11-23&hasta=2026-11-30');
  assert.equal(fuera.cuerpo.pagosRecibidos.monto, '0.00');
});

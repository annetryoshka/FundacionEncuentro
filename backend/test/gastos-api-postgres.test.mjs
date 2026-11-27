import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { GastosModule } from '../dist/modules/gastos/gastos.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, crearBase, opciones } from './helpers/pg-qa.mjs';

let base, sql, api;
const ids = {};

const hoyLaPaz = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
const manana = () => {
  const d = new Date(`${hoyLaPaz()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe174');
  sql = base.cliente;
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, mkt: PERFILES.marketing }, [GastosModule]);
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 'admin', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null, cache: r.headers.get('cache-control') };
}
const registrar = (cuerpo, token) => pedir('/gastos', { metodo: 'POST', cuerpo, token });
const mes = async (m = '2026-11') => (await pedir(`/gastos?mes=${m}`)).cuerpo;
const porCategoria = (r) => Object.fromEntries(r.totalesPorCategoria.map((c) => [c.categoria, [c.cantidad, c.total]]));
const filas = async () => (await sql.query("select count(*)::int as n from movimientos_contables where tipo = 'egreso'")).rows[0].n;

test('G1 · registrar el ejemplo de FE-172 y consultar noviembre: total 1700.00', opciones, async () => {
  for (const [clave, cuerpo] of [
    ['internet', { categoria: 'internet', fecha: '2026-11-20', monto: '120.00', descripcion: 'Servicio mensual ficticio' }],
    ['electricidad', { categoria: 'electricidad', fecha: '2026-11-21', monto: '80.00' }],
    ['alquiler', { categoria: 'alquiler', fecha: '2026-11-22', monto: '1500' }],
  ]) {
    const r = await registrar(cuerpo);
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.registradoPor, PERFILES.admin);
    assert.equal(r.cuerpo.anulado, false);
    ids[clave] = r.cuerpo.id;
  }
  const r = await pedir('/gastos?mes=2026-11');
  assert.equal(r.status, 200);
  assert.equal(r.cache, 'private, no-store');
  assert.equal(r.cuerpo.mes, '2026-11');
  assert.equal(r.cuerpo.totalMes, '1700.00');
  assert.deepEqual(r.cuerpo.gastos.map((g) => g.monto), ['120.00', '80.00', '1500.00'], 'Por fecha y siempre con dos decimales');
  assert.deepEqual(porCategoria(r.cuerpo), {
    internet: [1, '120.00'], electricidad: [1, '80.00'], alquiler: [1, '1500.00'], otros: [0, '0.00'],
  });
});

test('G2 · corregir electricidad a 85.00 deja el total en 1705.00', opciones, async () => {
  const r = await pedir(`/gastos/${ids.electricidad}`, { metodo: 'PATCH', cuerpo: { categoria: 'electricidad', fecha: '2026-11-21', monto: '85.00' } });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.monto, '85.00');
  assert.equal(r.cuerpo.actualizadoPor, PERFILES.admin);
  assert.equal((await mes()).totalMes, '1705.00');
});

test('G3 · anular internet deja 1585.00; repetir la anulación no vuelve a restar', opciones, async () => {
  const primera = await pedir(`/gastos/${ids.internet}/anular`, { metodo: 'POST', cuerpo: { motivo: '  Registrado por error  ' } });
  assert.equal(primera.status, 200, JSON.stringify(primera.cuerpo));
  assert.equal(primera.cuerpo.anulado, true);
  assert.equal(primera.cuerpo.motivoAnulacion, 'Registrado por error');
  const segunda = await pedir(`/gastos/${ids.internet}/anular`, { metodo: 'POST', cuerpo: {} });
  assert.equal(segunda.status, 200);
  assert.equal(segunda.cuerpo.anuladoEn, primera.cuerpo.anuladoEn, 'La segunda anulación no escribe');
  const r = await mes();
  assert.equal(r.totalMes, '1585.00');
  assert.equal(r.cantidadAnulados, 1);
  assert.ok(r.gastos.find((g) => g.id === ids.internet).anulado, 'El anulado sigue identificable en la lista');
});

test('G4 · un gasto anulado no se corrige (409) y el total no cambia', opciones, async () => {
  const r = await pedir(`/gastos/${ids.internet}`, { metodo: 'PATCH', cuerpo: { categoria: 'internet', fecha: '2026-11-20', monto: '999.00' } });
  assert.equal(r.status, 409);
  assert.equal((await mes()).totalMes, '1585.00');
});

test('G5 · cambiar la fecha a octubre mueve el gasto entre meses', opciones, async () => {
  await pedir(`/gastos/${ids.electricidad}`, { metodo: 'PATCH', cuerpo: { categoria: 'electricidad', fecha: '2026-10-30', monto: '85.00' } });
  assert.equal((await mes('2026-11')).totalMes, '1500.00');
  assert.equal((await mes('2026-10')).totalMes, '85.00');
  await pedir(`/gastos/${ids.electricidad}`, { metodo: 'PATCH', cuerpo: { categoria: 'electricidad', fecha: '2026-11-21', monto: '85.00' } });
  assert.equal((await mes('2026-11')).totalMes, '1585.00');
});

test('G6 · un mes sin gastos devuelve lista vacía y 0.00 en todo', opciones, async () => {
  const r = await mes('2026-12');
  assert.deepEqual(r.gastos, []);
  assert.equal(r.totalMes, '0.00');
  assert.ok(r.totalesPorCategoria.every((c) => c.total === '0.00' && c.cantidad === 0));
  assert.equal(r.totalesPorCategoria.length, 4);
});

test('G7 · sin mes se consulta el mes actual de Bolivia', opciones, async () => {
  const r = await pedir('/gastos');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.mes, hoyLaPaz().slice(0, 7));
});

test('G8 · varios «otros» del mismo mes se suman con su descripción', opciones, async () => {
  for (const monto of ['0.10', '0.20']) {
    assert.equal((await registrar({ categoria: 'otros', fecha: '2026-08-05', monto, descripcion: 'Material de limpieza ficticio' })).status, 201);
  }
  assert.deepEqual(porCategoria(await mes('2026-08')).otros, [2, '0.30']);
});

test('G9 · datos inválidos: 400 sin escrituras parciales', opciones, async () => {
  const antes = await filas();
  const valido = { categoria: 'internet', fecha: '2026-11-20', monto: '10.00' };
  const casos = [
    ['monto cero', { monto: '0.00' }],
    ['monto negativo', { monto: '-1.00' }],
    ['tres decimales', { monto: '10.005' }],
    ['monto mayor al máximo', { monto: '100000000.00' }],
    ['monto como número', { monto: 10 }],
    ['categoría desconocida', { categoria: 'agua' }],
    ['fecha imposible', { fecha: '2026-02-30' }],
    ['fecha futura', { fecha: manana() }],
    ['fecha anterior a 2000', { fecha: '1999-12-31' }],
    ['otros sin descripción', { categoria: 'otros' }],
    ['otros con descripción en blanco', { categoria: 'otros', descripcion: '   ' }],
    ['descripción de 201', { descripcion: 'x'.repeat(201) }],
    ['campo de autoría', { registradoPor: PERFILES.t1 }],
    ['tipo ingreso', { tipo: 'ingreso' }],
    ['pago de sesión', { pagoId: '00000000-0000-4000-8000-000000000999' }],
  ];
  for (const [nombre, cambio] of casos) {
    const r = await registrar({ ...valido, ...cambio });
    assert.equal(r.status, 400, `${nombre}: ${JSON.stringify(r.cuerpo)}`);
  }
  for (const consulta of ['2026-13', '26-11', 'noviembre', '2026-11-01']) {
    assert.equal((await pedir(`/gastos?mes=${consulta}`)).status, 400, `mes=${consulta}`);
  }
  assert.equal(await filas(), antes, 'Ningún rechazo escribe');
});

test('G10 · inexistente o un ingreso: 404; un id que no es UUID: 400', opciones, async () => {
  const inexistente = '00000000-0000-4000-8000-00000000f174';
  assert.equal((await pedir(`/gastos/${inexistente}/anular`, { metodo: 'POST', cuerpo: {} })).status, 404);
  assert.equal((await pedir(`/gastos/${inexistente}`, { metodo: 'PATCH', cuerpo: { categoria: 'internet', fecha: '2026-11-20', monto: '1.00' } })).status, 404);
  const { rows: [ingreso] } = await sql.query(
    "insert into movimientos_contables (fecha, tipo, monto, descripcion) values ('2026-11-10', 'ingreso', 50, 'Ingreso QA') returning id");
  assert.equal((await pedir(`/gastos/${ingreso.id}/anular`, { metodo: 'POST', cuerpo: {} })).status, 404, 'Un ingreso no es un gasto');
  assert.equal((await pedir(`/gastos/${ingreso.id}`, { metodo: 'PATCH', cuerpo: { categoria: 'internet', fecha: '2026-11-20', monto: '1.00' } })).status, 404);
  assert.equal((await mes()).totalMes, '1585.00', 'El ingreso no suma como gasto');
  assert.equal((await pedir('/gastos/no-es-uuid/anular', { metodo: 'POST', cuerpo: {} })).status, 400);
});

test('G11 · solo administración: terapeuta, marketing y sin sesión no registran, corrigen, anulan ni consultan', opciones, async () => {
  const antes = await filas();
  for (const [token, esperado] of [['t1', 403], ['mkt', 403], [null, 401]]) {
    assert.equal((await pedir('/gastos?mes=2026-11', { token })).status, esperado, `GET ${token}`);
    assert.equal((await registrar({ categoria: 'internet', fecha: '2026-11-20', monto: '1.00' }, token)).status, esperado, `POST ${token}`);
    assert.equal((await pedir(`/gastos/${ids.alquiler}`, { token, metodo: 'PATCH', cuerpo: { categoria: 'alquiler', fecha: '2026-11-22', monto: '1.00' } })).status, esperado, `PATCH ${token}`);
    assert.equal((await pedir(`/gastos/${ids.alquiler}/anular`, { token, metodo: 'POST', cuerpo: {} })).status, esperado, `anular ${token}`);
  }
  assert.equal(await filas(), antes);
  assert.equal((await mes()).totalMes, '1585.00');
});

test('G12 · cada alta, corrección y anulación queda en auditoría con su autor', opciones, async () => {
  const { rows } = await sql.query(
    `select accion, usuario_id from auditoria
      where tabla = 'movimientos_contables' and registro_id = $1 order by id`, [ids.internet]);
  assert.ok(rows.length >= 2, 'Alta y anulación auditadas');
  assert.ok(rows.every((r) => r.usuario_id === PERFILES.admin));
});

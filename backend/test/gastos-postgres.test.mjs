// FE-173: gastos de funcionamiento y totales mensuales (migración 022, contrato FE-172). Datos ficticios.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, ingresoPrevio;
const ids = {};

const hoyLaPaz = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const registrar = (datos, usuario = PERFILES.admin) => comoUsuario(sql, usuario, async () => {
  const campos = { tipo: 'egreso', ...datos };
  const columnas = Object.keys(campos);
  const { rows } = await sql.query(
    `insert into movimientos_contables (${columnas.join(', ')})
     values (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(campos));
  return rows[0];
});
const corregir = (id, datos, usuario = PERFILES.admin) => comoUsuario(sql, usuario, async () => {
  const columnas = Object.keys(datos);
  const { rows } = await sql.query(
    `update movimientos_contables set ${columnas.map((c, i) => `${c} = $${i + 2}`).join(', ')}
      where id = $1 returning *`, [id, ...Object.values(datos)]);
  return rows[0];
});
const consultar = (mes, usuario = PERFILES.admin) => comoUsuario(sql, usuario, async () =>
  (await sql.query('select consultar_gastos_mes($1) as r', [mes])).rows[0].r);
const anular = (id, motivo = null, usuario = PERFILES.admin) => comoUsuario(sql, usuario, async () =>
  (await sql.query('select anular_gasto($1, $2) as g', [id, motivo])).rows[0].g);
const leer = async (id) => (await sql.query('select * from movimientos_contables where id = $1', [id])).rows[0];
const contar = async () => (await sql.query(`select count(*)::int as n from movimientos_contables`)).rows[0].n;
const totales = (r) => Object.fromEntries(r.totalesPorCategoria.map((c) => [c.categoria, [c.cantidad, c.total]]));

before(async () => {
  if (opciones.skip) return;
  // Movimiento cargado con 001–021; la 022 se aplica después, como en Supabase.
  base = await crearBase('fe173', { hasta: '021' });
  sql = base.cliente;
  ingresoPrevio = (await sql.query(
    `insert into movimientos_contables (fecha, tipo, monto, descripcion)
     values ('2026-10-15', 'ingreso', 75.50, 'Ingreso previo QA') returning *`)).rows[0];
  await base.migrar();
});
after(async () => { await base?.cerrar(); });

test('FE-173: la 022 conserva los movimientos existentes y no exige datos de gasto a los ingresos', opciones, async () => {
  const previo = await leer(ingresoPrevio.id);
  assert.equal(previo.monto, '75.50');
  assert.equal(previo.tipo, 'ingreso');
  assert.equal(previo.anulado_en, null);
  // Un ingreso no pasa por las reglas de gasto ni pide administración.
  const { rows } = await sql.query(
    `insert into movimientos_contables (fecha, tipo, monto) values ('2026-10-16', 'ingreso', 10) returning id`);
  await sql.query('delete from movimientos_contables where id = $1', [rows[0].id]);
  // La fecha ya no tiene valor por defecto en UTC: la envía la API.
  await rechaza(registrar({ categoria: 'internet', monto: '1.00' }), '23502');
});

test('FE-173: mes sin gastos devuelve lista vacía, total 0.00 y las cuatro categorías', opciones, async () => {
  const r = await consultar('2026-09');
  assert.deepEqual(r, {
    mes: '2026-09', gastos: [], totalMes: '0.00', cantidadVigentes: 0, cantidadAnulados: 0,
    totalesPorCategoria: [
      { categoria: 'internet', cantidad: 0, total: '0.00' },
      { categoria: 'electricidad', cantidad: 0, total: '0.00' },
      { categoria: 'alquiler', cantidad: 0, total: '0.00' },
      { categoria: 'otros', cantidad: 0, total: '0.00' },
    ],
  });
});

test('FE-173: ejemplo de FE-172, noviembre suma 1700.00 con totales por categoría', opciones, async () => {
  const internet = await registrar({ categoria: 'internet', fecha: '2026-11-20', monto: '120.00', descripcion: 'Servicio mensual ficticio' });
  const alquiler = await registrar({ categoria: 'alquiler', fecha: '2026-11-22', monto: '1500' });
  const electricidad = await registrar({ categoria: 'electricidad', fecha: '2026-11-21', monto: '80.00' });
  Object.assign(ids, { internet: internet.id, electricidad: electricidad.id, alquiler: alquiler.id });

  assert.equal(alquiler.monto, '1500.00');
  assert.equal(internet.registrado_por, PERFILES.admin);
  assert.equal(internet.actualizado_por, PERFILES.admin);
  assert.equal(internet.pago_id, null);

  const r = await consultar('2026-11');
  assert.equal(r.mes, '2026-11');
  assert.equal(r.totalMes, '1700.00');
  assert.equal(r.cantidadVigentes, 3);
  assert.deepEqual(r.gastos.map((g) => [g.fecha, g.categoria, g.monto]), [
    ['2026-11-20', 'internet', '120.00'], ['2026-11-21', 'electricidad', '80.00'], ['2026-11-22', 'alquiler', '1500.00'],
  ]);
  assert.deepEqual(totales(r), {
    internet: [1, '120.00'], electricidad: [1, '80.00'], alquiler: [1, '1500.00'], otros: [0, '0.00'],
  });
  assert.deepEqual(Object.keys(r.gastos[0]).sort(), [
    'actualizadoEn', 'actualizadoPor', 'anulado', 'anuladoEn', 'anuladoPor', 'categoria', 'creadoEn', 'descripcion',
    'fecha', 'id', 'monto', 'motivoAnulacion', 'registradoPor',
  ]);
  assert.equal(r.gastos[0].descripcion, 'Servicio mensual ficticio');
  assert.equal(r.gastos[0].anulado, false);
  // Los ingresos no entran en el total de gastos.
  assert.equal((await consultar('2026-10')).totalMes, '0.00');
});

test('FE-173: corregir a 85.00 da 1705.00; anular internet deja 1585.00 y repetirlo no resta otra vez', opciones, async () => {
  const corregido = await corregir(ids.electricidad, { monto: '85.00' });
  assert.equal(corregido.monto, '85.00');
  assert.equal((await consultar('2026-11')).totalMes, '1705.00');

  const anulado = await anular(ids.internet, '  Registro duplicado QA  ');
  assert.equal(anulado.anulado, true);
  assert.equal(anulado.anuladoPor, PERFILES.admin);
  assert.equal(anulado.motivoAnulacion, 'Registro duplicado QA');
  assert.equal(anulado.monto, '120.00');
  const r = await consultar('2026-11');
  assert.equal(r.totalMes, '1585.00');
  assert.equal(r.cantidadVigentes, 2);
  assert.equal(r.cantidadAnulados, 1);
  assert.deepEqual(totales(r).internet, [0, '0.00']);
  // El anulado se conserva identificable en la lista.
  assert.equal(r.gastos.find((g) => g.id === ids.internet).anulado, true);

  const repetido = await anular(ids.internet, 'Otro motivo');
  assert.deepEqual(repetido, anulado);
  assert.equal((await consultar('2026-11')).totalMes, '1585.00');
  const { rows } = await sql.query(
    `select count(*)::int as n from auditoria where tabla = 'movimientos_contables' and registro_id = $1 and accion = 'UPDATE'`,
    [ids.internet]);
  assert.equal(rows[0].n, 1);
});

test('FE-173: un gasto anulado no se corrige ni se borra; ningún gasto se borra', opciones, async () => {
  await rechaza(corregir(ids.internet, { monto: '130.00' }), '23514');
  await rechaza(corregir(ids.internet, { anulado_en: null, anulado_por: null }), '23514');
  // Sin motivo tampoco se puede volver a dejar vigente.
  const sinMotivo = await registrar({ categoria: 'otros', fecha: '2026-05-04', monto: '3.00', descripcion: 'Anular sin motivo QA' });
  assert.equal((await anular(sinMotivo.id)).motivoAnulacion, null);
  await rechaza(corregir(sinMotivo.id, { anulado_en: null, anulado_por: null }), '23514');
  await rechaza(corregir(sinMotivo.id, { anulado_en: '2026-05-05T00:00:00Z' }), '23514');
  assert.equal((await consultar('2026-05')).totalMes, '0.00');
  await rechaza(comoUsuario(sql, PERFILES.admin, () =>
    sql.query('delete from movimientos_contables where id = $1', [ids.internet])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () =>
    sql.query('delete from movimientos_contables where id = $1', [ids.alquiler])), '23514');
  assert.equal((await leer(ids.internet)).monto, '120.00');
  assert.ok(await leer(ids.alquiler));
});

test('FE-173: cambiar la fecha a otro mes saca el gasto de uno y lo suma en el otro', opciones, async () => {
  await corregir(ids.electricidad, { fecha: '2026-10-31' });
  assert.equal((await consultar('2026-11')).totalMes, '1500.00');
  const octubre = await consultar('2026-10');
  assert.equal(octubre.totalMes, '85.00');
  assert.deepEqual(totales(octubre).electricidad, [1, '85.00']);
  await corregir(ids.electricidad, { fecha: '2026-11-21' });
  assert.equal((await consultar('2026-11')).totalMes, '1585.00');
  assert.equal((await consultar('2026-10')).totalMes, '0.00');
});

test('FE-173: varios gastos de una categoría en el mes y suma exacta de centavos', opciones, async () => {
  const a = await registrar({ categoria: 'otros', fecha: '2026-08-03', monto: '0.10', descripcion: 'Material QA 1' });
  const b = await registrar({ categoria: 'otros', fecha: '2026-08-31', monto: '0.20', descripcion: 'Material QA 2' });
  await registrar({ categoria: 'otros', fecha: '2026-09-01', monto: '5.00', descripcion: 'Fuera del mes' });
  const r = await consultar('2026-08');
  assert.equal(r.totalMes, '0.30');
  assert.deepEqual(totales(r).otros, [2, '0.30']);
  assert.deepEqual(r.gastos.map((g) => g.id), [a.id, b.id]);
  assert.equal((await registrar({ categoria: 'alquiler', fecha: '2026-07-01', monto: '99999999.99' })).monto, '99999999.99');
});

test('FE-173: datos inválidos se rechazan sin escrituras parciales', opciones, async () => {
  const antes = await contar();
  const hoy = hoyLaPaz();
  const valido = { categoria: 'internet', fecha: '2026-11-10', monto: '10.00' };
  for (const datos of [
    { monto: '0' }, { monto: '-5.00' }, { monto: '1.234' }, { monto: '100000000.00' },
    { categoria: 'agua' }, { categoria: null }, { categoria: 'Internet' },
    { fecha: sumarDias(hoy, 1) }, { fecha: '1999-12-31' },
    { categoria: 'otros' }, { categoria: 'otros', descripcion: '   ' }, { descripcion: '' }, { descripcion: 'x'.repeat(201) },
    { pago_id: randomUUID() },
  ]) {
    await rechaza(registrar({ ...valido, ...datos }), '23514');
  }
  await rechaza(registrar({ ...valido, monto: null }), '23502');
  await rechaza(registrar({ ...valido, fecha: null }), '23502');
  await rechaza(registrar({ ...valido, fecha: '2026-02-30' }), '22008');
  assert.equal(await contar(), antes);

  // Límites aceptados: hoy en Bolivia, 200 caracteres, otros con descripción.
  await registrar({ ...valido, fecha: hoy, descripcion: 'x'.repeat(200) });
  await registrar({ ...valido, categoria: 'otros', descripcion: 'Limpieza ficticia' });

  // Corregir con datos inválidos tampoco cambia nada.
  for (const datos of [{ monto: '0.001' }, { fecha: sumarDias(hoy, 1) }, { categoria: 'otros', descripcion: null },
    { tipo: 'ingreso' }, { anulado_por: PERFILES.admin }, { motivo_anulacion: 'Sin anular' }]) {
    await rechaza(corregir(ids.alquiler, datos), '23514');
  }
  const alquiler = await leer(ids.alquiler);
  assert.deepEqual([alquiler.tipo, alquiler.categoria, alquiler.monto, alquiler.anulado_por, alquiler.motivo_anulacion],
    ['egreso', 'alquiler', '1500.00', null, null]);
});

test('FE-173: la base pone autoría y anulación; el cliente no las falsifica', opciones, async () => {
  const g = await registrar({ categoria: 'electricidad', fecha: '2026-06-10', monto: '40.00',
    registrado_por: PERFILES.t1, creado_en: '2020-01-01T00:00:00Z', anulado_en: '2026-06-11T00:00:00Z',
    anulado_por: PERFILES.t1, motivo_anulacion: 'Falso' });
  assert.equal(g.registrado_por, PERFILES.admin);
  assert.ok(g.creado_en > new Date('2026-01-01'));
  assert.deepEqual([g.anulado_en, g.anulado_por, g.motivo_anulacion], [null, null, null]);

  const c = await corregir(g.id, { descripcion: 'Corregido QA', registrado_por: PERFILES.t1, creado_en: '2020-01-01T00:00:00Z' });
  assert.equal(c.registrado_por, PERFILES.admin);
  assert.deepEqual(c.creado_en, g.creado_en);
  assert.equal(c.descripcion, 'Corregido QA');

  // Anular por UPDATE directo también deja autor y fecha del servidor, pero no puede cambiar datos a la vez.
  await rechaza(corregir(g.id, { anulado_en: '2020-01-01T00:00:00Z', monto: '1.00' }), '23514');
  const a = await corregir(g.id, { anulado_en: '2020-01-01T00:00:00Z', anulado_por: PERFILES.t1 });
  assert.equal(a.anulado_por, PERFILES.admin);
  assert.ok(a.anulado_en > new Date('2026-01-01'));
});

test('FE-173: solo administración activa registra, corrige, anula y consulta', opciones, async () => {
  const antes = await contar();
  const datos = { categoria: 'internet', fecha: '2026-11-11', monto: '9.00' };
  for (const usuario of [PERFILES.t1, PERFILES.marketing, randomUUID()]) {
    await rechaza(registrar(datos, usuario), '42501');
    await rechaza(corregir(ids.alquiler, { monto: '1.00' }, usuario), '42501');
    await rechaza(anular(ids.alquiler, null, usuario), '42501');
    await rechaza(consultar('2026-11', usuario), '42501');
  }
  // Sin app.usuario_id.
  await rechaza(sql.query(`insert into movimientos_contables (tipo, categoria, fecha, monto) values ('egreso', 'internet', '2026-11-11', 9)`), '42501');
  await rechaza(sql.query(`select consultar_gastos_mes('2026-11')`), '42501');

  await sql.query(`insert into auth.users (id) values ($1)`, [ids.adminInactivo = randomUUID()]);
  await sql.query(`insert into perfiles (id, nombre_completo, rol, activo) values ($1, 'Admin inactivo QA', 'administrador', false)`,
    [ids.adminInactivo]);
  await rechaza(registrar(datos, ids.adminInactivo), '42501');
  await rechaza(consultar('2026-11', ids.adminInactivo), '42501');

  assert.equal(await contar(), antes);
  assert.equal((await leer(ids.alquiler)).monto, '1500.00');
});

test('FE-173: mes inválido → 22023; sin mes, el mes actual de Bolivia', opciones, async () => {
  for (const mes of ['2026-13', '2026-1', '2026-00', 'noviembre', '2026-11-01', '1999-12', '']) {
    await rechaza(consultar(mes), '22023');
  }
  assert.equal((await consultar(null)).mes, hoyLaPaz().slice(0, 7));
});

test('FE-173: anular inexistente o un ingreso → P0002', opciones, async () => {
  await rechaza(anular(randomUUID()), 'P0002');
  await rechaza(anular(ingresoPrevio.id), 'P0002');
  assert.equal((await leer(ingresoPrevio.id)).anulado_en, null);
});

test('FE-173: registro, corrección y anulación quedan en auditoría con su autor', opciones, async () => {
  const { rows } = await sql.query(
    `select accion, usuario_id, datos_anteriores ->> 'monto' as antes, datos_nuevos ->> 'monto' as despues,
            datos_nuevos ->> 'anulado_en' is not null as anulado
       from auditoria where tabla = 'movimientos_contables' and registro_id = any($1) order by id`,
    [[ids.internet, ids.electricidad]]);
  assert.deepEqual(rows.map((f) => [f.accion, f.usuario_id, f.antes, f.despues, f.anulado]), [
    ['INSERT', PERFILES.admin, null, '120.00', false],
    ['INSERT', PERFILES.admin, null, '80.00', false],
    ['UPDATE', PERFILES.admin, '80.00', '85.00', false],
    ['UPDATE', PERFILES.admin, '120.00', '120.00', true],
    ['UPDATE', PERFILES.admin, '85.00', '85.00', false],
    ['UPDATE', PERFILES.admin, '85.00', '85.00', false],
  ]);
});

test('FE-173: RLS activo y sin acceso directo para anon/authenticated', opciones, async () => {
  const { rows: [t] } = await sql.query(`select relrowsecurity from pg_class where relname = 'movimientos_contables'`);
  assert.equal(t.relrowsecurity, true);
  const { rows } = await sql.query(
    `select r.rolname,
            has_table_privilege(r.rolname, 'public.movimientos_contables', 'select') as leer,
            has_function_privilege(r.rolname, 'public.consultar_gastos_mes(text)', 'execute') as consultar,
            has_function_privilege(r.rolname, 'public.anular_gasto(uuid, text)', 'execute') as anular
       from pg_roles r where r.rolname in ('anon', 'authenticated') order by 1`);
  for (const f of rows) assert.deepEqual([f.leer, f.consultar, f.anular], [false, false, false], f.rolname);
});

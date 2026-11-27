import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { IndicadoresModule } from '../dist/modules/indicadores/indicadores.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

let base, sql, api, casos;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe139');
  sql = base.cliente;
  const A = await crearCaso(sql, { nombre: 'QA Alba La Paz', estado: 'en_proceso', clasificacion: 'social', terapeuta: PERFILES.t1, fechaIngreso: '2026-10-04' });
  const B = await crearCaso(sql, { nombre: 'QA Bruno El Alto', estado: 'iniciado', clasificacion: 'privado', terapeuta: PERFILES.t2, fechaIngreso: '2026-10-03' });
  const C = await crearCaso(sql, { nombre: 'QA Carla Sin Dato', estado: 'iniciado', clasificacion: 'social', terapeuta: PERFILES.t1, fechaIngreso: '2026-10-02' });
  const D = await crearCaso(sql, { nombre: 'QA Diego Viacha', estado: 'concluido', clasificacion: 'privado', fechaIngreso: '2026-10-01' });
  casos = { A, B, C, D };
  for (const [caso, ciudad, localidad] of [[A, 'la_paz', null], [B, 'el_alto', null], [D, 'otra', 'Viacha ficticia']]) {
    await comoUsuario(sql, PERFILES.admin, () => sql.query(
      'update pacientes set ciudad_residencia = $1, otra_localidad = $2 where id = $3', [ciudad, localidad, caso.pacienteId]));
  }
  const SA1 = await crearSesion(sql, A.id, { fecha: '2026-11-20' });
  await crearSesion(sql, A.id, { fecha: '2026-11-21' });
  const SB1 = await crearSesion(sql, B.id, { fecha: '2026-11-20', responsable: PERFILES.t2 });
  for (const [caso, sesion, monto] of [[A, SA1, '75.50'], [B, SB1, '100.00']]) {
    await comoUsuario(sql, PERFILES.admin, () => sql.query(
      `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-11-20', $3, 'qr')`,
      [caso.id, sesion.id, monto]));
  }
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing }, { modulos: [IndicadoresModule] });
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
const letra = (nombre) => ({ 'QA Alba La Paz': 'A', 'QA Bruno El Alto': 'B', 'QA Carla Sin Dato': 'C', 'QA Diego Viacha': 'D' })[nombre];
async function listar(consulta = {}, token = 'admin') {
  const r = await pedir(`/carpetas?${new URLSearchParams(consulta)}`, { token });
  if (r.status !== 200) return { status: r.status };
  return { status: 200, total: r.cuerpo.total, letras: r.cuerpo.carpetas.map((c) => letra(c.paciente.nombreCompleto)).sort().join(''), cuerpo: r.cuerpo };
}
async function editarPaciente(caso, residencia, token = 'admin') {
  const actual = (await pedir(`/carpetas/${caso.id}`)).cuerpo;
  const cuerpo = { nombreCompleto: actual.paciente.nombreCompleto, fechaIngreso: actual.fechaIngreso, ...residencia };
  return pedir(`/carpetas/${caso.id}`, { token, metodo: 'PATCH', cuerpo });
}
const indicadores = (token = 'admin', desde = '2026-11-20', hasta = '2026-11-21') =>
  pedir(`/indicadores/por-residencia?desde=${desde}&hasta=${hasta}`, { token });
const resumen = (cuerpo) => Object.fromEntries(cuerpo.porResidencia.map((f) => [f.residencia, [f.casosActuales, f.sesiones, f.pagosRecibidos.monto]]));

test('R1 · tabla de FE-134 por la API: administración y cada residencia', opciones, async () => {
  const esperado = { '': ['ABCD', 4], la_paz: ['A', 1], el_alto: ['B', 1], sin_registrar: ['C', 1], otra: ['D', 1] };
  for (const [residencia, [letras, total]] of Object.entries(esperado)) {
    const r = await listar(residencia ? { residencia } : {});
    assert.equal(r.status, 200);
    assert.equal(r.letras, letras, `residencia=${residencia || 'todas'}`);
    assert.equal(r.total, total, `total con residencia=${residencia || 'todas'}`);
  }
});

test('R2 · El Alto atendido en La Paz se clasifica por donde vive, y la carpeta expone su residencia', opciones, async () => {
  const r = await listar({ residencia: 'el_alto' });
  assert.deepEqual(r.cuerpo.carpetas[0].paciente, {
    id: casos.B.pacienteId, nombreCompleto: 'QA Bruno El Alto', ciudadResidencia: 'el_alto', otraLocalidad: null,
  });
  const d = (await listar({ residencia: 'otra' })).cuerpo.carpetas[0].paciente;
  assert.equal(d.otraLocalidad, 'Viacha ficticia');
  const c = (await listar({ residencia: 'sin_registrar' })).cuerpo.carpetas[0].paciente;
  assert.equal(c.ciudadResidencia, null, 'Sin registrar no se adivina');
});

test('R3 · terapeuta: solo sus carpetas, combinaciones y sin ver ajenas', opciones, async () => {
  assert.equal((await listar({}, 't1')).letras, 'AC');
  assert.equal((await listar({ clasificacion: 'social', estado: 'iniciado' }, 't1')).letras, 'C');
  const ajena = await listar({ residencia: 'el_alto' }, 't1');
  assert.equal(ajena.total, 0);
  assert.equal(ajena.letras, '');
  assert.equal((await listar({ residencia: 'el_alto' }, 't2')).letras, 'B');
});

test('R4 · combinaciones con estado, clasificación y búsqueda (AND en servidor)', opciones, async () => {
  const combinaciones = [
    [{ residencia: 'la_paz', estado: 'en_proceso' }, 'A'],
    [{ residencia: 'la_paz', estado: 'iniciado' }, ''],
    [{ residencia: 'sin_registrar', clasificacion: 'social' }, 'C'],
    [{ residencia: 'otra', clasificacion: 'privado', estado: 'concluido' }, 'D'],
    [{ residencia: 'el_alto', busqueda: 'bruno' }, 'B'],
    [{ residencia: 'el_alto', busqueda: 'alba' }, ''],
    [{ clasificacion: 'privado' }, 'BD'],
  ];
  for (const [consulta, letras] of combinaciones) {
    const r = await listar(consulta);
    assert.equal(r.letras, letras, JSON.stringify(consulta));
    assert.equal(r.total, letras.length, `total de ${JSON.stringify(consulta)}`);
  }
});

test('R5 · paginación: el total no depende de la página y no se repiten carpetas', opciones, async () => {
  const vistas = [];
  for (let pagina = 1; pagina <= 3; pagina++) {
    const r = await listar({ tamano: 2, pagina });
    assert.equal(r.total, 4);
    vistas.push(...r.cuerpo.carpetas.map((c) => c.id));
  }
  assert.equal(vistas.length, 4);
  assert.equal(new Set(vistas).size, 4);
  const vacia = await listar({ residencia: 'el_alto', pagina: 5 });
  assert.equal(vacia.total, 1, 'Una página vacía conserva el total correcto');
  assert.equal(vacia.letras, '');
});

test('R6 · valores inválidos se rechazan con 400', opciones, async () => {
  for (const consulta of [{ residencia: 'cochabamba' }, { residencia: 'La Paz' }, { residencia: '' }, { tamano: 0 }, { tamano: 101 }, { pagina: 0 }]) {
    assert.equal((await listar(consulta)).status, 400, JSON.stringify(consulta));
  }
  for (const [desde, hasta] of [['2026-11-22', '2026-11-20'], ['2026-02-30', '2026-03-01'], ['20/11/2026', '2026-11-21']]) {
    assert.equal((await indicadores('admin', desde, hasta)).status, 400, `${desde}..${hasta}`);
  }
});

test('R7 · indicadores por residencia coinciden con la tabla de FE-134 y suman el total', opciones, async () => {
  const r = await indicadores();
  assert.equal(r.status, 200);
  const res = resumen(r.cuerpo);
  assert.deepEqual(res.la_paz, [1, 2, '75.50']);
  assert.deepEqual(res.el_alto, [1, 1, '100.00']);
  assert.deepEqual(res.sin_registrar, [1, 0, '0.00']);
  assert.deepEqual(res.otra, [1, 0, '0.00']);

  const general = await pedir('/indicadores?desde=2026-11-20&hasta=2026-11-21');
  assert.equal(general.status, 200);
  const suma = (i) => r.cuerpo.porResidencia.reduce((s, f) => s + Number(i(f)), 0);
  assert.equal(suma((f) => f.casosActuales), 4);
  assert.equal(suma((f) => f.sesiones), 3);
  assert.equal(suma((f) => f.pagosRecibidos.monto).toFixed(2), '175.50');
  assert.equal(JSON.stringify(general.cuerpo).includes('175.5'), true, 'El total general también es 175.50');

  const vacio = resumen((await indicadores('admin', '2026-01-01', '2026-01-31')).cuerpo);
  assert.deepEqual(vacio.la_paz.slice(1), [0, '0.00'], 'Un período sin movimientos da 0 y 0.00');
});

test('R8 · permisos: indicadores solo administración; marketing no lista carpetas', opciones, async () => {
  for (const [token, estado] of [['t1', 403], ['mkt', 403], [null, 401], ['admin', 200]]) {
    assert.equal((await indicadores(token)).status, estado, `indicadores con ${token ?? 'sin token'}`);
  }
  assert.equal((await listar({ residencia: 'la_paz' }, 'mkt')).status, 403);
  assert.equal((await listar({ residencia: 'la_paz' }, null)).status, 401);
});

test('R9 · cambiar residencia por la API: reglas de "otra" y solo administración', opciones, async () => {
  for (const residencia of [
    { ciudadResidencia: 'otra' },
    { ciudadResidencia: 'otra', otraLocalidad: '   ' },
    { ciudadResidencia: 'la_paz', otraLocalidad: 'Achocalla' },
    { otraLocalidad: 'Sin ciudad' },
    { ciudadResidencia: 'cochabamba' },
    { ciudadResidencia: 'otra', otraLocalidad: 'x'.repeat(101) },
  ]) {
    const r = await editarPaciente(casos.C, residencia);
    assert.equal(r.status, 400, JSON.stringify(residencia));
    assert.doesNotMatch(JSON.stringify(r.cuerpo), /nombreCompleto|fechaIngreso/, 'El 400 debe ser por la residencia');
  }
  assert.equal((await listar({ residencia: 'sin_registrar' })).letras, 'C', 'Los rechazos no cambian nada');
  for (const [token, estado] of [['t1', 403], ['mkt', 403]]) {
    assert.equal((await editarPaciente(casos.C, { ciudadResidencia: 'el_alto' }, token)).status, estado);
  }
});

test('R10 · mudar A de La Paz a El Alto conserva número, origen, asignación e historial y mueve los conteos', opciones, async () => {
  const antes = (await pedir(`/carpetas/${casos.A.id}`)).cuerpo;
  const sesionesAntes = (await sql.query('select count(*)::int as n from fichas_seguimiento where caso_id = $1', [casos.A.id])).rows[0].n;
  const r = await editarPaciente(casos.A, { ciudadResidencia: 'el_alto' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const despues = (await pedir(`/carpetas/${casos.A.id}`)).cuerpo;

  for (const campo of ['numero', 'tipo', 'estado', 'clasificacion', 'fechaIngreso']) {
    assert.deepEqual(despues[campo], antes[campo], `${campo} no cambia`);
  }
  assert.deepEqual(despues.terapeuta, antes.terapeuta, 'La asignación no cambia');
  assert.equal((await sql.query('select count(*)::int as n from fichas_seguimiento where caso_id = $1', [casos.A.id])).rows[0].n, sesionesAntes);
  const { rows: [p] } = await sql.query(
    'select ciudad_residencia, residencia_actualizada_por from pacientes where id = $1', [casos.A.pacienteId]);
  assert.deepEqual(p, { ciudad_residencia: 'el_alto', residencia_actualizada_por: PERFILES.admin });

  assert.equal((await listar({ residencia: 'el_alto' })).letras, 'AB');
  assert.equal((await listar({ residencia: 'la_paz' })).letras, '');
  const res = resumen((await indicadores()).cuerpo);
  assert.deepEqual(res.el_alto, [2, 3, '175.50']);
  assert.deepEqual(res.la_paz, [0, 0, '0.00']);
  assert.equal((await listar({ residencia: 'el_alto' }, 't1')).letras, 'A', 'La terapeuta de A la sigue viendo');
});

test('R11 · borrar la residencia la deja "Sin registrar" y vuelve a contar ahí', opciones, async () => {
  const r = await editarPaciente(casos.D, { ciudadResidencia: null });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal((await listar({ residencia: 'sin_registrar' })).letras, 'CD');
  const { rows: [p] } = await sql.query('select otra_localidad from pacientes where id = $1', [casos.D.pacienteId]);
  assert.equal(p.otra_localidad, null, 'No queda una localidad huérfana');
});

import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { datos, servidor } from './helpers/casos.mjs';
import { PERFILES, crearBase, opciones } from './helpers/pg-qa.mjs';

let base, sql, db, api;
let casoA, casoB;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe65');
  sql = base.cliente;
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${sql.database}`;
  db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, {
    fixture: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, marketing: PERFILES.marketing,
  });
});

after(async () => {
  if (opciones.skip) return;
  try { await api?.close(); } finally { await base?.cerrar(); }
});

beforeEach(async () => {
  if (opciones.skip) return;
  await sql.query('truncate pacientes, casos, constancias_atencion, auditoria restart identity cascade');
  await sql.query('update contadores_caso set ultimo_numero = 0');
  casoA = await registrar('Ana Ficticia QA', 'voluntario', PERFILES.t1);
  casoB = await registrar('Beto Ficticio QA', 'derivado', PERFILES.t2);
  await sql.query('truncate auditoria restart identity');
});

async function registrar(nombre, tipo, terapeuta) {
  const res = await api.post(datos(nombre, tipo));
  assert.equal(res.status, 201);
  const caso = await res.json();
  await sql.query(
    'insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)',
    [caso.id, terapeuta, PERFILES.admin],
  );
  return caso;
}

const ver = (id, token = 'fixture') => api.solicitar(`/carpetas/${id}/constancia`, { token });
const guardar = (id, cuerpo, token = 'fixture') =>
  api.solicitar(`/carpetas/${id}/constancia`, { metodo: 'PUT', cuerpo, token });

async function constanciaGuardada(id) {
  const res = await ver(id);
  assert.equal(res.status, 200);
  return (await res.json()).constancia;
}

const caso = async (id) => (await sql.query(
  'select tipo, numero_correlativo, estado, clasificacion, paciente_id from casos where id = $1', [id],
)).rows[0];

const auditoria = async () => (await sql.query(
  "select count(*)::int as n from auditoria where tabla = 'constancias_atencion'",
)).rows[0].n;

const PENDIENTE = { origenJudicial: false, estado: 'pendiente' };
const REGISTRADA = {
  procedencia: 'Juzgado Público de Familia N.º 1', origenJudicial: true,
  estado: 'registrado', fechaConsentimiento: '2026-10-09', referenciaEvidencia: 'EVIDENCIA-DEMO',
};
const NO_APLICA = { origenJudicial: false, estado: 'no_aplica', explicacion: 'Caso ficticio sin intervención con menores' };

test('FE-65: un caso sin constancia responde constancia null', opciones, async () => {
  assert.equal(await constanciaGuardada(casoA.id), null);
});

test('FE-65: campos exigidos por estado responden 400 y la constancia sigue Pendiente', opciones, async () => {
  assert.equal((await guardar(casoA.id, PENDIENTE)).status, 200);
  const invalidos = {
    'registrado sin referencia': { ...REGISTRADA, referenciaEvidencia: undefined },
    'registrado con referencia en blanco': { ...REGISTRADA, referenciaEvidencia: '   ' },
    'registrado sin fecha': { ...REGISTRADA, fechaConsentimiento: undefined },
    'registrado con fecha imposible': { ...REGISTRADA, fechaConsentimiento: '2026-02-30' },
    'registrado con fecha en otro formato': { ...REGISTRADA, fechaConsentimiento: '09/10/2026' },
    'registrado con explicación': { ...REGISTRADA, explicacion: 'No corresponde' },
    'no aplica sin explicación': { ...NO_APLICA, explicacion: undefined },
    'no aplica con explicación en blanco': { ...NO_APLICA, explicacion: '  ' },
    'no aplica con referencia': { ...NO_APLICA, referenciaEvidencia: 'EVIDENCIA-DEMO' },
    'pendiente con fecha': { ...PENDIENTE, fechaConsentimiento: '2026-10-09' },
    'estado fuera de catálogo': { ...PENDIENTE, estado: 'firmado' },
    'sin origen judicial': { estado: 'pendiente' },
    'intenta cambiar el número': { ...PENDIENTE, numeroCorrelativo: 999 },
    'intenta cambiar el origen': { ...PENDIENTE, tipo: 'derivado' },
  };
  for (const [motivo, cuerpo] of Object.entries(invalidos)) {
    assert.equal((await guardar(casoA.id, cuerpo)).status, 400, motivo);
  }
  assert.equal((await constanciaGuardada(casoA.id)).estado, 'pendiente');
  assert.equal(await auditoria(), 1);
});

test('FE-65: recorre Pendiente → Registrada → No aplica → Pendiente y limpia los campos que no aplican', opciones, async () => {
  for (const cuerpo of [PENDIENTE, REGISTRADA, NO_APLICA, PENDIENTE]) {
    const res = await guardar(casoA.id, cuerpo);
    assert.equal(res.status, 200, cuerpo.estado);
    const { constancia } = await res.json();
    assert.equal(constancia.estado, cuerpo.estado);
    assert.equal(constancia.fechaConsentimiento, cuerpo.fechaConsentimiento ?? null);
    assert.equal(constancia.referenciaEvidencia, cuerpo.referenciaEvidencia ?? null);
    assert.equal(constancia.explicacion, cuerpo.explicacion ?? null);
  }
  const filas = await sql.query('select count(*)::int as n from constancias_atencion where caso_id = $1', [casoA.id]);
  assert.equal(filas.rows[0].n, 1);
  assert.equal(await auditoria(), 4);
});

const DEFECTO_D1 = 'Defecto FE-65-D1: GET devuelve la fecha como timestamp ISO; ver docs/pruebas/FE-65-verificacion-constancia.md';

test('FE-65: al recargar, la consulta devuelve lo mismo que respondió el guardado', { ...opciones, todo: opciones.skip ? undefined : DEFECTO_D1 }, async () => {
  const res = await guardar(casoA.id, REGISTRADA);
  assert.equal(res.status, 200);
  const { constancia: guardada } = await res.json();
  const recargada = await constanciaGuardada(casoA.id);
  assert.equal(recargada.fechaConsentimiento, '2026-10-09');
  assert.deepEqual(recargada, guardada);
});

test('FE-65: guardar la constancia no cambia número, origen, estado, clasificación ni paciente', opciones, async () => {
  const antes = await caso(casoB.id);
  const conteo = 'select (select count(*) from pacientes)::int as p, (select count(*) from casos)::int as c';
  const totales = (await sql.query(conteo)).rows[0];
  for (const cuerpo of [PENDIENTE, REGISTRADA, NO_APLICA]) {
    assert.equal((await guardar(casoB.id, cuerpo, 't2')).status, 200);
  }
  assert.deepEqual(await caso(casoB.id), antes);
  assert.deepEqual((await sql.query(conteo)).rows[0], totales);
  const detalle = await (await api.detalle(casoB.id)).json();
  assert.equal(detalle.numero, casoB.numeroCorrelativo);
  assert.equal(detalle.tipo, 'derivado');
});

test('FE-65: el servidor registra quién creó y quién actualizó, aparte de la fecha de evidencia', opciones, async () => {
  assert.equal((await guardar(casoA.id, PENDIENTE)).status, 200);
  assert.equal((await guardar(casoA.id, REGISTRADA, 't1')).status, 200);
  const constancia = await constanciaGuardada(casoA.id);
  assert.equal(constancia.creadoPor, PERFILES.admin);
  assert.equal(constancia.actualizadoPor, PERFILES.t1);
  assert.ok(constancia.actualizadoEn);
  const { rows } = await sql.query(
    `select to_char(fecha_consentimiento, 'YYYY-MM-DD') as evidencia, actualizado_en::date = current_date as hoy
       from constancias_atencion where caso_id = $1`, [casoA.id],
  );
  assert.deepEqual(rows[0], { evidencia: '2026-10-09', hoy: true });
});

test('FE-65: acceso directo a un caso ajeno se rechaza sin leer ni escribir', opciones, async () => {
  assert.equal((await guardar(casoB.id, PENDIENTE, 't2')).status, 200);
  const antes = await constanciaGuardada(casoB.id);
  const auditoriaAntes = await auditoria();

  assert.equal((await ver(casoB.id, 't1')).status, 404);
  assert.equal((await guardar(casoB.id, REGISTRADA, 't1')).status, 404);
  assert.equal((await ver(casoA.id, 'marketing')).status, 403);
  assert.equal((await guardar(casoA.id, PENDIENTE, 'marketing')).status, 403);
  assert.equal((await ver(casoA.id, null)).status, 401);
  assert.equal((await guardar(casoA.id, PENDIENTE, 'token-falso')).status, 401);
  assert.equal((await ver(randomUUID())).status, 404);
  assert.equal((await guardar(randomUUID(), PENDIENTE)).status, 404);
  assert.equal((await ver('no-es-uuid')).status, 400);

  assert.deepEqual(await constanciaGuardada(casoB.id), antes);
  assert.equal(await constanciaGuardada(casoA.id), null);
  assert.equal(await auditoria(), auditoriaAntes);
});

test('FE-65: un caso eliminado responde 404 aunque tenga constancia', opciones, async () => {
  assert.equal((await guardar(casoA.id, PENDIENTE)).status, 200);
  await sql.query('update casos set deleted_at = now() where id = $1', [casoA.id]);
  assert.equal((await ver(casoA.id)).status, 404);
  assert.equal((await guardar(casoA.id, NO_APLICA)).status, 404);
});

test('FE-65: al reasignar el caso, la terapeuta anterior pierde el acceso', opciones, async () => {
  assert.equal((await guardar(casoA.id, PENDIENTE, 't1')).status, 200);
  await sql.query('update asignaciones_caso set perfil_id = $1 where caso_id = $2', [PERFILES.t2, casoA.id]);
  assert.equal((await ver(casoA.id, 't1')).status, 404);
  assert.equal((await guardar(casoA.id, REGISTRADA, 't1')).status, 404);
  assert.equal((await ver(casoA.id, 't2')).status, 200);
});

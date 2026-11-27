import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { ImportacionModule } from '../dist/modules/importacion/importacion.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

const COLUMNAS = 'referenciaOrigen,nombreCompleto,fechaNacimiento,edadAlIngreso,telefono,tipo,numeroCorrelativo,fechaIngreso,clasificacion,ciudadResidencia,otraLocalidad,diagnosticoIngreso,hipotesisRelacional,comentariosClinicos,estado,juzgado,nroExpediente,fechaDerivacion';
const FORMULA = '=HYPERLINK("http://x.test","clic")';
const celda = (v) => (/[,"\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
const fila = (valores) => COLUMNAS.split(',').map((c) => celda(valores[c] ?? '')).join(',');

let base, sql, api, E, F, csv, lote, fotoAntes;

async function foto() {
  const ids = [E.id, F.id];
  const pacientes = [E.pacienteId, F.pacienteId];
  return {
    pacientes: (await sql.query('select row_to_json(t) as r from pacientes t where id = any($1) order by id', [pacientes])).rows,
    casos: (await sql.query('select row_to_json(t) as r from casos t where id = any($1) order by id', [ids])).rows,
    diagnosticos: (await sql.query('select row_to_json(t) as r from fichas_diagnostico t where caso_id = any($1) order by id', [ids])).rows,
    asignaciones: (await sql.query('select row_to_json(t) as r from asignaciones_caso t where caso_id = any($1) order by caso_id', [ids])).rows,
    sesiones: (await sql.query('select row_to_json(t) as r from fichas_seguimiento t where caso_id = any($1) order by id', [ids])).rows,
  };
}
const contar = async () => (await sql.query(
  `select (select count(*)::int from pacientes) as pacientes, (select count(*)::int from casos) as casos`)).rows[0];

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe166');
  sql = base.cliente;
  E = await crearCaso(sql, { nombre: 'Paciente Antiguo QA', terapeuta: PERFILES.t1, fechaIngreso: '2018-03-01', clasificacion: 'social' });
  F = await crearCaso(sql, { nombre: 'Otro Antiguo QA', terapeuta: PERFILES.t2, fechaIngreso: '2018-04-01' });
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    "update pacientes set ciudad_residencia = 'la_paz' where id = $1", [E.pacienteId]));
  await comoUsuario(sql, PERFILES.t1, () => sql.query(
    `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
     values ($1, '2018-03-10', $2::jsonb, $3, $3)`,
    [E.id, JSON.stringify({ evaluacionInicial: 'Evaluación original QA', diagnosticoIngreso: 'Diagnóstico original QA' }), PERFILES.t1]));
  await crearSesion(sql, E.id, { fecha: '2018-03-15', evolucion: 'Sesión antigua QA' });

  csv = [COLUMNAS,
    fila({ referenciaOrigen: 'QA166-N1', nombreCompleto: 'Nueva Importada QA', edadAlIngreso: '30', tipo: 'voluntario', fechaIngreso: '2019-05-10', clasificacion: 'social', ciudadResidencia: 'la_paz', comentariosClinicos: 'Antecedente nuevo QA' }),
    fila({ referenciaOrigen: 'QA166-D1', nombreCompleto: 'Paciente Antiguo QA', tipo: 'voluntario', numeroCorrelativo: String(E.numero_correlativo), fechaIngreso: '2019-06-01', clasificacion: 'privado', ciudadResidencia: 'el_alto', diagnosticoIngreso: 'Diagnóstico histórico que NO debe pisar', comentariosClinicos: 'Antecedente que no debe pisar' }),
    fila({ referenciaOrigen: 'QA166-X1', nombreCompleto: 'Fila con error QA', tipo: 'voluntario', fechaIngreso: '2019-02-30', clasificacion: 'social', ciudadResidencia: 'la_paz' }),
    fila({ referenciaOrigen: 'QA166-F1', nombreCompleto: FORMULA, tipo: 'voluntario', fechaIngreso: '2019-07-01', clasificacion: 'social', ciudadResidencia: 'la_paz' }),
  ].join('\n') + '\n';

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, mkt: PERFILES.marketing }, [ImportacionModule]);
  fotoAntes = await foto();
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function cargar(contenido, { nombre = 'lote-fe166.csv', token = 'admin', tipo = 'text/csv' } = {}) {
  const body = new FormData();
  body.set('archivo', new Blob([contenido], { type: tipo }), nombre);
  body.set('origen', 'Muestra ficticia FE-166');
  const r = await fetch(`${api.base}/api/importaciones`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}
async function pedir(ruta, { token = 'admin', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}
const filaDe = (l, ref) => l.filas.find((f) => f.referenciaOrigen === ref);
async function decidir(ref, decision, extra = {}) {
  const f = filaDe(lote, ref);
  const r = await pedir(`/importaciones/${lote.loteId}/filas/${f.numeroFila}`, { metodo: 'PATCH', cuerpo: { version: lote.version, decision, ...extra } });
  assert.equal(r.status, 200, `${ref} ${decision}: ${JSON.stringify(r.cuerpo)}`);
  lote = r.cuerpo;
}

test('M1 · solo administración importa; terapeuta, marketing y sin sesión no', opciones, async () => {
  const idFalso = '00000000-0000-4000-8000-00000000f166';
  for (const [token, esperado] of [['t1', 403], ['mkt', 403], [null, 401]]) {
    assert.equal((await cargar(csv, { token })).status, esperado, `POST ${token}`);
    assert.equal((await pedir(`/importaciones/${idFalso}`, { token })).status, esperado, `GET ${token}`);
    assert.equal((await pedir(`/importaciones/${idFalso}/confirmar`, { token, metodo: 'POST', cuerpo: { version: 1 } })).status, esperado, `confirmar ${token}`);
  }
  assert.equal((await sql.query('select count(*)::int as n from importaciones')).rows[0].n, 0);
});

test('M2 · archivos inválidos se rechazan sin crear lotes', opciones, async () => {
  const casos = [
    ['extensión .pdf', '%PDF-1.7 falso', { nombre: 'lote.pdf', tipo: 'application/pdf' }, 415],
    ['extensión .exe', 'MZ', { nombre: 'lote.exe', tipo: 'application/octet-stream' }, 415],
    ['archivo vacío', '', {}, 400],
    ['encabezados que no son de la plantilla', 'columnaIncorrecta\nvalor\n', {}, 400],
    ['PDF renombrado a .csv', '%PDF-1.7\n%âãÏÓ\n1 0 obj\n', {}, 400],
    ['XLSX que no es un libro de Excel', 'esto no es un zip', { nombre: 'lote.xlsx' }, 400],
    ['más de 5 MB', `${COLUMNAS}\n${'x'.repeat(5 * 1024 * 1024)}`, {}, 413],
  ];
  for (const [nombre, contenido, op, esperado] of casos) {
    assert.equal((await cargar(contenido, op)).status, esperado, nombre);
  }
  assert.equal((await sql.query('select count(*)::int as n from importaciones')).rows[0].n, 0, 'Ningún rechazo crea un lote');
});

test('M3 · la vista previa clasifica las filas y no toca nada existente', opciones, async () => {
  const antes = await contar();
  const r = await cargar(csv);
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  lote = r.cuerpo;
  assert.equal(lote.estado, 'en_revision');
  assert.equal(filaDe(lote, 'QA166-N1').estado, 'valida_nueva');
  assert.equal(filaDe(lote, 'QA166-D1').estado, 'posible_duplicado', 'Mismo tipo y número que una carpeta existente');
  assert.equal(filaDe(lote, 'QA166-X1').estado, 'error');
  assert.ok(filaDe(lote, 'QA166-X1').errores.some((e) => /fecha/i.test(JSON.stringify(e))));
  assert.deepEqual(await contar(), antes, 'La vista previa no crea pacientes ni casos');
  assert.deepEqual(await foto(), fotoAntes);
});

test('M4 · no se confirma con filas pendientes ni con una versión vieja', opciones, async () => {
  const pendiente = await pedir(`/importaciones/${lote.loteId}/confirmar`, { metodo: 'POST', cuerpo: { version: lote.version } });
  assert.equal(pendiente.status, 422, JSON.stringify(pendiente.cuerpo));
  const versionVieja = lote.version;
  await decidir('QA166-X1', 'excluir');
  const vieja = await pedir(`/importaciones/${lote.loteId}/filas/${filaDe(lote, 'QA166-N1').numeroFila}`, { metodo: 'PATCH', cuerpo: { version: versionVieja, decision: 'crear' } });
  assert.equal(vieja.status, 409, 'Una decisión con versión vieja se rechaza');
  assert.deepEqual(await foto(), fotoAntes);
});

test('M5 · vincular a una carpeta existente y confirmar no modifica ningún registro antiguo', opciones, async () => {
  await decidir('QA166-D1', 'vincular', { casoDestinoId: E.id });
  await decidir('QA166-N1', 'crear');
  const formula = filaDe(lote, 'QA166-F1');
  await decidir('QA166-F1', formula.estado === 'error' ? 'excluir' : 'crear');
  const antes = await contar();
  const r = await pedir(`/importaciones/${lote.loteId}/confirmar`, { metodo: 'POST', cuerpo: { version: lote.version, aceptaAvanceContador: true } });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const creadas = formula.estado === 'error' ? 1 : 2;
  assert.deepEqual(await contar(), { pacientes: antes.pacientes + creadas, casos: antes.casos + creadas });

  const despues = await foto();
  assert.deepEqual(despues.pacientes, fotoAntes.pacientes, 'Identidad y residencia del paciente antiguo intactas');
  assert.deepEqual(despues.casos, fotoAntes.casos, 'Número, tipo, fecha, clasificación y estado de las carpetas antiguas intactos');
  assert.deepEqual(despues.diagnosticos, fotoAntes.diagnosticos, 'La ficha clínica vigente no se reemplaza');
  assert.deepEqual(despues.asignaciones, fotoAntes.asignaciones, 'Las asignaciones no cambian');
  assert.deepEqual(despues.sesiones, fotoAntes.sesiones, 'El historial de sesiones no cambia');

  const { rows: [nueva] } = await sql.query(
    `select p.nombre_completo, p.ciudad_residencia, c.tipo, c.numero_correlativo, to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha
       from pacientes p join casos c on c.paciente_id = p.id where p.nombre_completo = 'Nueva Importada QA'`);
  assert.equal(nueva.fecha, '2019-05-10', 'Fecha histórica, no la de importación');
  assert.equal(nueva.ciudad_residencia, 'la_paz');
  assert.ok(nueva.numero_correlativo > E.numero_correlativo, 'Número asignado sin chocar con los existentes');
  if (formula.estado !== 'error') {
    const { rows } = await sql.query('select nombre_completo from pacientes where nombre_completo = $1', [FORMULA]);
    assert.equal(rows.length, 1, 'Una fórmula se guarda como texto literal');
  }
});

test('M6 · confirmar otra vez y volver a subir el mismo archivo no duplica nada', opciones, async () => {
  const antes = await contar();
  const otra = await pedir(`/importaciones/${lote.loteId}/confirmar`, { metodo: 'POST', cuerpo: { version: lote.version, aceptaAvanceContador: true } });
  assert.ok([200, 409].includes(otra.status), `Segunda confirmación: ${otra.status}`);
  const resubida = await cargar(csv);
  assert.equal(resubida.status, 409, 'El mismo archivo ya importado se rechaza');
  assert.deepEqual(await contar(), antes);
  assert.deepEqual(await foto(), fotoAntes);
});

test('M7 · otro lote que intenta vincular, corregir o crear sobre la carpeta antigua tampoco la altera', opciones, async () => {
  const contenido = [COLUMNAS, fila({ referenciaOrigen: 'QA166-Z1', nombreCompleto: 'Otro Antiguo QA', tipo: 'voluntario', numeroCorrelativo: String(F.numero_correlativo), fechaIngreso: '2020-01-01', clasificacion: 'privado', ciudadResidencia: 'otra', otraLocalidad: 'Viacha ficticia', comentariosClinicos: 'Intento de sobrescribir' })].join('\n') + '\n';
  const r = await cargar(contenido, { nombre: 'segundo-lote.csv' });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  lote = r.cuerpo;
  const z = filaDe(lote, 'QA166-Z1');
  const corregir = await pedir(`/importaciones/${lote.loteId}/filas/${z.numeroFila}/datos`, { metodo: 'PATCH', cuerpo: { version: lote.version, datos: { nombreCompleto: 'Nombre cambiado QA' } } });
  assert.equal(corregir.status, 200, JSON.stringify(corregir.cuerpo));
  lote = corregir.cuerpo;
  const intentoCrear = await pedir(`/importaciones/${lote.loteId}/filas/${z.numeroFila}`, { metodo: 'PATCH', cuerpo: { version: lote.version, decision: 'crear' } });
  if (intentoCrear.status === 200) {
    lote = intentoCrear.cuerpo;
    const conf = await pedir(`/importaciones/${lote.loteId}/confirmar`, { metodo: 'POST', cuerpo: { version: lote.version, aceptaAvanceContador: true } });
    assert.notEqual(conf.status, 200, 'Crear con un número ya ocupado no debe confirmarse');
  }
  assert.deepEqual(await foto(), fotoAntes, 'La carpeta F y su paciente siguen intactos');
});

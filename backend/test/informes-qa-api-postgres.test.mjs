import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { InformesModule } from '../dist/modules/informes/informes.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

const FICHA_A = {
  fecha: '2026-10-10',
  evaluacionInicial: 'Evaluación inicial ficticia del caso A.',
  diagnosticoIngreso: 'Diagnóstico de ingreso ficticio A.',
  hipotesisRelacional: 'Hipótesis relacional ficticia A.',
};

let base, sql, api, A, B, C, J, sesiones;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe155');
  sql = base.cliente;
  A = await crearCaso(sql, { nombre: 'Paciente Informe A', terapeuta: PERFILES.t1 });
  B = await crearCaso(sql, { nombre: 'Paciente Informe B', terapeuta: PERFILES.t1 });
  C = await crearCaso(sql, { nombre: 'Paciente Informe C', terapeuta: PERFILES.t1 });
  J = await crearCaso(sql, { nombre: 'Paciente Informe J', tipo: 'derivado', terapeuta: PERFILES.t1 });
  sesiones = {
    a1: await crearSesion(sql, A.id, { fecha: '2026-10-12', evolucion: 'Evolución A uno.' }),
    a2: await crearSesion(sql, A.id, { fecha: '2026-10-19', evolucion: 'Evolución A dos, no seleccionada.' }),
    a3: await crearSesion(sql, A.id, { fecha: '2026-10-26', evolucion: 'Evolución A tres.' }),
    b1: await crearSesion(sql, B.id, { fecha: '2026-10-13', evolucion: 'Evolución exclusiva del caso B.' }),
    j1: await crearSesion(sql, J.id, { fecha: '2026-10-14', evolucion: 'Evolución del caso judicial.' }),
  };
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-12', '987.65', 'qr')`,
    [A.id, sesiones.a1.id]));
  await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(
      `insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion) values ($1, $2, $3, '2026-10-01')`,
      [J.id, 'Juzgado ficticio QA FE-155', 'EXP-QA-155']);
  });
  await comoUsuario(sql, PERFILES.t1, async () => {
    await sql.query('insert into fichas_familiares (caso_id) values ($1)', [A.id]);
    await sql.query(
      `insert into familiares (caso_id, parentesco, nombre_completo) values ($1, 'madre', 'Madre QA Informe')`, [A.id]);
  });
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await sql.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, t2: PERFILES.t2, mkt: PERFILES.marketing }, { modulos: [InformesModule] });
  const ficha = await pedir(`/carpetas/${A.id}/diagnostico`, { metodo: 'PUT', cuerpo: FICHA_A });
  assert.equal(ficha.status, 200, JSON.stringify(ficha.cuerpo));
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 't1', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}
async function generar(caso, cuerpo, token = 't1') {
  const r = await pedir(`/carpetas/${caso.id}/informes`, { token, metodo: 'POST', cuerpo });
  if (r.status >= 300) return r;
  const version = await pedir(`/carpetas/${caso.id}/informes/${r.cuerpo.id}`, { token });
  return { status: r.status, cuerpo: version.cuerpo };
}
const secciones = (version) => Object.fromEntries(version.secciones.map(({ titulo, contenido }) => [titulo, contenido]));
const textoCompleto = (version) => version.secciones.map((s) => `${s.titulo}\n${s.contenido}`).join('\n');
const cantidadInformes = async (caso) => (await pedir(`/carpetas/${caso.id}/informes`)).cuerpo.informes.length;

test('I1 · sistémico del caso A: identificación, evaluación vigente y solo las sesiones elegidas, en orden de fecha', { ...opciones }, async () => {
  const r = await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a3.id, sesiones.a1.id] });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  const v = r.cuerpo;
  assert.equal(v.estado, 'borrador');
  assert.equal(v.versionPlantilla, 'fe151-sistemica-v3');
  assert.deepEqual(v.secciones.map((s) => s.titulo), [
    'Identificación', 'Profesional responsable', 'Evaluación', 'Intervención y evolución', 'Conclusiones y recomendaciones',
  ]);
  const s = secciones(v);
  assert.equal(s['Identificación'], 'Paciente Informe A');
  assert.equal(s['Profesional responsable'], 't1 QA');
  for (const dato of [FICHA_A.evaluacionInicial, FICHA_A.diagnosticoIngreso, FICHA_A.hipotesisRelacional]) {
    assert.ok(s['Evaluación'].includes(dato), `Evaluación debe incluir: ${dato}`);
  }
  const intervencion = s['Intervención y evolución'];
  assert.ok(intervencion.includes('Evolución A uno.') && intervencion.includes('Evolución A tres.'));
  assert.ok(intervencion.indexOf('Evolución A uno.') < intervencion.indexOf('Evolución A tres.'), 'Orden por fecha, no por el orden enviado');
  assert.ok(!intervencion.includes('no seleccionada'), 'No cita la sesión no elegida');
  assert.equal(s['Conclusiones y recomendaciones'], 'Pendiente de redacción profesional.', 'No inventa conclusiones');
});

test('I2 · el informe no mezcla datos de otro caso ni incluye pagos', opciones, async () => {
  const v = (await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a1.id] })).cuerpo;
  const texto = textoCompleto(v);
  assert.ok(!texto.includes('caso B') && !texto.includes('Paciente Informe B'));
  assert.ok(!/987[.,]65|Bs\s|BOB|pago/i.test(texto), 'Los datos financieros quedan fuera de las plantillas');
});

test('I3 · caso sin diagnóstico ni sesiones: declara las ausencias, no las rellena', opciones, async () => {
  const s = secciones((await generar(C, { tipo: 'intervencion_sistemica' })).cuerpo);
  assert.equal(s['Identificación'], 'Paciente Informe C');
  assert.equal(s['Evaluación'], 'Sin datos registrados.');
  assert.equal(s['Intervención y evolución'], 'Sin sesiones seleccionadas.');
  assert.ok(!textoCompleto((await generar(C, { tipo: 'intervencion_sistemica' })).cuerpo).includes('ficticio A'));
});

test('I4 · una sesión de otro caso, inexistente o repetida no entra al informe y no se guarda nada', opciones, async () => {
  const antes = await cantidadInformes(A);
  for (const [nombre, ids] of [
    ['sesión de otro caso', [sesiones.a1.id, sesiones.b1.id]],
    ['sesión inexistente', ['00000000-0000-4000-8000-00000000abcd']],
  ]) {
    const r = await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: ids });
    assert.ok(r.status >= 400 && r.status < 500, `${nombre}: respondió ${r.status}`);
  }
  const repetida = await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a1.id, sesiones.a1.id] });
  if (repetida.status < 300) {
    const veces = secciones(repetida.cuerpo)['Intervención y evolución'].split('Evolución A uno.').length - 1;
    assert.equal(veces, 1, 'Una sesión repetida en la solicitud se cita una sola vez');
  }
  const esperados = antes + (repetida.status < 300 ? 1 : 0);
  assert.equal(await cantidadInformes(A), esperados, 'Los rechazos no guardan informes');
});

test('I5 · judicial: destinatario y referencia del caso, objeto indicado y mínimos exigidos', opciones, async () => {
  const objeto = 'Informar el seguimiento registrado a solicitud del juzgado ficticio.';
  const r = await generar(J, { tipo: 'judicial', objeto, sesionesIds: [sesiones.j1.id] });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  const s = secciones(r.cuerpo);
  assert.equal(s.Destinatario, 'Juzgado ficticio QA FE-155');
  assert.equal(s['Referencia de expediente'], 'EXP-QA-155');
  assert.equal(s['Objeto del informe'], objeto);
  assert.ok(s['Intervención y observaciones'].includes('Evolución del caso judicial.'));
  assert.equal(s.Conclusiones, 'Pendiente de redacción profesional.');

  const antes = await cantidadInformes(J);
  const sinObjeto = await generar(J, { tipo: 'judicial', objeto: '   ' });
  assert.equal(sinObjeto.status, 422);
  assert.deepEqual(sinObjeto.cuerpo.camposFaltantes, ['objeto']);
  const sinJuzgado = await generar(C, { tipo: 'judicial', objeto });
  assert.equal(sinJuzgado.status, 422);
  assert.ok(sinJuzgado.cuerpo.camposFaltantes.includes('judicial.juzgado'), 'No inventa un juzgado');
  assert.equal(await cantidadInformes(J), antes);
});

test('I6 · revisar conserva el texto revisado; un cambio posterior del diagnóstico no lo altera', opciones, async () => {
  const v = (await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a1.id] })).cuerpo;
  const revisadas = v.secciones.map((s) => s.titulo === 'Conclusiones y recomendaciones'
    ? { ...s, contenido: 'Conclusión redactada por la profesional (ficticia).' } : s);
  const r = await pedir(`/carpetas/${A.id}/informes/${v.id}/revision`, { metodo: 'PATCH', cuerpo: { secciones: revisadas } });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const segunda = await pedir(`/carpetas/${A.id}/informes/${v.id}/revision`, { metodo: 'PATCH', cuerpo: { secciones: revisadas } });
  assert.equal(segunda.status, 409, 'Revisar es definitivo');

  const nuevoDiagnostico = 'Diagnóstico corregido después de revisar.';
  assert.equal((await pedir(`/carpetas/${A.id}/diagnostico`, { metodo: 'PUT', cuerpo: { ...FICHA_A, diagnosticoIngreso: nuevoDiagnostico } })).status, 200);

  const revisado = (await pedir(`/carpetas/${A.id}/informes/${v.id}`)).cuerpo;
  assert.equal(revisado.estado, 'revisado');
  assert.equal(revisado.revisadoPor, PERFILES.t1);
  assert.ok(secciones(revisado)['Evaluación'].includes(FICHA_A.diagnosticoIngreso), 'El revisado conserva el diagnóstico de su momento');
  assert.equal(secciones(revisado)['Conclusiones y recomendaciones'], 'Conclusión redactada por la profesional (ficticia).');

  const nuevo = (await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a1.id] })).cuerpo;
  assert.ok(secciones(nuevo)['Evaluación'].includes(nuevoDiagnostico), 'Una nueva generación usa el dato nuevo');
  await pedir(`/carpetas/${A.id}/diagnostico`, { metodo: 'PUT', cuerpo: FICHA_A });
});

test('I7 · permisos: solo la terapeuta asignada genera y consulta; una versión no se lee desde otro caso', opciones, async () => {
  const v = (await generar(A, { tipo: 'intervencion_sistemica' })).cuerpo;
  for (const [token, esperado] of [['t2', 404], ['mkt', 403], ['admin', 403], [null, 401]]) {
    assert.equal((await pedir(`/carpetas/${A.id}/informes`, { token, metodo: 'POST', cuerpo: { tipo: 'intervencion_sistemica' } })).status, esperado, `POST ${token}`);
    assert.equal((await pedir(`/carpetas/${A.id}/informes/${v.id}`, { token })).status, esperado, `GET ${token}`);
  }
  assert.equal((await pedir(`/carpetas/${B.id}/informes/${v.id}`)).status, 404, 'La versión de A no se abre con la ruta de B');
});

test('I8 · tipo o datos de la solicitud inválidos dan 400', opciones, async () => {
  for (const cuerpo of [
    { tipo: 'financiero' },
    { tipo: 'intervencion_sistemica', sesionesIds: ['no-es-uuid'] },
    { tipo: 'intervencion_sistemica', incluirFamilia: 'si' },
    { tipo: 'intervencion_sistemica', conclusiones: 'Texto inventado por el cliente' },
  ]) {
    assert.equal((await generar(A, cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
});

test('I9 · FE155-01: la composición familiar seleccionada aparece en el informe (FE-151, plantilla A, punto 4)', {
  ...opciones,
}, async () => {
  const con = (await generar(A, { tipo: 'intervencion_sistemica', incluirFamilia: true })).cuerpo;
  const sin = (await generar(A, { tipo: 'intervencion_sistemica', incluirFamilia: false })).cuerpo;
  assert.notDeepEqual(con.secciones, sin.secciones, 'Marcar "Composición familiar" debe cambiar el informe');
  assert.ok(textoCompleto(con).includes('Madre QA Informe'), 'La madre registrada debe figurar en el informe');
  assert.ok(!textoCompleto(sin).includes('Madre QA Informe'));
  assert.ok(!textoCompleto((await generar(C, { tipo: 'intervencion_sistemica', incluirFamilia: true })).cuerpo).includes('Madre QA Informe'));
});

 test('I10 · las tareas corresponden solo a las sesiones seleccionadas', opciones, async () => {
  await comoUsuario(sql, PERFILES.t1, async () => {
    for (const [sesion, descripcion] of [[sesiones.a1, 'Tarea elegida QA155'], [sesiones.a2, 'Tarea omitida QA155']]) {
      await sql.query('insert into tareas_terapeuticas(caso_id,sesion_id,descripcion,perfil_id) values($1,$2,$3,$4)', [A.id,sesion.id,descripcion,PERFILES.t1]);
    }
  });
  const v = (await generar(A, { tipo: 'intervencion_sistemica', sesionesIds: [sesiones.a1.id] })).cuerpo;
  assert.ok(textoCompleto(v).includes('Tarea elegida QA155'));
  assert.ok(!textoCompleto(v).includes('Tarea omitida QA155'));
 });

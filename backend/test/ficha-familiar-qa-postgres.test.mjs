import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { servidor } from './helpers/casos.mjs';
import { crearBase, crearCaso, opciones, PERFILES } from './helpers/pg-qa.mjs';

let base, api, casoA, casoB, casoSinFicha;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe128');
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${base.cliente.database}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  casoA = await crearCaso(base.cliente, { nombre: 'Paciente A ficticio', terapeuta: PERFILES.t1 });
  casoB = await crearCaso(base.cliente, { nombre: 'Paciente B ficticio', terapeuta: PERFILES.t2 });
  casoSinFicha = await crearCaso(base.cliente, { nombre: 'Paciente C ficticio', terapeuta: PERFILES.t1 });
  api = await servidor(db, {
    t1: PERFILES.t1, t2: PERFILES.t2, admin: PERFILES.admin, marketing: PERFILES.marketing,
  });
});

after(async () => {
  try { await api?.close(); } finally { await base?.cerrar(); }
});


async function pedir(ruta, { token = 't1', metodo = 'GET', cuerpo } = {}) {
  const res = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await res.text();
  return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}
const familia = (caso, token = 't1') => pedir(`/carpetas/${caso.id}/familia`, { token });
const guardarFamilia = (caso, cuerpo, token = 't1') =>
  pedir(`/carpetas/${caso.id}/familia`, { token, metodo: 'PUT', cuerpo });
const diagnostico = (caso, token = 't1') => pedir(`/carpetas/${caso.id}/diagnostico`, { token });
const guardarDiagnostico = (caso, cuerpo, token = 't1') =>
  pedir(`/carpetas/${caso.id}/diagnostico`, { token, metodo: 'PUT', cuerpo });
const vigente = (caso, token = 't1') => pedir(`/carpetas/${caso.id}/diagnostico/vigente`, { token });

async function ok(promesa) {
  const r = await promesa;
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  return r.cuerpo;
}

async function rechazaSinCambios(caso, cuerpo, estado = 400, token = 't1', etiqueta = '') {
  const antes = await ok(familia(caso));
  const r = await guardarFamilia(caso, cuerpo, token);
  assert.equal(r.status, estado, `${etiqueta} → ${JSON.stringify(r.cuerpo)}`);
  const despues = await ok(familia(caso));
  assert.deepEqual(despues, antes, `${etiqueta}: una solicitud rechazada no debe cambiar la ficha`);
}

const sinAutoria = ({ creadoEn, actualizadoEn, ...resto }) => resto;


test('Q1 · ficha A: crear la familia, recargar y ver los parentescos respecto del paciente', opciones, async () => {
  const inicial = await ok(familia(casoA));
  assert.equal(inicial.registrada, false);
  assert.equal(inicial.version, null);

  const creada = await ok(guardarFamilia(casoA, {
    version: null,
    familiares: [
      { parentesco: 'padre', nombreCompleto: 'Padre QA', edadReferida: 44, fechaReferencia: '2026-11-20',
        ocupacion: 'Conductor', lugarTrabajoEstudio: 'Empresa ficticia', conviveConPaciente: true },
      { parentesco: 'madre', nombreCompleto: 'Madre QA', edadReferida: 41, fechaReferencia: '2026-11-20',
        conviveConPaciente: true },
      { parentesco: 'hermana', nombreCompleto: 'Hermana QA', fechaNacimiento: '2018-03-15',
        ocupacion: 'Estudiante', conviveConPaciente: true },
      { parentesco: 'abuela_materna', nombreCompleto: 'Abuela QA', edadReferida: 68, fechaReferencia: '2026-11-20' },
    ],
  }));
  assert.equal(creada.registrada, true);
  assert.equal(creada.version, 1, 'Crear cabecera e integrantes en una transacción deja la versión en 1');
  assert.equal(creada.pacienteId, casoA.pacienteId);

  const recargada = await ok(familia(casoA));
  assert.deepEqual(recargada, creada, 'Recargar devuelve exactamente lo guardado');
  assert.deepEqual(recargada.familiares.map((f) => f.parentesco), ['padre', 'madre', 'hermana', 'abuela_materna']);
  const padre = recargada.familiares[0];
  assert.equal(padre.edadReferida, 44);
  assert.equal(padre.fechaReferencia, '2026-11-20');
  assert.equal(padre.fechaNacimiento, null);
  assert.equal(recargada.familiares[2].fechaNacimiento, '2018-03-15');
  for (const f of recargada.familiares) assert.equal(f.creadoPor, PERFILES.t1);
});

test('Q2 · ficha B: datos desconocidos quedan en null y los parentescos se pueden repetir', opciones, async () => {
  const creada = await ok(guardarFamilia(casoB, {
    version: null,
    familiares: [
      { parentesco: 'hijo', nombreCompleto: 'Hijo QA', ocupacion: 'Estudiante' },
      { parentesco: 'tio', nombreCompleto: 'Tío uno QA' },
      { parentesco: 'tio', nombreCompleto: 'Tío dos QA' },
      { parentesco: 'abuelo_paterno' },
      { parentesco: 'otro', parentescoDetalle: 'Padrino', nombreCompleto: '   ' },
    ],
  }, 't2'));
  assert.equal(creada.familiares.length, 5);
  const abuelo = creada.familiares[3];
  for (const campo of ['nombreCompleto', 'fechaNacimiento', 'edadReferida', 'fechaReferencia',
    'ocupacion', 'lugarTrabajoEstudio', 'conviveConPaciente', 'observaciones']) {
    assert.equal(abuelo[campo], null, `${campo} desconocido debe ser null, no un texto inventado`);
  }
  assert.equal(creada.familiares[4].parentescoDetalle, 'Padrino');
  assert.equal(creada.familiares[4].nombreCompleto, null, 'Un nombre de solo espacios se guarda como desconocido');

  const familiaVacia = await ok(guardarFamilia(casoSinFicha, { version: null, familiares: [] }));
  assert.equal(familiaVacia.registrada, true, 'Registrada sin integrantes ≠ sin registrar');
  assert.deepEqual(familiaVacia.familiares, []);
});

test('Q3 · dos ediciones parciales conservan los demás campos; null explícito limpia', opciones, async () => {
  const actual = await ok(familia(casoA));
  const padre = actual.familiares[0];

  const primera = await ok(guardarFamilia(casoA, {
    version: actual.version,
    familiares: [{ id: padre.id, parentesco: 'padre', ocupacion: 'Mecánico' }],
  }));
  const segunda = await ok(guardarFamilia(casoA, {
    version: primera.version,
    familiares: [{ id: padre.id, parentesco: 'padre', lugarTrabajoEstudio: null }],
  }, 'admin'));

  assert.equal(segunda.version, actual.version + 2);
  assert.equal(segunda.familiares.length, 4, 'No se pierde ni se duplica ningún integrante');
  const editado = segunda.familiares.find((f) => f.id === padre.id);
  assert.equal(editado.ocupacion, 'Mecánico');
  assert.equal(editado.lugarTrabajoEstudio, null);
  assert.equal(editado.nombreCompleto, 'Padre QA');
  assert.equal(editado.edadReferida, 44);
  assert.equal(editado.conviveConPaciente, true);
  assert.equal(editado.creadoPor, PERFILES.t1, 'La autoría de creación se conserva');
  assert.equal(editado.actualizadoPor, PERFILES.admin, 'La última actualización registra a quien editó');
  for (const otro of segunda.familiares.filter((f) => f.id !== padre.id)) {
    const antes = actual.familiares.find((f) => f.id === otro.id);
    assert.deepEqual(sinAutoria(otro), sinAutoria(antes), 'Los integrantes no editados quedan iguales');
  }
});

test('Q4 · regresión: editar la familia no cambia el diagnóstico y viceversa', opciones, async () => {
  const fichaDiag = {
    fecha: '2026-11-20',
    evaluacionInicial: 'Evaluación familiar ficticia QA',
    diagnosticoIngreso: 'Diagnóstico ficticio QA',
    hipotesisRelacional: 'Hipótesis ficticia QA',
    comentariosClinicos: null,
  };
  await ok(guardarDiagnostico(casoA, fichaDiag));
  const diagAntes = await ok(diagnostico(casoA));
  const vigenteAntes = await ok(vigente(casoA));
  assert.equal(vigenteAntes.origen, 'ficha');

  const fam = await ok(familia(casoA));
  await ok(guardarFamilia(casoA, {
    version: fam.version,
    familiares: [{ parentesco: 'tia', nombreCompleto: 'Tía QA' }],
  }));
  assert.deepEqual(await ok(diagnostico(casoA)), diagAntes, 'Guardar familia no toca el diagnóstico');
  assert.deepEqual(await ok(vigente(casoA)), vigenteAntes);

  const famAntes = await ok(familia(casoA));
  await ok(guardarDiagnostico(casoA, { ...fichaDiag, diagnosticoIngreso: 'Diagnóstico editado QA' }));
  await ok(guardarDiagnostico(casoA, { ...fichaDiag, diagnosticoIngreso: 'Segunda edición QA' }));
  assert.deepEqual(await ok(familia(casoA)), famAntes, 'Guardar diagnóstico no toca la familia ni su versión');

  const diag = (await ok(diagnostico(casoA))).diagnostico;
  assert.equal(diag.diagnosticoIngreso, 'Segunda edición QA');
  assert.equal(diag.hipotesisRelacional, 'Hipótesis ficticia QA');
  assert.equal(diag.id, diagAntes.diagnostico.id, 'Editar conserva el ID de la ficha (FE-66)');
  assert.equal(diag.creadoPor, diagAntes.diagnostico.creadoPor);
});

test('Q5 · fuente vigente: sin datos → alta → ficha, sin borrar el alta', opciones, async () => {
  assert.equal((await ok(vigente(casoSinFicha))).origen, 'sin_datos');
  await base.cliente.query(
    'update casos set diagnostico_ingreso = $2, hipotesis_relacional = $3 where id = $1',
    [casoSinFicha.id, 'Diagnóstico del alta QA', 'Hipótesis del alta QA'],
  );
  const alta = await ok(vigente(casoSinFicha));
  assert.equal(alta.origen, 'alta');
  assert.equal(alta.diagnosticoIngreso, 'Diagnóstico del alta QA');

  await ok(guardarDiagnostico(casoSinFicha, {
    evaluacionInicial: 'Evaluación inicial ficticia QA',
    fecha: '2026-11-21', diagnosticoIngreso: 'Diagnóstico de la ficha QA', hipotesisRelacional: null,
  }));
  const ficha = await ok(vigente(casoSinFicha));
  assert.equal(ficha.origen, 'ficha');
  assert.equal(ficha.diagnosticoIngreso, 'Diagnóstico de la ficha QA');
  assert.equal(ficha.hipotesisRelacional, null, 'Un null de la ficha no se rellena con el alta');
  assert.equal(ficha.alta.hipotesisRelacional, 'Hipótesis del alta QA', 'El dato del alta se conserva');
});

test('Q6 · validaciones: 400 sin escrituras parciales', opciones, async () => {
  const actual = await ok(familia(casoA));
  const padre = actual.familiares[0];
  const conCambioValido = (invalido) => ({
    version: actual.version,
    familiares: [{ id: padre.id, parentesco: 'padre', ocupacion: 'Cambio que no debe quedar' }, invalido],
  });
  const casos = {
    'parentesco fuera del catálogo': { parentesco: 'primo' },
    'parentesco ausente': { nombreCompleto: 'Sin parentesco' },
    '"otro" sin detalle': { parentesco: 'otro' },
    'detalle con parentesco que no es "otro"': { parentesco: 'madre', parentescoDetalle: 'Biológica' },
    'fecha de nacimiento futura': { parentesco: 'hermano', fechaNacimiento: '2099-01-01' },
    'fecha imposible': { parentesco: 'hermano', fechaNacimiento: '2026-02-30' },
    'fecha con otro formato': { parentesco: 'hermano', fechaNacimiento: '15/03/2018' },
    'edad sin fecha de referencia': { parentesco: 'hermano', edadReferida: 10 },
    'nacimiento y edad a la vez': { parentesco: 'hermano', fechaNacimiento: '2015-01-01', edadReferida: 10, fechaReferencia: '2026-11-20' },
    'edad mayor a 130': { parentesco: 'abuelo_materno', edadReferida: 131, fechaReferencia: '2026-11-20' },
    'edad negativa': { parentesco: 'hermano', edadReferida: -1, fechaReferencia: '2026-11-20' },
    'nombre de más de 150 caracteres': { parentesco: 'hermano', nombreCompleto: 'x'.repeat(151) },
    'campo de autoría enviado por el cliente': { parentesco: 'hermano', creadoPor: PERFILES.t2 },
  };
  for (const [nombre, invalido] of Object.entries(casos)) {
    await rechazaSinCambios(casoA, conCambioValido(invalido), 400, 't1', nombre);
  }
  await rechazaSinCambios(casoA, { version: actual.version, familiares: [], campoExtra: true });
  await rechazaSinCambios(casoA, {
    version: actual.version,
    familiares: [{ id: padre.id, parentesco: 'padre' }, { id: padre.id, parentesco: 'padre' }],
  });
});

test('Q7 · aislamiento: no se editan ni eliminan familiares de otro caso', opciones, async () => {
  const fichaA = await ok(familia(casoA));
  const fichaB = await ok(familia(casoB, 't2'));
  const ajeno = fichaB.familiares[0];

  await rechazaSinCambios(casoA, {
    version: fichaA.version,
    familiares: [{ id: ajeno.id, parentesco: 'hijo', nombreCompleto: 'Intento de mover' }],
  }, 404);
  await rechazaSinCambios(casoA, { version: fichaA.version, familiares: [], eliminarIds: [ajeno.id] }, 404);
  assert.deepEqual(await ok(familia(casoB, 't2')), fichaB, 'La ficha del otro caso queda intacta');
});

test('Q8 · ediciones concurrentes: versión vieja o null sobre ficha registrada → 409', opciones, async () => {
  const actual = await ok(familia(casoA));
  await rechazaSinCambios(casoA, { version: actual.version - 1, familiares: [] }, 409);
  await rechazaSinCambios(casoA, { version: null, familiares: [] }, 409);
});

test('Q9 · eliminación lógica: el integrante desaparece y no se puede volver a editar', opciones, async () => {
  const actual = await ok(familia(casoA));
  const tia = actual.familiares.find((f) => f.parentesco === 'tia');
  const sinTia = await ok(guardarFamilia(casoA, { version: actual.version, familiares: [], eliminarIds: [tia.id] }));
  assert.equal(sinTia.familiares.length, actual.familiares.length - 1);
  assert.ok(!sinTia.familiares.some((f) => f.id === tia.id));

  await rechazaSinCambios(casoA, {
    version: sinTia.version, familiares: [{ id: tia.id, parentesco: 'tia', nombreCompleto: 'Revivir' }],
  }, 404);
  const { rows } = await base.cliente.query('select deleted_at from familiares where id = $1', [tia.id]);
  assert.ok(rows[0].deleted_at, 'El registro se conserva con deleted_at (no se borra físicamente)');
});

test('Q10 · permisos de familia y diagnóstico vigente', opciones, async () => {
  const fichaA = await ok(familia(casoA));
  const cuerpo = { version: fichaA.version, familiares: [] };
  const rutas = [`/carpetas/${casoA.id}/familia`, `/carpetas/${casoA.id}/diagnostico/vigente`];

  for (const ruta of rutas) {
    assert.equal((await pedir(ruta, { token: null })).status, 401, `${ruta} sin sesión`);
    assert.equal((await pedir(ruta, { token: 'token-inventado' })).status, 401, `${ruta} token inventado`);
    assert.equal((await pedir(ruta, { token: 'marketing' })).status, 403, `${ruta} marketing`);
    assert.equal((await pedir(ruta, { token: 't2' })).status, 404, `${ruta} terapeuta ajena`);
    assert.equal((await pedir(ruta, { token: 'admin' })).status, 200, `${ruta} administración`);
  }
  await rechazaSinCambios(casoA, cuerpo, 403, 'marketing');
  await rechazaSinCambios(casoA, cuerpo, 404, 't2');

  const inexistente = '00000000-0000-4000-8000-00000000ffff';
  assert.equal((await pedir(`/carpetas/${inexistente}/familia`)).status, 404);
  assert.equal((await pedir('/carpetas/no-es-uuid/familia')).status, 400);
});

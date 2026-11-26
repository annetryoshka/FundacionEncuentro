import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { servidor } from './helpers/casos.mjs';
import {
  comoUsuario,
  crearBase,
  crearCaso,
  opciones,
  PERFILES,
} from './helpers/pg-qa.mjs';

test('GET familia distingue ausencia, ficha vacía y ficha con integrantes', opciones, async (t) => {
  const base = await crearBase('fe126');
  let db;
  let api;

  t.after(async () => {
    try {
      if (api) await api.close();
      else await db?.onModuleDestroy();
    } finally {
      await base.cerrar();
    }
  });

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${base.cliente.database}`;
  db = new DatabaseService({ getOrThrow: () => url.toString() });

  const caso = await crearCaso(base.cliente, { terapeuta: PERFILES.t1 });
  api = await servidor(db, {
    fixture: PERFILES.t1,
    ajena: PERFILES.t2,
    marketing: PERFILES.marketing,
  });

  const ruta = `/carpetas/${caso.id}/familia`;

  for (const [token, estado] of [[null, 401], ['marketing', 403], ['ajena', 404]]) {
    const respuesta = await api.solicitar(ruta, { token });
    assert.equal(respuesta.status, estado);
    await respuesta.json();
  }

  const consultar = async () => {
    const respuesta = await api.solicitar(ruta);
    const cuerpo = await respuesta.json();
    assert.equal(respuesta.status, 200, JSON.stringify(cuerpo));
    return cuerpo;
  };

  const sinRegistrar = await consultar();
  assert.equal(sinRegistrar.registrada, false);
  assert.equal(sinRegistrar.version, null);
  assert.deepEqual(sinRegistrar.familiares, []);

  await comoUsuario(base.cliente, PERFILES.t1, () =>
    base.cliente.query(
      'insert into fichas_familiares (caso_id) values ($1)',
      [caso.id],
    ),
  );

  const vacia = await consultar();
  assert.equal(vacia.registrada, true);
  assert.equal(vacia.version, 1);
  assert.deepEqual(vacia.familiares, []);

  await comoUsuario(base.cliente, PERFILES.t1, () =>
    base.cliente.query(
      `insert into familiares (caso_id, parentesco, nombre_completo)
       values ($1, 'madre', 'Madre ficticia QA')`,
      [caso.id],
    ),
  );

  const registrada = await consultar();
  assert.equal(registrada.casoId, caso.id);
  assert.equal(registrada.pacienteId, caso.pacienteId);
  assert.equal(registrada.version, 2);
  assert.equal(registrada.familiares.length, 1);
  assert.equal(registrada.familiares[0].parentesco, 'madre');
  assert.equal(registrada.familiares[0].nombreCompleto, 'Madre ficticia QA');
  assert.equal(registrada.familiares[0].creadoPor, PERFILES.t1);

    const madre = registrada.familiares[0];
  const guardar = (cuerpo, token = 'fixture') =>
    api.solicitar(ruta, { metodo: 'PUT', cuerpo, token });

  const cambios = {
    version: registrada.version,
    familiares: [
      { id: madre.id, parentesco: 'madre', ocupacion: 'Comerciante' },
      { parentesco: 'hermano', nombreCompleto: 'Hermano ficticio QA' },
    ],
  };

  const denegada = await guardar(cambios, 'ajena');
  assert.equal(denegada.status, 404);
  await denegada.json();

  const primera = await guardar(cambios);
  const fichaEditada = await primera.json();
  assert.equal(primera.status, 200, JSON.stringify(fichaEditada));
  assert.equal(fichaEditada.version, registrada.version + 1);
  assert.equal(fichaEditada.familiares.length, 2);

  const desactualizada = await guardar(cambios);
  assert.equal(desactualizada.status, 409);
  await desactualizada.json();

  const segunda = await guardar({
    version: fichaEditada.version,
    familiares: [
      { id: madre.id, parentesco: 'madre', conviveConPaciente: false },
    ],
  });
  const fichaFinal = await segunda.json();
  assert.equal(segunda.status, 200, JSON.stringify(fichaFinal));
  assert.equal(fichaFinal.version, fichaEditada.version + 1);
  assert.equal(fichaFinal.familiares.length, 2);

  const madreEditada = fichaFinal.familiares.find(({ id }) => id === madre.id);
  assert.equal(madreEditada.nombreCompleto, 'Madre ficticia QA');
  assert.equal(madreEditada.ocupacion, 'Comerciante');
  assert.equal(madreEditada.conviveConPaciente, false);

  const hermano = fichaFinal.familiares.find(({ parentesco }) => parentesco === 'hermano');
  const eliminacion = await guardar({
    version: fichaFinal.version,
    familiares: [],
    eliminarIds: [hermano.id],
  });
  const fichaSinHermano = await eliminacion.json();
  assert.equal(eliminacion.status, 200, JSON.stringify(fichaSinHermano));
  assert.deepEqual(fichaSinHermano.familiares.map(({ id }) => id), [madre.id]);

    const invalida = await guardar({
    version: fichaSinHermano.version,
    familiares: [
      { id: madre.id, parentesco: 'madre', ocupacion: 'Cambio que debe revertirse' },
      { parentesco: 'otro', nombreCompleto: 'Familiar sin detalle de parentesco' },
    ],
  });

  assert.equal(invalida.status, 400);
  await invalida.json();

  const despuesDelFallo = await consultar();
  assert.equal(despuesDelFallo.version, fichaSinHermano.version);
  assert.deepEqual(despuesDelFallo.familiares, fichaSinHermano.familiares);
});
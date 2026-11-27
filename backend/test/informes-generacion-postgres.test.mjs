import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { CasosService } from '../dist/modules/casos/casos.service.js';
import { InformesService } from '../dist/modules/informes/informes.service.js';
import { crearBase, crearCaso, opciones, PERFILES, crearSesion, comoUsuario } from './helpers/pg-qa.mjs';
import { definirPlantillaSistemica } from '../dist/modules/informes/plantilla-sistemica.js';
import { definirPlantillaJudicial } from '../dist/modules/informes/plantilla-judicial.js';
import { InformesModule } from '../dist/modules/informes/informes.module.js';
import { servidor } from './helpers/casos.mjs';

let base;
let db;
let servicio;

const autora = {
  id: PERFILES.t1,
  nombreCompleto: 'Terapeuta ficticia',
  rol: 'terapeuta',
};
const seleccion = {
  sesionesIds: [],
  incluirFamilia: false,
  incluirGenograma: false,
};

const definirPlantilla = (versionPlantilla) => () => ({
  tipo: 'intervencion_sistemica',
  versionPlantilla,
  comprobaciones: [{ campo: 'identificacion', presente: true }],
  generarSecciones: (origen) => [
    { titulo: 'Identificación', contenido: origen.paciente.nombreCompleto },
  ],
});

before(async () => {
  if (opciones.skip) return;

  base = await crearBase('fe153');
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${base.cliente.database}`;

  db = new DatabaseService({ getOrThrow: () => url.toString() });
  servicio = new InformesService(new CasosService(db), db);
});

after(async () => {
  try {
    await db?.onModuleDestroy();
  } finally {
    await base?.cerrar();
  }
});

test('guarda el primer borrador con su autora y los datos de origen', opciones, async () => {
  const nombre = 'Paciente ficticia FE-153';
  const caso = await crearCaso(base.cliente, { nombre, terapeuta: autora.id });

  const version = await servicio.generar(
    caso.id, autora, seleccion, definirPlantilla('fe151-prueba-v1'),
  );

  assert.equal(version.nroVersion, 1);
  assert.equal(version.estado, 'borrador');
  assert.equal(version.creadoPor, autora.id);

  const { rows: [guardada] } = await base.cliente.query(
    `select datos_origen, secciones from informe_versiones where id = $1`,
    [version.id],
  );
  assert.equal(guardada.datos_origen.caso.id, caso.id);
  assert.equal(guardada.datos_origen.paciente.nombreCompleto, nombre);
  assert.deepEqual(guardada.secciones, [
    { titulo: 'Identificación', contenido: nombre },
  ]);
});

test('revierte la cabecera si PostgreSQL rechaza la versión', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });

  await assert.rejects(
    servicio.generar(caso.id, autora, seleccion, definirPlantilla('')),
    { code: '23514' },
  );

  const { rowCount } = await base.cliente.query(
    'select id from informes where caso_id = $1',
    [caso.id],
  );
  assert.equal(rowCount, 0);
});

test('el borrador sistémico incluye solo la sesión seleccionada', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const elegida = await crearSesion(base.cliente, caso.id, {
    evolucion: 'Evolución seleccionada de prueba',
  });
  const omitida = await crearSesion(base.cliente, caso.id, {
    evolucion: 'Evolución fuera de la selección',
  });

  const version = await servicio.generar(
    caso.id,
    autora,
    { ...seleccion, sesionesIds: [elegida.id] },
    definirPlantillaSistemica,
  );

  const { rows: [guardada] } = await base.cliente.query(
    'select datos_origen, secciones from informe_versiones where id = $1',
    [version.id],
  );

  assert.deepEqual(
    guardada.datos_origen.sesiones.map((sesion) => sesion.id),
    [elegida.id],
  );
  assert.notEqual(elegida.id, omitida.id);

  const evolucion = guardada.secciones.find(
    ({ titulo }) => titulo === 'Intervención y evolución',
  );
  assert.match(evolucion.contenido, /Evolución seleccionada de prueba/);
  assert.doesNotMatch(evolucion.contenido, /Evolución fuera de la selección/);

  assert.deepEqual(
    guardada.secciones.find(({ titulo }) => titulo === 'Conclusiones y recomendaciones'),
    {
      titulo: 'Conclusiones y recomendaciones',
      contenido: 'Pendiente de redacción profesional.',
    },
  );
});

async function crearCasoJudicial() {
  const caso = await crearCaso(base.cliente, {
    tipo: 'derivado',
    terapeuta: autora.id,
  });

  await comoUsuario(base.cliente, PERFILES.admin, () =>
    base.cliente.query(
      `insert into contexto_judicial
         (caso_id, juzgado, nro_expediente, fecha_derivacion)
       values ($1, $2, $3, $4)`,
      [caso.id, 'Juzgado ficticio de prueba', 'EXP-QA-001', '2026-10-01'],
    ),
  );

  return caso;
}

test('guarda el informe judicial con el juzgado del caso y el objeto indicado', opciones, async () => {
  const caso = await crearCasoJudicial();
  const objeto = 'Describir el seguimiento registrado en el caso de prueba.';

  const version = await servicio.generar(caso.id, autora, seleccion, (origen) =>
    definirPlantillaJudicial(origen, objeto),
  );

  const { rows: [guardada] } = await base.cliente.query(
    `select i.tipo, v.secciones
       from informe_versiones v
       join informes i on i.id = v.informe_id
      where v.id = $1`,
    [version.id],
  );

  assert.equal(guardada.tipo, 'judicial');
  const secciones = Object.fromEntries(
    guardada.secciones.map(({ titulo, contenido }) => [titulo, contenido]),
  );
  assert.equal(secciones.Destinatario, 'Juzgado ficticio de prueba');
  assert.equal(secciones['Referencia de expediente'], 'EXP-QA-001');
  assert.equal(secciones['Objeto del informe'], objeto);
  assert.equal(secciones.Conclusiones, 'Pendiente de redacción profesional.');
});

test('rechaza el informe judicial sin objeto y no guarda la cabecera', opciones, async () => {
  const caso = await crearCasoJudicial();

  await assert.rejects(
    servicio.generar(caso.id, autora, seleccion, (origen) =>
      definirPlantillaJudicial(origen, '   '),
    ),
    (error) => {
      assert.equal(error.getStatus(), 422);
      assert.deepEqual(error.getResponse().camposFaltantes, ['objeto']);
      return true;
    },
  );

  const { rowCount } = await base.cliente.query(
    'select id from informes where caso_id = $1',
    [caso.id],
  );
  assert.equal(rowCount, 0);
});

test('POST informes: valida el acceso y guarda para la terapeuta asignada', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const api = await servidor(
  {
    query: db.query.bind(db),
    transaction: db.transaction.bind(db),
  },
  { fixture: autora.id, ajena: PERFILES.t2, marketing: PERFILES.marketing },
  [InformesModule],
);

  try {
    const ruta = `/carpetas/${caso.id}/informes`;
    const cuerpo = { tipo: 'intervencion_sistemica' };

    for (const [token, estado] of [[null, 401], ['marketing', 403], ['ajena', 404]]) {
      const respuesta = await api.solicitar(ruta, {
        metodo: 'POST',
        token,
        cuerpo,
      });

      assert.equal(respuesta.status, estado);
      await respuesta.json();
    }

    const { rowCount } = await base.cliente.query(
      'select id from informes where caso_id = $1',
      [caso.id],
    );
    assert.equal(rowCount, 0);

    const respuesta = await api.solicitar(ruta, { metodo: 'POST', cuerpo });
    const version = await respuesta.json();

    assert.equal(respuesta.status, 201, JSON.stringify(version));
    assert.equal(version.estado, 'borrador');
    assert.equal(version.creadoPor, autora.id);
  } finally {
    await api.close();
  }
});

test('guarda la revisión con autoría y conserva los datos de origen', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const borrador = await servicio.generar(
    caso.id,
    autora,
    seleccion,
    definirPlantillaSistemica,
  );

  const consultarVersion = async () => {
    const { rows } = await base.cliente.query(
      'select datos_origen, secciones from informe_versiones where id = $1',
      [borrador.id],
    );
    return rows[0];
  };

  const antes = await consultarVersion();
  const secciones = [
    { titulo: 'Conclusiones', contenido: 'Texto ficticio revisado por la terapeuta.' },
  ];

  const revision = await servicio.revisar(caso.id, borrador.id, autora, secciones);

  assert.equal(revision.estado, 'revisado');
  assert.equal(revision.revisadoPor, autora.id);
  assert.ok(revision.revisadoEn instanceof Date);

  const despues = await consultarVersion();
  assert.deepEqual(despues.datos_origen, antes.datos_origen);
  assert.deepEqual(despues.secciones, secciones);

  await assert.rejects(
    servicio.revisar(caso.id, borrador.id, autora, [
      { titulo: 'Conclusiones', contenido: 'Intento de cambiar la revisión.' },
    ]),
    (error) => error.getStatus() === 409,
  );

  assert.deepEqual(await consultarVersion(), despues);
});

test('PATCH revisión: valida permisos, guarda y rechaza una segunda revisión', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const borrador = await servicio.generar(
    caso.id,
    autora,
    seleccion,
    definirPlantillaSistemica,
  );

  const api = await servidor(
    {
      query: db.query.bind(db),
      transaction: db.transaction.bind(db),
    },
    { fixture: autora.id, ajena: PERFILES.t2 },
    [InformesModule],
  );

  try {
    const rutaVersion = `/carpetas/${caso.id}/informes/${borrador.id}`;
    const ruta = `${rutaVersion}/revision`;
    const cuerpo = {
      secciones: [
        { titulo: 'Conclusiones', contenido: 'Texto ficticio revisado.' },
      ],
    };

    const enviar = (datos, token = 'fixture') =>
      api.solicitar(ruta, { metodo: 'PATCH', token, cuerpo: datos });

    const consulta = await api.solicitar(rutaVersion);
    assert.equal(consulta.status, 200);

    const detalle = await consulta.json();
    assert.equal(detalle.id, borrador.id);
    assert.equal(detalle.estado, 'borrador');
    assert.equal(detalle.creadoPor, autora.id);
    assert.ok(detalle.secciones.some(({ titulo }) => titulo === 'Identificación'));

    const consultaAjena = await api.solicitar(rutaVersion, { token: 'ajena' });
    assert.equal(consultaAjena.status, 404);
    await consultaAjena.json();

    const invalida = await enviar({ secciones: [] });
    assert.equal(invalida.status, 400);
    await invalida.json();

    const denegada = await enviar(cuerpo, 'ajena');
    assert.equal(denegada.status, 404);
    await denegada.json();

    const respuesta = await enviar(cuerpo);
    const revision = await respuesta.json();

    assert.equal(respuesta.status, 200, JSON.stringify(revision));
    assert.equal(revision.id, borrador.id);
    assert.equal(revision.estado, 'revisado');
    assert.equal(revision.revisadoPor, autora.id);
    assert.ok(Number.isFinite(Date.parse(revision.revisadoEn)));
    const consultaRevisada = await api.solicitar(rutaVersion);
    assert.equal(consultaRevisada.status, 200);

    const detalleRevisado = await consultaRevisada.json();
    assert.equal(detalleRevisado.estado, 'revisado');
    assert.deepEqual(detalleRevisado.secciones, cuerpo.secciones);
    const repetida = await enviar(cuerpo);
    assert.equal(repetida.status, 409);
    await repetida.json();
  } finally {
    await api.close();
  }
});
test('GET informes: lista las versiones del caso para la terapeuta asignada', opciones, async () => {
  const caso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const otroCaso = await crearCaso(base.cliente, { terapeuta: autora.id });
  const primero = await servicio.generar(caso.id, autora, seleccion, definirPlantillaSistemica);
  const segundo = await servicio.generar(caso.id, autora, seleccion, definirPlantillaSistemica);
  await servicio.generar(otroCaso.id, autora, seleccion, definirPlantillaSistemica);
  await servicio.revisar(caso.id, primero.id, autora, [{ titulo: 'Conclusiones', contenido: 'Texto ficticio.' }]);

  const api = await servidor(
    { query: db.query.bind(db), transaction: db.transaction.bind(db) },
    { fixture: autora.id, ajena: PERFILES.t2 },
    [InformesModule],
  );

  try {
    const ruta = `/carpetas/${caso.id}/informes`;
    const respuesta = await api.solicitar(ruta);
    const cuerpo = await respuesta.json();
    assert.equal(respuesta.status, 200, JSON.stringify(cuerpo));
    assert.equal(respuesta.headers.get('cache-control'), 'private, no-store');

    // Solo los del caso, el más reciente primero; cada generación es un informe propio.
    assert.deepEqual(cuerpo.informes.map((i) => i.id), [segundo.id, primero.id]);
    assert.notEqual(cuerpo.informes[0].informeId, cuerpo.informes[1].informeId);
    assert.deepEqual(cuerpo.informes.map((i) => i.estado), ['borrador', 'revisado']);
    const revisado = cuerpo.informes[1];
    assert.equal(revisado.tipo, 'intervencion_sistemica');
    assert.equal(revisado.nroVersion, 1);
    assert.equal(revisado.creadoPor, autora.id);
    assert.equal(revisado.revisadoPor, autora.id);
    assert.ok(Number.isFinite(Date.parse(revisado.revisadoEn)));
    assert.equal(revisado.secciones, undefined);

    const ajena = await api.solicitar(ruta, { token: 'ajena' });
    assert.equal(ajena.status, 404);
    await ajena.json();

    const vacio = await crearCaso(base.cliente, { terapeuta: autora.id });
    const sinInformes = await api.solicitar(`/carpetas/${vacio.id}/informes`);
    assert.deepEqual(await sinInformes.json(), { informes: [] });
  } finally {
    await api.close();
  }
});

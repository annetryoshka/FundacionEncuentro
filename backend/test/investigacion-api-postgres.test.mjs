import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { InvestigacionModule } from '../dist/modules/investigacion/investigacion.module.js';
import { servidor } from './helpers/casos.mjs';
import {
  comoUsuario,
  crearBase,
  crearCaso,
  crearSesion,
  opciones,
  PERFILES,
} from './helpers/pg-qa.mjs';
import JSZip from 'jszip';

test('FE-169: selección y conteos respetan el alcance del perfil', opciones, async (t) => {
  const base = await crearBase('fe169');
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

  const a = await crearCaso(base.cliente, { terapeuta: PERFILES.t1 });
  const b = await crearCaso(base.cliente, { terapeuta: PERFILES.t2 });

  const categoria = await comoUsuario(base.cliente, PERFILES.admin, async () => {
    const { rows: [creada] } = await base.cliente.query(
      `insert into categorias_investigacion (codigo, nombre)
       values ('QA-CAT-01', 'Categoría ficticia QA') returning id`,
    );
    await base.cliente.query(
      `insert into caso_categorias (caso_id, categoria_id)
       values ($1, $3), ($2, $3)`,
      [a.id, b.id, creada.id],
    );
    return creada;
  });

  api = await servidor(db, {
    fixture: PERFILES.admin,
    terapeuta: PERFILES.t1,
    marketing: PERFILES.marketing,
    otraTerapeuta: PERFILES.t2,
  }, [InvestigacionModule]);

  const seleccion = `/investigacion/seleccion?categorias=${categoria.id}`;

  const admin = await api.solicitar(seleccion);
  assert.equal(admin.status, 200);
  assert.deepEqual(
    new Set((await admin.json()).casos.map(({ casoId }) => casoId)),
    new Set([a.id, b.id]),
  );

  const terapeuta = await api.solicitar(seleccion, { token: 'terapeuta' });
  assert.equal(terapeuta.status, 200);
  assert.deepEqual((await terapeuta.json()).casos.map(({ casoId }) => casoId), [a.id]);

  const catalogo = await api.solicitar('/investigacion/categorias', { token: 'terapeuta' });
  assert.equal(catalogo.status, 200);
  const { categorias } = await catalogo.json();
  assert.equal(categorias.find(({ id }) => id === categoria.id).casos, 1);

  const denegada = await api.solicitar(seleccion, { token: 'marketing' });
  assert.equal(denegada.status, 403);
  await denegada.json();

    const propia = await crearSesion(base.cliente, a.id, {
    responsable: PERFILES.t1,
  });
  const ajena = await crearSesion(base.cliente, b.id, {
    responsable: PERFILES.t2,
  });

  const asignar = (casoId, fichaSeguimientoId) =>
    api.solicitar(`/investigacion/casos/${casoId}/etiquetas`, {
      metodo: 'POST',
      token: 'terapeuta',
      cuerpo: { categoriaId: categoria.id, fichaSeguimientoId },
    });

  const casoAjeno = await asignar(b.id, ajena.id);
  assert.equal(casoAjeno.status, 404, await casoAjeno.text());

  const sesionCruzada = await asignar(a.id, ajena.id);
  assert.equal(sesionCruzada.status, 400, await sesionCruzada.text());

  const respuestaEtiqueta = await asignar(a.id, propia.id);
  const etiqueta = await respuestaEtiqueta.json();
  assert.equal(respuestaEtiqueta.status, 201, JSON.stringify(etiqueta));
  assert.equal(etiqueta.casoId, a.id);
  assert.equal(etiqueta.fichaSeguimientoId, propia.id);
  assert.equal(etiqueta.etiquetadoPor, PERFILES.t1);

  const repetida = await asignar(a.id, propia.id);
  assert.equal(repetida.status, 409, await repetida.text());

    const preparar = (casosIds) =>
    api.solicitar('/investigacion/exportaciones', {
      metodo: 'POST',
      token: 'terapeuta',
      cuerpo: { casosIds, secciones: ['seguimiento'], formato: 'txt' },
    });

  const mezclada = await preparar([a.id, b.id]);
  assert.equal(mezclada.status, 404, await mezclada.text());

  const { rowCount } = await base.cliente.query(
    `select id from exportaciones where tipo = 'atlas_ti'`,
  );
  assert.equal(rowCount, 0);

  const preparada = await preparar([a.id]);
  const paquete = await preparada.json();
  assert.equal(preparada.status, 201, JSON.stringify(paquete));

  const rutaPaquete = `/investigacion/exportaciones/${paquete.exportacionId}`;

  const respuestaManifiesto = await api.solicitar(`${rutaPaquete}/manifiesto`, {
    token: 'terapeuta',
  });
  assert.equal(respuestaManifiesto.status, 200);
  const manifiesto = await respuestaManifiesto.json();
  assert.equal(manifiesto.documentos.length, 1);
  assert.equal(manifiesto.documentos[0].archivo, 'INV-001.txt');
  assert.equal(JSON.stringify(manifiesto).includes(a.id), false);

  const vistaPrevia = await api.solicitar(`${rutaPaquete}/documentos/INV-001`, {
    token: 'terapeuta',
  });
  assert.equal(vistaPrevia.status, 200);
  const documento = await vistaPrevia.json();
  assert.equal(documento.idExportacion, 'INV-001');
  assert.equal(documento.seguimiento.length, 1);

  const vistaAjena = await api.solicitar(`${rutaPaquete}/manifiesto`, {
    token: 'otraTerapeuta',
  });
  assert.equal(vistaAjena.status, 404, await vistaAjena.text());

    const rutaRevision = `${rutaPaquete}/revision`;
  const consultarRevision = async () => {
    const respuesta = await api.solicitar(rutaRevision, { token: 'terapeuta' });
    const cuerpo = await respuesta.json();
    assert.equal(respuesta.status, 200, JSON.stringify(cuerpo));
    return cuerpo;
  };

  const confirmar = (huella) =>
    api.solicitar(rutaRevision, {
      metodo: 'PATCH',
      token: 'terapeuta',
      cuerpo: { huella },
    });

  const anterior = await consultarRevision();
  assert.match(anterior.huella, /^[0-9a-f]{64}$/);
  assert.equal(anterior.documentos[0].idExportacion, 'INV-001');

  await comoUsuario(base.cliente, PERFILES.t1, () =>
    base.cliente.query(
      'update fichas_seguimiento set evolucion = $2 where id = $1',
      [propia.id, 'Evolución ficticia editada después de la vista previa'],
    ),
  );

  const desactualizada = await confirmar(anterior.huella);
  assert.equal(desactualizada.status, 409, await desactualizada.text());

  const { rows: [pendiente] } = await base.cliente.query(
    `select revisado_en, huella_revision_investigacion
       from exportaciones where id = $1`,
    [paquete.exportacionId],
  );
  assert.equal(pendiente.revisado_en, null);
  assert.equal(pendiente.huella_revision_investigacion, null);

  const actual = await consultarRevision();
  assert.notEqual(actual.huella, anterior.huella);

  const aprobada = await confirmar(actual.huella);
  const revision = await aprobada.json();
  assert.equal(aprobada.status, 200, JSON.stringify(revision));
  assert.ok(Number.isFinite(Date.parse(revision.revisadoEn)));

  const { rows: [guardada] } = await base.cliente.query(
    `select revisado_por, huella_revision_investigacion
       from exportaciones where id = $1`,
    [paquete.exportacionId],
  );
  assert.equal(guardada.revisado_por, PERFILES.t1);
  assert.equal(guardada.huella_revision_investigacion, actual.huella);

    const rutaDescarga = `${rutaPaquete}/descarga`;
  const descargar = () => api.solicitar(rutaDescarga, { token: 'terapeuta' });

  const respuestaZip = await descargar();
  assert.equal(respuestaZip.status, 200);
  assert.equal(respuestaZip.headers.get('content-type'), 'application/zip');

  const zip = await JSZip.loadAsync(await respuestaZip.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), [
    'INV-001.txt', 'manifiesto.json',
  ]);

  const manifiestoZip = JSON.parse(await zip.file('manifiesto.json').async('string'));
  assert.deepEqual(manifiestoZip, actual.manifiesto);

  const texto = await zip.file('INV-001.txt').async('string');
  assert.match(texto, /Evolución ficticia editada después de la vista previa/);

  await comoUsuario(base.cliente, PERFILES.t1, () =>
    base.cliente.query(
      'update fichas_seguimiento set evolucion = $2 where id = $1',
      [propia.id, 'Texto ficticio cambiado después de aprobar'],
    ),
  );

  const modificada = await descargar();
  assert.equal(modificada.status, 409, await modificada.text());
  assert.equal(modificada.headers.get('content-disposition'), null);

    const rutaCategorias = '/investigacion/categorias';
  const nuevaCategoria = { codigo: 'QA-CAT-02', nombre: 'Categoría ficticia nueva' };

  const sinPermiso = await api.solicitar(rutaCategorias, {
    metodo: 'POST', token: 'terapeuta', cuerpo: nuevaCategoria,
  });
  assert.equal(sinPermiso.status, 403, await sinPermiso.text());

  const respuestaCategoria = await api.solicitar(rutaCategorias, {
    metodo: 'POST', cuerpo: nuevaCategoria,
  });
  const categoriaAdmin = await respuestaCategoria.json();
  assert.equal(respuestaCategoria.status, 201, JSON.stringify(categoriaAdmin));

  const retirada = await api.solicitar(`${rutaCategorias}/${categoriaAdmin.id}`, {
    metodo: 'PUT',
    cuerpo: { nombre: categoriaAdmin.nombre, activa: false },
  });
  const categoriaRetirada = await retirada.json();
  assert.equal(retirada.status, 200, JSON.stringify(categoriaRetirada));
  assert.equal(categoriaRetirada.codigo, nuevaCategoria.codigo);
  assert.equal(categoriaRetirada.activa, false);

  const noEtiquetable = await api.solicitar(`/investigacion/casos/${a.id}/etiquetas`, {
    metodo: 'POST', token: 'terapeuta', cuerpo: { categoriaId: categoriaAdmin.id },
  });
  assert.equal(noEtiquetable.status, 400, await noEtiquetable.text());

  const prepararWord = await api.solicitar('/investigacion/exportaciones', {
    metodo: 'POST',
    token: 'terapeuta',
    cuerpo: { casosIds: [a.id], secciones: ['seguimiento'], formato: 'docx' },
  });
  const paqueteWord = await prepararWord.json();
  assert.equal(prepararWord.status, 201, JSON.stringify(paqueteWord));

  const rutaWord = `/investigacion/exportaciones/${paqueteWord.exportacionId}`;
  const sinRevision = await api.solicitar(`${rutaWord}/descarga`, { token: 'terapeuta' });
  assert.equal(sinRevision.status, 409, await sinRevision.text());

  const vistaWord = await api.solicitar(`${rutaWord}/revision`, { token: 'terapeuta' });
  assert.equal(vistaWord.status, 200);
  const { huella } = await vistaWord.json();

  const revisarWord = await api.solicitar(`${rutaWord}/revision`, {
    metodo: 'PATCH', token: 'terapeuta', cuerpo: { huella },
  });
  assert.equal(revisarWord.status, 200, await revisarWord.text());

  const descargaWord = await api.solicitar(`${rutaWord}/descarga`, { token: 'terapeuta' });
  assert.equal(descargaWord.status, 200);

  const zipWord = await JSZip.loadAsync(await descargaWord.arrayBuffer());
  const archivoWord = await zipWord.file('INV-001.docx').async('nodebuffer');
  const docx = await JSZip.loadAsync(archivoWord);
  const documentoXml = await docx.file('word/document.xml').async('string');
  assert.match(documentoXml, /Texto ficticio cambiado después de aprobar/);
});
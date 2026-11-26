import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseService } from '../dist/database/database.service.js';
import { AuthModule } from '../dist/modules/auth/auth.module.js';
import { DifusionModule } from '../dist/modules/difusion/difusion.module.js';
import { comoUsuario, crearBase, opciones, PERFILES } from './helpers/pg-qa.mjs';

test('FE-143: la consulta pública solo devuelve publicaciones publicadas', opciones, async (t) => {
  const base = await crearBase('fe143');
  let app;
  let db;

  t.after(async () => {
    try {
      if (app) await app.close();
      else await db?.onModuleDestroy();
    } finally {
      await base.cerrar();
    }
  });

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${base.cliente.database}`;
  db = new DatabaseService({ getOrThrow: () => url.toString() });

  class Infraestructura {}
  Global()(Infraestructura);
  Module({
    providers: [
      { provide: DatabaseService, useValue: db },
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (clave) => ({
            SUPABASE_URL: 'https://auth.invalid',
            SUPABASE_ANON_KEY: 'clave-ficticia',
          })[clave],
        },
      },
    ],
    exports: [DatabaseService, ConfigService],
  })(Infraestructura);

  class AppPrueba {}
  Module({ imports: [Infraestructura, AuthModule, DifusionModule] })(AppPrueba);

  app = await NestFactory.create(AppPrueba, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(0, '127.0.0.1');

  const ruta = `${await app.getUrl()}/api/publico/publicaciones`;

  const { publicada, borrador, retirada } = await comoUsuario(
    base.cliente,
    PERFILES.marketing,
    async () => {
      const crear = async (titulo) => (await base.cliente.query(
        `insert into publicaciones_difusion (tipo, titulo, resumen)
         values ('actividad', $1, 'Resumen ficticio QA')
         returning id`,
        [titulo],
      )).rows[0].id;

      const publicada = await crear('Actividad publicada QA');
      const borrador = await crear('Borrador QA');
      const retirada = await crear('Actividad retirada QA');

      await base.cliente.query(
        `update publicaciones_difusion set estado = 'publicado'
          where id = any($1::uuid[])`,
        [[publicada, retirada]],
      );
      await base.cliente.query(
        `update publicaciones_difusion set estado = 'retirado' where id = $1`,
        [retirada],
      );

      return { publicada, borrador, retirada };
    },
  );

  const listado = await fetch(`${ruta}?tipo=actividad&tamano=1`);
  const pagina = await listado.json();
  assert.equal(listado.status, 200, JSON.stringify(pagina));
  assert.equal(pagina.total, 1);
  assert.deepEqual(pagina.publicaciones.map(({ id }) => id), [publicada]);

  const detalle = await fetch(`${ruta}/${publicada}`);
  assert.equal(detalle.status, 200);
  const ficha = await detalle.json();
  assert.equal(ficha.titulo, 'Actividad publicada QA');
  assert.equal(Object.hasOwn(ficha, 'creadoPor'), false);
  assert.equal(Object.hasOwn(ficha, 'estado'), false);

  for (const id of [borrador, retirada]) {
    const oculta = await fetch(`${ruta}/${id}`);
    assert.equal(oculta.status, 404);
    await oculta.json();
  }

  const filtroProhibido = await fetch(`${ruta}?estado=borrador`);
  assert.equal(filtroProhibido.status, 400);
  await filtroProhibido.json();

    const fetchReal = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url) !== 'https://auth.invalid/auth/v1/user') {
      return fetchReal(url, init);
    }

    const token = new Headers(init?.headers).get('authorization');
    const id = {
      'Bearer marketing-qa': PERFILES.marketing,
      'Bearer terapeuta-qa': PERFILES.t1,
    }[token];

    return Response.json(id ? { id } : {}, { status: id ? 200 : 401 });
  });

  const rutaAdmin = `${await app.getUrl()}/api/difusion/publicaciones`;
  const escribir = (url, method, token, cuerpo) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });

  const datosPublicacion = {
    tipo: 'actividad',
    titulo: 'Borrador de marketing QA',
    resumen: 'Resumen ficticio',
  };

  const denegada = await escribir(rutaAdmin, 'POST', 'terapeuta-qa', datosPublicacion);
  const detalleDenegada = await denegada.text();
  assert.equal(denegada.status, 403, detalleDenegada);

  const respuesta = await escribir(rutaAdmin, 'POST', 'marketing-qa', datosPublicacion);
  const creada = await respuesta.json();
  assert.equal(respuesta.status, 201, JSON.stringify(creada));
  assert.equal(creada.estado, 'borrador');
  assert.equal(creada.creadoPor, PERFILES.marketing);

  const edicion = await escribir(`${rutaAdmin}/${creada.id}`, 'PUT', 'marketing-qa', {
    ...datosPublicacion,
    titulo: 'Borrador editado QA',
  });
  const editada = await edicion.json();
  assert.equal(edicion.status, 200, JSON.stringify(editada));
  assert.equal(editada.titulo, 'Borrador editado QA');
  assert.equal(editada.estado, 'borrador');

  const aunPrivada = await fetch(`${ruta}/${creada.id}`);
  assert.equal(aunPrivada.status, 404);
  await aunPrivada.json();

    const listarBorradores = await fetch(`${rutaAdmin}?estado=borrador`, {
    headers: { Authorization: 'Bearer marketing-qa' },
  });
  assert.equal(listarBorradores.status, 200);
  const bandeja = await listarBorradores.json();
  assert.ok(bandeja.publicaciones.some(({ id }) => id === creada.id));
  assert.ok(bandeja.publicaciones.every(({ estado }) => estado === 'borrador'));

  const reabrir = await fetch(`${rutaAdmin}/${creada.id}`, {
    headers: { Authorization: 'Bearer marketing-qa' },
  });
  assert.equal(reabrir.status, 200);
  assert.equal((await reabrir.json()).titulo, 'Borrador editado QA');

  const cambiarEstado = (id, estado) =>
    escribir(`${rutaAdmin}/${id}/estado`, 'PATCH', 'marketing-qa', { estado });

  const incompleta = await escribir(rutaAdmin, 'POST', 'marketing-qa', {
    tipo: 'actividad',
    titulo: 'Borrador sin resumen QA',
  });
  assert.equal(incompleta.status, 201);
  const { id: idIncompleta } = await incompleta.json();

  const incompletaRechazada = await cambiarEstado(idIncompleta, 'publicado');
  assert.equal(incompletaRechazada.status, 422);
  assert.deepEqual((await incompletaRechazada.json()).camposFaltantes, ['resumen']);

  const publicar = await cambiarEstado(creada.id, 'publicado');
  assert.equal(publicar.status, 200);
  assert.equal((await publicar.json()).estado, 'publicado');

  const visible = await fetch(`${ruta}/${creada.id}`);
  assert.equal(visible.status, 200);
  assert.equal((await visible.json()).titulo, 'Borrador editado QA');

  const repetir = await cambiarEstado(creada.id, 'publicado');
  assert.equal(repetir.status, 409);
  await repetir.json();

  const retirar = await cambiarEstado(creada.id, 'retirado');
  assert.equal(retirar.status, 200);
  assert.equal((await retirar.json()).estado, 'retirado');

  const ocultaTrasRetiro = await fetch(`${ruta}/${creada.id}`);
  assert.equal(ocultaTrasRetiro.status, 404);
  await ocultaTrasRetiro.json();

  const volverABorrador = await cambiarEstado(creada.id, 'borrador');
  assert.equal(volverABorrador.status, 200);
  await volverABorrador.json();

  const rutaRecursos = `${rutaAdmin}/${creada.id}/recursos`;
  const imagen = {
    ruta: 'qa/actividad.png',
    tipoMime: 'image/png',
    tamanoBytes: 100,
    textoAlternativo: 'Imagen ficticia de una actividad',
    principal: true,
  };

  const invalida = await escribir(rutaRecursos, 'POST', 'marketing-qa', {
    ...imagen,
    ruta: '../actividad.png',
  });
  const errorImagen = await invalida.json();
  assert.equal(invalida.status, 400, JSON.stringify(errorImagen));

  const trasError = await fetch(`${rutaAdmin}/${creada.id}`, {
    headers: { Authorization: 'Bearer marketing-qa' },
  });
  assert.equal(trasError.status, 200);
  const conservada = await trasError.json();
  assert.equal(conservada.titulo, 'Borrador editado QA');
  assert.deepEqual(conservada.recursos, []);

  const adjunta = await escribir(rutaRecursos, 'POST', 'marketing-qa', imagen);
  const recurso = await adjunta.json();
  assert.equal(adjunta.status, 201, JSON.stringify(recurso));
  assert.equal(recurso.principal, true);

  const duplicada = await escribir(rutaRecursos, 'POST', 'marketing-qa', {
    ...imagen,
    ruta: 'qa/segunda.png',
  });
  assert.equal(duplicada.status, 409);
  await duplicada.json();

  const republicada = await cambiarEstado(creada.id, 'publicado');
  assert.equal(republicada.status, 200);
  await republicada.json();

  const publicaConImagen = await fetch(`${ruta}/${creada.id}`);
  assert.equal(publicaConImagen.status, 200);
  const detalleConImagen = await publicaConImagen.json();
  assert.equal(detalleConImagen.imagen.ruta, imagen.ruta);
  assert.equal(detalleConImagen.imagen.textoAlternativo, imagen.textoAlternativo);

  const quitar = (publicacionId) => fetch(
    `${rutaAdmin}/${publicacionId}/recursos/${recurso.id}`,
    { method: 'DELETE', headers: { Authorization: 'Bearer marketing-qa' } },
  );

  const recursoAjeno = await quitar(publicada);
  assert.equal(recursoAjeno.status, 404);
  await recursoAjeno.json();

  const eliminada = await quitar(creada.id);
  assert.equal(eliminada.status, 204);

  const publicaSinImagen = await fetch(`${ruta}/${creada.id}`);
  assert.equal(publicaSinImagen.status, 200);
  assert.equal((await publicaSinImagen.json()).imagen, null);
});
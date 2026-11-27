import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createCanvas } from '@napi-rs/canvas';
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

  // El portal público solo permite lectura: subir o quitar la imagen usa
  // las rutas autenticadas de administración/marketing.
  for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
    const escrituraPublica = await fetch(`${ruta}/${publicada}/imagen`, { method: metodo });
    assert.equal(escrituraPublica.status, 404, await escrituraPublica.text());
  }

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

  // 024: la imagen se sube como archivo (multipart) y el backend la guarda en la base.
  const rutaImagenes = `${await app.getUrl()}/api/publico/imagenes`;
  const subir = (id, archivo, textoAlternativo, token = 'marketing-qa') => {
    const formulario = new FormData();
    if (archivo) formulario.append('archivo', new Blob([archivo.datos], { type: archivo.tipo }), archivo.nombre);
    if (textoAlternativo !== undefined) formulario.append('textoAlternativo', textoAlternativo);
    return fetch(`${rutaAdmin}/${id}/imagen`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formulario,
    });
  };
  const foto = { datos: dibujar(2400, 1200, 'jpeg'), tipo: 'image/jpeg', nombre: 'foto del celular.jpg' };

  const noEsImagen = await subir(creada.id, { datos: Buffer.from('%PDF-1.7\n'), tipo: 'image/jpeg', nombre: 'a.jpg' }, 'Texto');
  assert.equal(noEsImagen.status, 415, await noEsImagen.text());
  const sinTexto = await subir(creada.id, foto, '   ');
  assert.equal(sinTexto.status, 400, await sinTexto.text());
  const sinArchivo = await subir(creada.id, null, 'Texto');
  assert.equal(sinArchivo.status, 400, await sinArchivo.text());
  const terapeuta = await subir(creada.id, foto, 'Texto', 'terapeuta-qa');
  assert.equal(terapeuta.status, 403, await terapeuta.text());
  const inexistente = await subir('00000000-0000-4000-8000-000000000099', foto, 'Texto');
  assert.equal(inexistente.status, 404, await inexistente.text());

  const trasError = await fetch(`${rutaAdmin}/${creada.id}`, {
    headers: { Authorization: 'Bearer marketing-qa' },
  });
  assert.equal(trasError.status, 200);
  const conservada = await trasError.json();
  assert.equal(conservada.titulo, 'Borrador editado QA');
  assert.equal(conservada.imagen, null);

  const adjunta = await subir(creada.id, foto, ' Imagen ficticia de una actividad ');
  const imagen = await adjunta.json();
  assert.equal(adjunta.status, 200, JSON.stringify(imagen));
  assert.equal(imagen.textoAlternativo, 'Imagen ficticia de una actividad');
  assert.deepEqual([imagen.ancho, imagen.alto], [1600, 800]);
  assert.ok(imagen.tamanoBytes > 0);

  // En borrador el público no la ve; gestión sí, para la vista previa.
  const borradorPublico = await fetch(`${rutaImagenes}/${imagen.id}`);
  assert.equal(borradorPublico.status, 404);
  await borradorPublico.json();
  const vistaPrevia = await fetch(`${rutaAdmin}/${creada.id}/imagen/archivo`, {
    headers: { Authorization: 'Bearer marketing-qa' },
  });
  assert.equal(vistaPrevia.status, 200);
  assert.equal(vistaPrevia.headers.get('content-type'), 'image/webp');
  assert.equal(vistaPrevia.headers.get('cache-control'), 'private, no-store');
  assert.equal(Buffer.from(await vistaPrevia.arrayBuffer()).toString('latin1', 8, 12), 'WEBP');
  const vistaSinSesion = await fetch(`${rutaAdmin}/${creada.id}/imagen/archivo`);
  assert.equal(vistaSinSesion.status, 401);
  await vistaSinSesion.json();

  const republicada = await cambiarEstado(creada.id, 'publicado');
  assert.equal(republicada.status, 200);
  await republicada.json();

  const publicaConImagen = await fetch(`${ruta}/${creada.id}`);
  assert.equal(publicaConImagen.status, 200);
  const detalleConImagen = await publicaConImagen.json();
  assert.deepEqual(detalleConImagen.imagen, {
    id: imagen.id, textoAlternativo: 'Imagen ficticia de una actividad', ancho: 1600, alto: 800,
  });

  const servida = await fetch(`${rutaImagenes}/${imagen.id}`);
  assert.equal(servida.status, 200);
  assert.equal(servida.headers.get('content-type'), 'image/webp');
  assert.equal(servida.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(servida.headers.get('x-content-type-options'), 'nosniff');
  assert.match(servida.headers.get('cache-control'), /^public/);
  const bytes = Buffer.from(await servida.arrayBuffer());
  assert.equal(bytes.length, imagen.tamanoBytes);
  const etiqueta = servida.headers.get('etag');
  const enCache = await fetch(`${rutaImagenes}/${imagen.id}`, { headers: { 'If-None-Match': etiqueta } });
  assert.equal(enCache.status, 304);

  // Reemplazar: la imagen anterior deja de servirse.
  const reemplazo = await subir(creada.id, { datos: dibujar(800, 600, 'png'), tipo: 'image/png', nombre: 'afiche.png' }, 'Afiche ficticio');
  const nueva = await reemplazo.json();
  assert.equal(reemplazo.status, 200, JSON.stringify(nueva));
  assert.notEqual(nueva.id, imagen.id);
  assert.deepEqual([nueva.ancho, nueva.alto], [800, 600]);
  assert.equal((await fetch(`${rutaImagenes}/${imagen.id}`)).status, 404);
  assert.equal((await fetch(`${rutaImagenes}/${nueva.id}`)).status, 200);

  const nuevoTexto = await escribir(`${rutaAdmin}/${creada.id}/imagen`, 'PATCH', 'marketing-qa', {
    textoAlternativo: 'Afiche ficticio de la actividad',
  });
  assert.equal(nuevoTexto.status, 200);
  assert.equal((await nuevoTexto.json()).textoAlternativo, 'Afiche ficticio de la actividad');

  const quitar = (publicacionId) => fetch(
    `${rutaAdmin}/${publicacionId}/imagen`,
    { method: 'DELETE', headers: { Authorization: 'Bearer marketing-qa' } },
  );

  const sinImagen = await quitar(publicada);
  assert.equal(sinImagen.status, 404);
  await sinImagen.json();

  const eliminada = await quitar(creada.id);
  assert.equal(eliminada.status, 204);
  assert.equal((await fetch(`${rutaImagenes}/${nueva.id}`)).status, 404);

  const publicaSinImagen = await fetch(`${ruta}/${creada.id}`);
  assert.equal(publicaSinImagen.status, 200);
  assert.equal((await publicaSinImagen.json()).imagen, null);
  const { rows: [{ n }] } = await base.cliente.query('select count(*)::int as n from imagenes_publicas');
  assert.equal(n, 0);
});

/** Mitad roja y mitad azul, en el formato pedido. */
function dibujar(ancho, alto, formato) {
  const lienzo = createCanvas(ancho, alto);
  const c = lienzo.getContext('2d');
  c.fillStyle = '#c0392b';
  c.fillRect(0, 0, ancho / 2, alto);
  c.fillStyle = '#2c3e50';
  c.fillRect(ancho / 2, 0, ancho / 2, alto);
  return formato === 'png' ? lienzo.encodeSync('png') : lienzo.encodeSync('jpeg', 90);
}

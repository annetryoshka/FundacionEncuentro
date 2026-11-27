import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GenogramaAccesoService } from '../dist/modules/casos/genograma/genograma-acceso.service.js';
import {
  GENOGRAMA_ARCHIVOS,
  GenogramaDescargaService,
} from '../dist/modules/casos/genograma/genograma-descarga.service.js';
import {
  GENOGRAMA_ESCRITURA,
  GenogramaReemplazoService,
} from '../dist/modules/casos/genograma/genograma-reemplazo.service.js';
import { GenogramaController } from '../dist/modules/casos/genograma/genograma.controller.js';

test('carga, consulta y descarga por HTTP con almacenamiento en memoria', async (t) => {
  const casoId = '00000000-0000-4000-8000-000000000001';
  const terapeuta = {
    id: '00000000-0000-4000-8000-000000000002',
    nombreCompleto: 'Terapeuta de prueba',
    rol: 'terapeuta',
  };
  const ajena = {
    ...terapeuta,
    id: '00000000-0000-4000-8000-000000000003',
  };
  const archivos = new Map();
  let vigente = null;

  class AppPrueba {}
  Module({
    controllers: [GenogramaController],
    providers: [
      GenogramaDescargaService,
      GenogramaReemplazoService,
      {
        provide: GenogramaAccesoService,
        useValue: {
          async verificar(id, usuario) {
            if (id !== casoId || usuario.id !== terapeuta.id) {
              throw new NotFoundException('Caso no encontrado');
            }
          },
        },
      },
      {
        provide: GENOGRAMA_ARCHIVOS,
        useValue: {
          buscarVigente: async () => vigente,
          leer: async (clave) => archivos.get(clave),
        },
      },
      {
        provide: GENOGRAMA_ESCRITURA,
        useValue: {
          async guardarNuevo(clave, contenido) {
            archivos.set(clave, contenido);
          },
          async activarVersion(_id, usuario, version) {
            vigente = {
              ...version,
              autorId: usuario.id,
              actualizadoEn: '2026-11-24T00:00:00.000Z',
            };
          },
        },
      },
    ],
  })(AppPrueba);

  const app = await NestFactory.create(AppPrueba, { logger: false, abortOnError: false });
  t.after(() => app.close());
  app.setGlobalPrefix('api');
  app.use((req, _res, next) => {
    req.usuario = req.headers['x-usuario-prueba'] === 'ajena' ? ajena : terapeuta;
    next();
  });

  await app.listen(0, '127.0.0.1');
  const ruta = `${await app.getUrl()}/api/carpetas/${casoId}/genograma`;

  function cargar(nombre, tipo, contenido) {
    const body = new FormData();
    body.set('archivo', new Blob([contenido], { type: tipo }), nombre);
    return fetch(ruta, { method: 'PUT', body });
  }

  const pdf = Buffer.from('%PDF-1.7\nContenido ficticio');
  const carga = await cargar('genograma.pdf', 'application/pdf', pdf);
  assert.equal(carga.status, 204);

  const consulta = await fetch(ruta);
  assert.equal(consulta.status, 200);
  assert.deepEqual(await consulta.json(), {
    nombre: 'genograma.pdf',
    tipo: 'application/pdf',
    tamanio: pdf.length,
    autorId: terapeuta.id,
    actualizadoEn: '2026-11-24T00:00:00.000Z',
  });

  const reemplazo = await cargar('falso.pdf', 'application/pdf', 'Hola');
  assert.equal(reemplazo.status, 415);
  await reemplazo.json();

  const descarga = await fetch(`${ruta}/archivo`);
  assert.equal(descarga.status, 200);
  assert.equal(descarga.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), pdf);

  const denegada = await fetch(`${ruta}/archivo`, {
    headers: { 'x-usuario-prueba': 'ajena' },
  });
  assert.equal(denegada.status, 404);
  await denegada.json();
});
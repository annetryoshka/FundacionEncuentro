import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../../common/types/usuario.js';
import type { DatabaseService } from '../../../database/database.service.js';
import { GenogramaAccesoService } from '../genograma/genograma-acceso.service.js';
import { GenogramaDescargaService } from '../genograma/genograma-descarga.service.js';

describe('GenogramaDescargaService', () => {
  const casoId = '00000000-0000-4000-8000-000000000001';
  const terapeuta = {
    id: '00000000-0000-4000-8000-000000000002',
    rol: 'terapeuta',
  } as Usuario;

  const genograma = {
    clave: 'privado/genograma-1',
    nombre: 'genograma.pdf',
    tipo: 'application/pdf',
    tamanio: Buffer.byteLength('Contenido ficticio'),
    autorId: terapeuta.id,
    actualizadoEn: '2026-11-24T00:00:00.000Z',
  };
  const contenido = Buffer.from('Contenido ficticio');

  function preparar(tieneAcceso: boolean, vigente = true) {
    const query = vi.fn().mockResolvedValue({
      rows: tieneAcceso ? [{ id: casoId }] : [],
    });
    const acceso = new GenogramaAccesoService({
      query,
    } as unknown as DatabaseService);
    const archivos = {
      buscarVigente: vi.fn().mockResolvedValue(vigente ? genograma : null),
      leer: vi.fn().mockResolvedValue(contenido),
    };

    return {
      servicio: new GenogramaDescargaService(acceso, archivos),
      archivos,
    };
  }

  it('devuelve el archivo del caso accesible', async () => {
    const { servicio, archivos } = preparar(true);

    await expect(servicio.descargar(casoId, terapeuta)).resolves.toEqual({
      nombre: genograma.nombre,
      tipo: genograma.tipo,
      contenido,
    });

    expect(archivos.buscarVigente).toHaveBeenCalledWith(casoId);
    expect(archivos.leer).toHaveBeenCalledWith(genograma.clave);
  });

  it('devuelve 404 antes de consultar archivos si la terapeuta no tiene acceso', async () => {
    const { servicio, archivos } = preparar(false);

    await expect(servicio.descargar(casoId, terapeuta)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(archivos.buscarVigente).not.toHaveBeenCalled();
    expect(archivos.leer).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el caso accesible todavía no tiene genograma', async () => {
    const { servicio, archivos } = preparar(true, false);

    await expect(servicio.descargar(casoId, terapeuta)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(archivos.leer).not.toHaveBeenCalled();
  });

 it('devuelve los metadatos sin exponer la clave ni leer el archivo', async () => {
  const { servicio, archivos } = preparar(true);

  await expect(servicio.consultar(casoId, terapeuta)).resolves.toEqual({
    nombre: genograma.nombre,
    tipo: genograma.tipo,
    tamanio: genograma.tamanio,
    autorId: genograma.autorId,
    actualizadoEn: genograma.actualizadoEn,
  });

  expect(archivos.leer).not.toHaveBeenCalled();
});
});
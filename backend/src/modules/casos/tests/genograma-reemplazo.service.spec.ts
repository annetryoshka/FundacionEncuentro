import { UnsupportedMediaTypeException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../../common/types/usuario.js';
import type { DatabaseService } from '../../../database/database.service.js';
import { GenogramaAccesoService } from '../genograma/genograma-acceso.service.js';
import { GenogramaReemplazoService } from '../genograma/genograma-reemplazo.service.js';

describe('GenogramaReemplazoService', () => {
  const casoId = '00000000-0000-4000-8000-000000000001';
  const usuario = {
    id: '00000000-0000-4000-8000-000000000002',
    rol: 'terapeuta',
  } as Usuario;

  const pdf = {
    nombre: 'genograma.pdf',
    tipo: 'application/pdf',
    contenido: Buffer.from('%PDF-1.7'),
  };

  function preparar() {
    let vigente = 'genograma-anterior';

    const acceso = new GenogramaAccesoService({
      query: vi.fn().mockResolvedValue({ rows: [{ id: casoId }] }),
    } as unknown as DatabaseService);

    const guardarNuevo = vi.fn(async () => {});
    const activarVersion = vi.fn(async (
      _casoId: string,
      _usuario: Usuario,
      version: { clave: string },
    ) => {
      vigente = version.clave;
    });

    return {
      servicio: new GenogramaReemplazoService(acceso, {
        guardarNuevo,
        activarVersion,
      }),
      guardarNuevo,
      activarVersion,
      vigente: () => vigente,
    };
  }

  it('activa la nueva versión después de guardarla', async () => {
    const datos = preparar();

    await datos.servicio.reemplazar(casoId, usuario, pdf, 32);

    expect(datos.guardarNuevo).toHaveBeenCalledBefore(datos.activarVersion);
    expect(datos.vigente()).toMatch(new RegExp(`^${casoId}/`));
  });

  it('conserva el anterior si el archivo es inválido', async () => {
    const datos = preparar();
    const invalido = { ...pdf, contenido: Buffer.from('Hola') };

    await expect(
      datos.servicio.reemplazar(casoId, usuario, invalido, 32),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    expect(datos.guardarNuevo).not.toHaveBeenCalled();
    expect(datos.activarVersion).not.toHaveBeenCalled();
    expect(datos.vigente()).toBe('genograma-anterior');
  });

  it('conserva el anterior si falla el almacenamiento', async () => {
    const datos = preparar();
    datos.guardarNuevo.mockRejectedValueOnce(new Error('Falló el guardado'));

    await expect(
      datos.servicio.reemplazar(casoId, usuario, pdf, 32),
    ).rejects.toThrow('Falló el guardado');

    expect(datos.activarVersion).not.toHaveBeenCalled();
    expect(datos.vigente()).toBe('genograma-anterior');
  });
  it('conserva el anterior si falla la activación de la nueva versión', async () => {
  const datos = preparar();
  datos.activarVersion.mockRejectedValueOnce(new Error('Falló la activación'));

  await expect(
    datos.servicio.reemplazar(casoId, usuario, pdf, 32),
  ).rejects.toThrow('Falló la activación');

  expect(datos.guardarNuevo).toHaveBeenCalledOnce();
  expect(datos.activarVersion).toHaveBeenCalledOnce();
  expect(datos.vigente()).toBe('genograma-anterior');
});

});
import { NotFoundException } from '@nestjs/common';
import { expect, it, vi } from 'vitest';
import type { Usuario } from '../../../common/types/usuario.js';
import { InformesService } from '../informes.service.js';

it('rechaza el caso ajeno antes de seleccionar datos del informe', async () => {
  const usuario: Usuario = {
    id: 'terapeuta-ajena',
    nombreCompleto: 'Terapeuta ficticia',
    rol: 'terapeuta',
  };
  const obtenerCarpetaAutorizada = vi.fn().mockRejectedValue(
    new NotFoundException('Caso no encontrado'),
  );
  const seleccionar = vi.fn();
  const servicio = new InformesService(
  { obtenerCarpetaAutorizada },
  { transaction: vi.fn() },
);

  await expect(
    servicio.preparar('caso-ficticio', usuario, seleccionar),
  ).rejects.toBeInstanceOf(NotFoundException);

  expect(obtenerCarpetaAutorizada).toHaveBeenCalledWith('caso-ficticio', usuario);
  expect(seleccionar).not.toHaveBeenCalled();
});
it.each(['intervencion_sistemica', 'judicial'] as const)(
  'prepara un borrador %s con el caso y la autora correctos',
  async (tipo) => {
    const casoId = 'caso-ficticio';
    const usuario: Usuario = {
      id: 'terapeuta-asignada',
      nombreCompleto: 'Terapeuta ficticia',
      rol: 'terapeuta',
    };
    const carpeta = { id: casoId };
    const obtenerCarpetaAutorizada = vi.fn().mockResolvedValue(carpeta);
    const servicio = new InformesService({ obtenerCarpetaAutorizada },{ transaction: vi.fn() },);

    const seleccionar = vi.fn(() => ({
      tipo,
      versionPlantilla: 'prueba-v1',
      origen: { seguimiento: 'Seguimiento ficticio' },
      comprobaciones: [{ campo: 'seguimiento', presente: true }],
      generarSecciones: (origen: { seguimiento: string }) => [
        { titulo: 'Seguimiento', contenido: origen.seguimiento },
      ],
    }));

    const borrador = await servicio.preparar(casoId, usuario, seleccionar);

    expect(seleccionar).toHaveBeenCalledWith(carpeta);
    expect(borrador).toEqual({
      casoId,
      generadoPor: usuario.id,
      tipo,
      versionPlantilla: 'prueba-v1',
      origen: { seguimiento: 'Seguimiento ficticio' },
      secciones: [{ titulo: 'Seguimiento', contenido: 'Seguimiento ficticio' }],
    });
  },
);
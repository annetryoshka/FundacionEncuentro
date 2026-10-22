import { describe, expect, it, vi } from 'vitest';
import { CarpetasController } from './carpetas.controller.js';
import type { CasosService } from './casos.service.js';
import type { AsignacionesService } from './asignaciones.service.js';
import type { Usuario } from '../../common/types/usuario.js';

describe('FE-37 - Controlador de carpetas', () => {
  it('asigna una terapeuta y devuelve la carpeta actualizada', async () => {
    const admin: Usuario = {
      id: 'admin-1',
      nombreCompleto: 'Administrador',
      rol: 'administrador',
    };

    const carpetaActualizada = {
      id: 'caso-1',
      numero: 1,
      terapeuta: {
        id: 'terapeuta-2',
        nombreCompleto: 'Terapeuta Dos',
      },
    };

    const casos = {
      obtenerCarpetaAutorizada: vi.fn().mockResolvedValue(carpetaActualizada),
    } as unknown as CasosService;

    const asignaciones = {
      asignar: vi.fn().mockResolvedValue([]),
    } as unknown as AsignacionesService;

    const controller = new CarpetasController(casos, asignaciones);

    const resultado = await controller.asignarTerapeuta(
      'caso-1',
      { perfilId: 'terapeuta-2' },
      admin,
    );

    expect(asignaciones.asignar).toHaveBeenCalledWith(
      'caso-1',
      'terapeuta-2',
      'admin-1',
    );

    expect(casos.obtenerCarpetaAutorizada).toHaveBeenCalledWith(
      'caso-1',
      admin,
    );

    expect(resultado).toEqual(carpetaActualizada);
  });
});
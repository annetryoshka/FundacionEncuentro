import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../auth/roles.guard.js';
import { CarpetasController } from './carpetas.controller.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Rol } from '../../common/types/usuario.js';

describe('FE-37 - Permisos HTTP de carpetas', () => {
  const guard = new RolesGuard(new Reflector());

  function contexto(metodo: string, rol: Rol): ExecutionContext {
    return {
      getHandler: () =>
        CarpetasController.prototype[
          metodo as keyof CarpetasController
        ],
      getClass: () => CarpetasController,
      switchToHttp: () => ({
        getRequest: () => ({
          usuario: {
            id: 'usuario-1',
            nombreCompleto: 'Usuario Prueba',
            rol,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite a administración consultar carpetas', () => {
    expect(
      guard.canActivate(contexto('obtener', 'administrador')),
    ).toBe(true);
  });

  it('permite a terapeutas consultar carpetas', () => {
    expect(
      guard.canActivate(contexto('obtener', 'terapeuta')),
    ).toBe(true);
  });

  it('rechaza a marketing al consultar carpetas', () => {
    expect(() =>
      guard.canActivate(contexto('obtener', 'marketing')),
    ).toThrow(ForbiddenException);
  });

  it('permite únicamente a administración asignar terapeutas', () => {
    expect(
      guard.canActivate(contexto('asignarTerapeuta', 'administrador')),
    ).toBe(true);

    expect(() =>
      guard.canActivate(contexto('asignarTerapeuta', 'terapeuta')),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(contexto('asignarTerapeuta', 'marketing')),
    ).toThrow(ForbiddenException);
  });
});
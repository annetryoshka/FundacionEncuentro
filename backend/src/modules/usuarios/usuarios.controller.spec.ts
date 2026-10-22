
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsuariosController } from './usuarios.controller.js';
import type { UsuariosService } from './usuarios.service.js';

describe('FE-29 - Contrato del listado de usuarios', () => {
  const crearControlador = () => {
    const listar = vi.fn().mockResolvedValue([
      {
        id: 'usuario-1',
        nombreCompleto: 'Ana Pérez',
        rol: 'terapeuta',
        activo: true,
      },
    ]);

    const servicio = { listar } as unknown as UsuariosService;

    return {
      controlador: new UsuariosController(servicio),
      listar,
    };
  };

  it('devuelve la estructura { usuarios: [...] }', async () => {
    const { controlador } = crearControlador();

    const resultado = await controlador.listar();

    expect(resultado).toHaveProperty('usuarios');
    expect(resultado.usuarios).toHaveLength(1);
  });

  it('envía los filtros al servicio', async () => {
    const { controlador, listar } = crearControlador();

    await controlador.listar('terapeuta', 'true');

    expect(listar).toHaveBeenCalledWith({
      rol: 'terapeuta',
      activo: true,
    });
  });

  it('convierte activo=false a booleano', async () => {
    const { controlador, listar } = crearControlador();

    await controlador.listar(undefined, 'false');

    expect(listar).toHaveBeenCalledWith({
      rol: undefined,
      activo: false,
    });
  });

  it('rechaza un rol inválido', async () => {
    const { controlador, listar } = crearControlador();

    await expect(
      controlador.listar('superadmin', undefined),
    ).rejects.toThrow(BadRequestException);

    expect(listar).not.toHaveBeenCalled();
  });

  it('rechaza un valor inválido para activo', async () => {
    const { controlador, listar } = crearControlador();

    await expect(
      controlador.listar('terapeuta', 'si'),
    ).rejects.toThrow(BadRequestException);

    expect(listar).not.toHaveBeenCalled();
  });
});

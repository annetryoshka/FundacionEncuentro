import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../auth/roles.guard.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';
import { EditarPacienteController } from './editar-paciente.controller.js';

import type { ExecutionContext } from '@nestjs/common';
import type { DatabaseService } from '../../database/database.service.js';
import type { Rol, Usuario } from '../../common/types/usuario.js';

describe('FE-53 - Actualización autorizada de datos del paciente', () => {
  const admin: Usuario = {
    id: 'admin-1',
    nombreCompleto: 'Administradora',
    rol: 'administrador',
  };

  describe('permisos', () => {
    const guard = new RolesGuard(new Reflector());

    function contexto(rol: Rol): ExecutionContext {
      return {
        getHandler: () => EditarPacienteController.prototype.actualizar,
        getClass: () => EditarPacienteController,
        switchToHttp: () => ({
          getRequest: () => ({
            usuario: { id: 'usuario-1', nombreCompleto: 'Usuario', rol },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('permite a administración modificar los datos', () => {
      expect(guard.canActivate(contexto('administrador'))).toBe(true);
    });

    it('rechaza a una terapeuta que llama directo a la API', () => {
      expect(() => guard.canActivate(contexto('terapeuta'))).toThrow(
        ForbiddenException,
      );
    });

    it('rechaza a marketing', () => {
      expect(() => guard.canActivate(contexto('marketing'))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('validación del cuerpo', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const validar = (cuerpo: Record<string, unknown>) =>
      pipe.transform(cuerpo, { type: 'body', metatype: ActualizarCasoDto });

    it('acepta un nombre y una fecha válidos', async () => {
      await expect(
        validar({ nombreCompleto: 'Ana Pérez', fechaIngreso: '2026-10-01' }),
      ).resolves.toBeInstanceOf(ActualizarCasoDto);
    });

    it.each(['numeroCorrelativo', 'numero', 'tipo', 'estado'])(
      'rechaza intentar modificar %s',
      async (campo) => {
        await expect(
          validar({
            nombreCompleto: 'Ana Pérez',
            fechaIngreso: '2026-10-01',
            [campo]: 99,
          }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('rechaza un nombre vacío', async () => {
      await expect(
        validar({ nombreCompleto: '', fechaIngreso: '2026-10-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['2026-02-30', '01/10/2026', 'mañana'])(
      'rechaza la fecha inválida %s',
      async (fechaIngreso) => {
        await expect(
          validar({ nombreCompleto: 'Ana Pérez', fechaIngreso }),
        ).rejects.toThrow(BadRequestException);
      },
    );
  });

  describe('servicio', () => {
    function crearDb(filaCaso?: Record<string, unknown>) {
      const client = {
        query: vi.fn(async (sql: string) =>
          sql.includes('for update')
            ? { rows: filaCaso ? [filaCaso] : [] }
            : { rows: [], rowCount: 1 },
        ),
      };
      const db = {
        transaction: vi.fn(
          async (_usuarioId: string, fn: (c: typeof client) => unknown) =>
            fn(client),
        ),
      } as unknown as DatabaseService;
      return { db, client };
    }

    const filaCaso = {
      paciente_id: 'paciente-1',
      fecha_nacimiento: '2010-05-04',
      hoy: '2026-10-23',
    };

    it('actualiza al paciente existente dentro de una transacción del admin', async () => {
      const { db, client } = crearDb(filaCaso);

      await new CasosService(db).actualizarDatosPaciente(
        'caso-1',
        { nombreCompleto: '  Ana   Pérez ', fechaIngreso: '2026-10-01' },
        admin.id,
      );

      expect(db.transaction).toHaveBeenCalledWith('admin-1', expect.any(Function));

      const sentencias = client.query.mock.calls.map(([sql]) => sql as string);
      expect(sentencias.some((sql) => /insert/i.test(sql))).toBe(false);
      expect(sentencias.some((sql) => sql.includes('numero_correlativo'))).toBe(false);
      expect(sentencias.some((sql) => sql.includes('estado'))).toBe(false);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('update pacientes'),
        ['Ana Pérez', 'paciente-1'],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('update casos'),
        ['2026-10-01', 'caso-1'],
      );
    });

    it('no modifica nada si la carpeta no existe', async () => {
      const { db, client } = crearDb();

      await expect(
        new CasosService(db).actualizarDatosPaciente(
          'caso-x',
          { nombreCompleto: 'Ana Pérez', fechaIngreso: '2026-10-01' },
          admin.id,
        ),
      ).rejects.toThrow('Caso no encontrado');

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it.each(['2026-10-24', '1989-12-31', '2010-05-03'])(
      'rechaza la fecha de ingreso %s sin actualizar',
      async (fechaIngreso) => {
        const { db, client } = crearDb(filaCaso);

        await expect(
          new CasosService(db).actualizarDatosPaciente(
            'caso-1',
            { nombreCompleto: 'Ana Pérez', fechaIngreso },
            admin.id,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(client.query).toHaveBeenCalledTimes(1);
      },
    );

    it('rechaza un nombre sin letras', async () => {
      const { db } = crearDb(filaCaso);

      await expect(
        new CasosService(db).actualizarDatosPaciente(
          'caso-1',
          { nombreCompleto: '   ', fechaIngreso: '2026-10-01' },
          admin.id,
        ),
      ).rejects.toThrow('El nombre del paciente no es válido');

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('informa quién hizo la última actualización y cuándo', async () => {
      const db = {
        query: vi.fn(async () => ({
          rows: [{
            id: 'caso-1',
            numero_correlativo: 7,
            tipo: 'voluntario',
            estado: 'en_proceso',
            fecha_ingreso: '2026-10-01',
            paciente_id: 'paciente-1',
            nombre_completo: 'Ana Pérez',
            terapeuta_id: 'terapeuta-1',
            terapeuta_nombre: 'Terapeuta Uno',
            editor_id: 'admin-1',
            editor_nombre: 'Administradora',
            actualizado_en: '2026-10-23T10:00:00.000Z',
          }],
        })),
      } as unknown as DatabaseService;

      const carpeta = await new CasosService(db).obtenerCarpetaAutorizada(
        'caso-1',
        admin,
      );

      expect(carpeta.actualizadoPor).toEqual({
        id: 'admin-1',
        nombreCompleto: 'Administradora',
      });
      expect(carpeta.actualizadoEn).toBe('2026-10-23T10:00:00.000Z');

      const [sql] = vi.mocked(db.query).mock.calls[0] as unknown as [string];
      expect(sql).toContain('from auditoria');
    });
  });

  describe('controlador', () => {
    it('responde con la carpeta completa y conserva su asignación', async () => {
      const carpeta = {
        id: 'caso-1',
        numero: 7,
        estado: 'en_proceso',
        terapeuta: { id: 'terapeuta-1', nombreCompleto: 'Terapeuta Uno' },
      };
      const casos = {
        actualizarDatosPaciente: vi.fn(async () => undefined),
        obtenerCarpetaAutorizada: vi.fn(async () => carpeta),
      } as unknown as CasosService;

      const dto = { nombreCompleto: 'Ana Pérez', fechaIngreso: '2026-10-01' };
      const respuesta = await new EditarPacienteController(casos).actualizar(
        'caso-1',
        dto,
        admin,
      );

      expect(casos.actualizarDatosPaciente).toHaveBeenCalledWith('caso-1', dto, 'admin-1');
      expect(casos.obtenerCarpetaAutorizada).toHaveBeenCalledWith('caso-1', admin);
      expect(respuesta).toBe(carpeta);
    });
  });
});

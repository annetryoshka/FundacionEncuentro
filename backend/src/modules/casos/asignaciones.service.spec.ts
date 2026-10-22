import { describe, expect, it, vi } from 'vitest';
import { AsignacionesService } from './asignaciones.service.js';
import type { DatabaseService } from '../../database/database.service.js';

describe('FE-37 - Asignación exclusiva por caso', () => {
  it('sustituye la terapeuta anterior por una nueva', async () => {
    const consultas: string[] = [];

    const client = {
      query: vi.fn(async (sql: string) => {
        consultas.push(sql.trim());

        if (sql.includes('from casos')) {
          return { rowCount: 1, rows: [{ id: 'caso-1' }] };
        }

        if (sql.includes('from perfiles where')) {
          return {
            rowCount: 1,
            rows: [{ rol: 'terapeuta', activo: true }],
          };
        }

        if (sql.includes('select perfil_id from asignaciones_caso')) {
          return {
            rowCount: 1,
            rows: [{ perfil_id: 'terapeuta-anterior' }],
          };
        }

        if (sql.includes('join perfiles')) {
          return {
            rowCount: 1,
            rows: [
              {
                perfil_id: 'terapeuta-nueva',
                nombre_completo: 'Terapeuta Nueva',
                activo: true,
                asignado_en: new Date(),
              },
            ],
          };
        }

        return { rowCount: 1, rows: [] };
      }),
    };

    const db = {
      transaction: vi.fn(async (_adminId, callback) => callback(client)),
    } as unknown as DatabaseService;

    const service = new AsignacionesService(db);

    const resultado = await service.asignar(
      'caso-1',
      'terapeuta-nueva',
      'admin-1',
    );

    expect(resultado[0].perfilId).toBe('terapeuta-nueva');

    const eliminacion = consultas.findIndex((sql) =>
      sql.startsWith('delete from asignaciones_caso'),
    );

    const insercion = consultas.findIndex((sql) =>
      sql.startsWith('insert into asignaciones_caso'),
    );

    expect(eliminacion).toBeGreaterThanOrEqual(0);
    expect(insercion).toBeGreaterThan(eliminacion);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('rechaza asignar una terapeuta inactiva', async () => {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('from casos')) {
        return { rowCount: 1, rows: [{ id: 'caso-1' }] };
      }

      if (sql.includes('from perfiles where')) {
        return {
          rowCount: 1,
          rows: [{ rol: 'terapeuta', activo: false }],
        };
      }

      return { rowCount: 0, rows: [] };
    }),
  };

  const db = {
    transaction: vi.fn(async (_adminId, callback) => callback(client)),
  } as unknown as DatabaseService;

  const service = new AsignacionesService(db);

  await expect(
    service.asignar('caso-1', 'terapeuta-inactiva', 'admin-1'),
  ).rejects.toThrow('Solo se puede asignar a terapeutas activos');

  const consultas = client.query.mock.calls.map(([sql]) => sql);

  expect(
    consultas.some((sql) =>
      sql.includes('delete from asignaciones_caso'),
    ),
  ).toBe(false);

  expect(
    consultas.some((sql) =>
      sql.includes('insert into asignaciones_caso'),
    ),
  ).toBe(false);
});

it('rechaza asignar nuevamente a la misma terapeuta', async () => {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('from casos')) {
        return { rowCount: 1, rows: [{ id: 'caso-1' }] };
      }

      if (sql.includes('from perfiles where')) {
        return {
          rowCount: 1,
          rows: [{ rol: 'terapeuta', activo: true }],
        };
      }

      if (sql.includes('select perfil_id from asignaciones_caso')) {
        return {
          rowCount: 1,
          rows: [{ perfil_id: 'terapeuta-1' }],
        };
      }

      return { rowCount: 0, rows: [] };
    }),
  };

  const db = {
    transaction: vi.fn(async (_adminId, callback) => callback(client)),
  } as unknown as DatabaseService;

  const service = new AsignacionesService(db);

  await expect(
    service.asignar('caso-1', 'terapeuta-1', 'admin-1'),
  ).rejects.toThrow('Ese terapeuta ya está asignado al caso');

  const consultas = client.query.mock.calls.map(([sql]) => sql);

  expect(
    consultas.some((sql) =>
      sql.includes('delete from asignaciones_caso'),
    ),
  ).toBe(false);

  expect(
    consultas.some((sql) =>
      sql.includes('insert into asignaciones_caso'),
    ),
  ).toBe(false);
});

it('propaga un error de inserción para revertir la transacción', async () => {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('from casos')) {
        return { rowCount: 1, rows: [{ id: 'caso-1' }] };
      }

      if (sql.includes('from perfiles where')) {
        return {
          rowCount: 1,
          rows: [{ rol: 'terapeuta', activo: true }],
        };
      }

      if (sql.includes('select perfil_id from asignaciones_caso')) {
        return {
          rowCount: 1,
          rows: [{ perfil_id: 'terapeuta-anterior' }],
        };
      }

      if (sql.includes('insert into asignaciones_caso')) {
        throw new Error('Error simulado de inserción');
      }

      return { rowCount: 1, rows: [] };
    }),
  };

  const db = {
    transaction: vi.fn(async (_adminId, callback) => callback(client)),
  } as unknown as DatabaseService;

  const service = new AsignacionesService(db);

  await expect(
    service.asignar('caso-1', 'terapeuta-nueva', 'admin-1'),
  ).rejects.toThrow('Error simulado de inserción');

  const consultas = client.query.mock.calls.map(([sql]) => sql);

  expect(
    consultas.some((sql) =>
      sql.includes('delete from asignaciones_caso'),
    ),
  ).toBe(true);

  expect(
    consultas.some((sql) =>
      sql.includes('insert into asignaciones_caso'),
    ),
  ).toBe(true);
});
});
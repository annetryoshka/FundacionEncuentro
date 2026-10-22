import { describe, expect, it, vi } from 'vitest';
import { CasosService } from './casos.service.js';
import type { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';

describe('FE-37 - Autorización por caso', () => {
  const terapeuta: Usuario = {
    id: 'terapeuta-1',
    nombreCompleto: 'Terapeuta Uno',
    rol: 'terapeuta',
  };

  it('permite consultar un caso asignado a la terapeuta', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [{
            id: 'caso-1',
            tipo: 'voluntario',
            numero_correlativo: 1,
            estado: 'iniciado',
            fecha_ingreso: '2026-10-22',
            paciente_id: 'paciente-1',
            nombre_completo: 'Paciente Uno',
            terapeuta_id: 'terapeuta-1',
            terapeuta_nombre: 'Terapeuta Uno',
            creador_id: 'admin-1',
            creador_nombre: 'Administrador',
            creado_en: new Date('2026-10-22'),
            asignador_id: 'admin-1',
            asignador_nombre: 'Administrador',
            asignado_en: new Date('2026-10-22'),
            }],
      })),
    } as unknown as DatabaseService;

    const service = new CasosService(db);

    const resultado = await service.obtenerCarpetaAutorizada(
      'caso-1',
      terapeuta,
    );

    expect(resultado.id).toBe('caso-1');
    expect(resultado.numero).toBe(1);
    expect(resultado.terapeuta).toEqual({
        id: 'terapeuta-1',
        nombreCompleto: 'Terapeuta Uno',
        });
    expect(resultado.asignadoPor?.id).toBe('admin-1');

    const [sql, parametros] = vi.mocked(db.query).mock.calls[0];

    expect(sql).toContain('left join asignaciones_caso');
    expect(sql).toContain('a.perfil_id = $3');
    expect(sql).toContain('asignaciones_caso');
    expect(parametros).toEqual([
      'caso-1',
      'terapeuta',
      'terapeuta-1',
    ]);
  });

  it('rechaza consultar un caso no asignado', async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [] })),
    } as unknown as DatabaseService;

    const service = new CasosService(db);

    await expect(
      service.obtenerCarpetaAutorizada('caso-ajeno', terapeuta),
    ).rejects.toThrow('Caso no encontrado');
  });

  it('revoca el acceso cuando la terapeuta deja de estar asignada', async () => {
  let terapeutaAsignada = 'terapeuta-1';

  const db = {
    query: vi.fn(async (_sql: string, parametros: unknown[]) => {
      const usuarioId = parametros[2];

      if (usuarioId !== terapeutaAsignada) {
        return { rows: [] };
      }

      return {
        rows: [{
          id: 'caso-1',
          tipo: 'voluntario',
          numero_correlativo: 1,
          paciente_id: 'paciente-1',
          nombre_completo: 'Paciente Uno',
        }],
      };
    }),
  } as unknown as DatabaseService;

  const service = new CasosService(db);

  // La terapeuta original puede consultar su caso.
  const primeraConsulta = await service.obtenerCarpetaAutorizada(
    'caso-1',
    terapeuta,
  );

  expect(primeraConsulta.id).toBe('caso-1');

  // Simulamos que administración asigna otra terapeuta.
  terapeutaAsignada = 'terapeuta-2';

  // La terapeuta anterior ya no puede consultar el caso.
  await expect(
    service.obtenerCarpetaAutorizada('caso-1', terapeuta),
  ).rejects.toThrow('Caso no encontrado');

  // La nueva terapeuta sí puede acceder.
  const nuevaTerapeuta: Usuario = {
    id: 'terapeuta-2',
    nombreCompleto: 'Terapeuta Dos',
    rol: 'terapeuta',
  };

  const segundaConsulta = await service.obtenerCarpetaAutorizada(
    'caso-1',
    nuevaTerapeuta,
  );

  expect(segundaConsulta.id).toBe('caso-1');
  expect(db.query).toHaveBeenCalledTimes(3);
});it('permite a administración consultar un caso sin asignación', async () => {
  const db = {
    query: vi.fn(async () => ({
      rows: [{
        id: 'caso-1',
        tipo: 'voluntario',
        numero_correlativo: 1,
        paciente_id: 'paciente-1',
        nombre_completo: 'Paciente Uno',
      }],
    })),
  } as unknown as DatabaseService;

  const service = new CasosService(db);

  const admin: Usuario = {
    id: 'admin-1',
    nombreCompleto: 'Administrador',
    rol: 'administrador',
  };

  const resultado = await service.obtenerCarpetaAutorizada('caso-1', admin);

  expect(resultado.id).toBe('caso-1');
  expect(resultado.numero).toBe(1);
  expect(resultado.terapeuta).toBeNull();
  expect(resultado.asignadoPor).toBeNull();
  expect(resultado.asignadoEn).toBeNull();

  expect(vi.mocked(db.query).mock.calls[0][1]).toEqual([
    'caso-1',
    'administrador',
    'admin-1',
  ]);
});

it('impide que marketing obtenga datos clínicos', async () => {
  const db = {
    query: vi.fn(async () => ({ rows: [] })),
  } as unknown as DatabaseService;

  const service = new CasosService(db);

  const marketing: Usuario = {
    id: 'marketing-1',
    nombreCompleto: 'Usuario Marketing',
    rol: 'marketing',
  };

  await expect(
    service.obtenerCarpetaAutorizada('caso-1', marketing),
  ).rejects.toThrow('Caso no encontrado');

  expect(vi.mocked(db.query).mock.calls[0][1]).toEqual([
    'caso-1',
    'marketing',
    'marketing-1',
  ]);
});
});
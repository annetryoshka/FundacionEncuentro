import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistorialService } from '../historial.service.js';
import type { DatabaseService } from '../../../database/database.service.js';
import type { Usuario } from '../../../common/types/usuario.js';

const casoId = '10000000-0000-4000-8000-000000000013';

const terapeuta: Usuario = {
  id: 'c98a4a84-0bfc-47af-9f91-f207e4c971ed',
  nombreCompleto: 'Terapeuta QA',
  rol: 'terapeuta',
};

describe('FE-83: historial clínico', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: HistorialService;

  beforeEach(() => {
    vi.resetAllMocks();

    transaction.mockImplementation(
      async (_actor, ejecutar) => ejecutar({ query }),
    );

    servicio = new HistorialService({
      transaction,
    } as unknown as DatabaseService);
  });

  function preparar({
    contexto = [],
    constancia = [],
    diagnostico = [],
    sesiones = [],
    tareas = [],
  }: {
    contexto?: object[];
    constancia?: object[];
    diagnostico?: object[];
    sesiones?: object[];
    tareas?: object[];
  } = {}) {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: casoId,
          numero_correlativo: 8,
          tipo: 'derivado',
          clasificacion: 'social',
          estado: 'en_proceso',
          fecha_ingreso: '2026-09-25',
          paciente_id: 'paciente-qa',
          nombre_completo: 'Paciente ficticio',
          terapeuta_id: terapeuta.id,
          terapeuta_nombre: terapeuta.nombreCompleto,
        }],
      })
      .mockResolvedValueOnce({ rows: contexto })
      .mockResolvedValueOnce({ rows: constancia })
      .mockResolvedValueOnce({ rows: diagnostico })
      .mockResolvedValueOnce({ rows: sesiones })
      .mockResolvedValueOnce({ rows: tareas });
  }

  it('devuelve secciones vacías sin inventar registros', async () => {
    preparar();

    const resultado = await servicio.obtener(casoId, terapeuta);

    expect(resultado.carpeta.id).toBe(casoId);
    expect(resultado.contexto).toBeNull();
    expect(resultado.constancia).toBeNull();
    expect(resultado.diagnostico).toBeNull();
    expect(resultado.sesiones).toEqual([]);
  });

  it('rechaza caso inexistente o ajeno antes de consultar secciones', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.obtener(casoId, terapeuta))
      .rejects.toThrow('Caso no encontrado');

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('entrega identidad autenticada a la consulta de autorización', async () => {
    preparar();

    await servicio.obtener(casoId, terapeuta);

    expect(query.mock.calls[0][1]).toEqual([
      casoId,
      'terapeuta',
      terapeuta.id,
    ]);
    expect(transaction.mock.calls[0][0]).toBe(terapeuta.id);
  });

  it('conserva datos y trazabilidad de diagnóstico y constancia', async () => {
    const diagnostico = {
      id: 'diagnostico-qa',
      diagnosticoIngreso: 'Evaluación ficticia',
      creadoPor: terapeuta.id,
      creadoEn: '2026-11-12T12:00:00Z',
    };

    const constancia = {
      id: 'constancia-qa',
      estado: 'pendiente',
      actualizadoPor: terapeuta.id,
    };

    preparar({
      diagnostico: [{ datos: diagnostico }],
      constancia: [{ datos: constancia }],
    });

    const resultado = await servicio.obtener(casoId, terapeuta);

    expect(resultado.diagnostico).toEqual(diagnostico);
    expect(resultado.constancia).toEqual(constancia);
  });

  it('agrupa cada tarea dentro de su sesión, sin duplicar sesiones', async () => {
    preparar({
      sesiones: [
        { id: 's1', datos: { id: 's1', numero: 1 } },
        { id: 's2', datos: { id: 's2', numero: 2 } },
      ],
      tareas: [
        { sesion_id: 's1', datos: { id: 't1' } },
        { sesion_id: 's1', datos: { id: 't2' } },
        { sesion_id: 's2', datos: { id: 't3' } },
      ],
    });

    const resultado = await servicio.obtener(casoId, terapeuta);

    expect(resultado.sesiones).toEqual([
      {
        id: 's1',
        numero: 1,
        tareas: [{ id: 't1' }, { id: 't2' }],
      },
      {
        id: 's2',
        numero: 2,
        tareas: [{ id: 't3' }],
      },
    ]);
  });

  it('una sesión sin tareas conserva una lista vacía', async () => {
    preparar({
      sesiones: [
        { id: 's1', datos: { id: 's1', numero: 1 } },
      ],
    });

    const resultado = await servicio.obtener(casoId, terapeuta);

    expect(resultado.sesiones[0].tareas).toEqual([]);
  });

  for (const rol of ['terapeuta', 'administrador'] as const) {
    it(`no consulta pagos ni agrega sección financiera para ${rol}`, async () => {
      preparar();

      const resultado = await servicio.obtener(casoId, {
        ...terapeuta,
        rol,
      });

      expect(resultado).not.toHaveProperty('pagos');
      expect(
        query.mock.calls.some(([sql]) => /\bfrom\s+pagos\b/i.test(sql)),
      ).toBe(false);
    });
  }

  it('delimita las consultas de secciones al caso solicitado', async () => {
    preparar();

    await servicio.obtener(casoId, terapeuta);

    for (const [, parametros] of query.mock.calls.slice(1)) {
      expect(parametros).toEqual([casoId]);
    }
  });

  it('propaga un error de consulta sin fingir una sección vacía', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockRejectedValueOnce(new Error('Fallo de contexto'));

    await expect(servicio.obtener(casoId, terapeuta))
      .rejects.toThrow('Fallo de contexto');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('solicita una transacción con aislamiento repeatable read', async () => {
    preparar();

    await servicio.obtener(casoId, terapeuta);

    expect(transaction.mock.calls[0][2]).toEqual({
      aislamiento: 'repeatable read',
    });
  });
});
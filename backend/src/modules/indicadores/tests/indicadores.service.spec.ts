import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { IndicadoresService } from '../indicadores.service.js';
import { ConsultarIndicadoresQuery } from '../dto/consultar-indicadores.query.js';
import type { DatabaseService } from '../../../database/database.service.js';

const filtros = () => ({
  desde: '2026-10-12',
  hasta: '2026-10-19',
});

describe('FE-93: servicio de indicadores', () => {
  const query = vi.fn();
  let servicio: IndicadoresService;

  beforeEach(() => {
    vi.resetAllMocks();
    servicio = new IndicadoresService({
      query,
    } as unknown as DatabaseService);
  });

  it('transforma los indicadores y conserva centavos como texto', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        casos_actuales: 4,
        casos_iniciados: 2,
        casos_en_proceso: 1,
        casos_concluidos: 1,
        sesiones: 3,
        pagos_recibidos: '225.60',
      }],
    });

    const resultado = await servicio.consultar(filtros());

    expect(resultado).toEqual({
      periodo: filtros(),
      casosActuales: 4,
      casosPorEstado: {
        iniciado: 2,
        en_proceso: 1,
        concluido: 1,
      },
      sesiones: 3,
      pagosRecibidos: {
        monto: '225.60',
        moneda: 'BOB',
      },
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      '2026-10-12', '2026-10-19',
    ]);
  });

  it('rechaza un período invertido sin consultar la base', async () => {
    await expect(servicio.consultar({
      desde: '2026-10-20',
      hasta: '2026-10-12',
    })).rejects.toMatchObject({ status: 400 });

    expect(query).not.toHaveBeenCalled();
  });

  it('permite consultar un único día', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        casos_actuales: 4,
        casos_iniciados: 2,
        casos_en_proceso: 1,
        casos_concluidos: 1,
        sesiones: 1,
        pagos_recibidos: '40.25',
      }],
    });

    await servicio.consultar({
      desde: '2026-10-20',
      hasta: '2026-10-20',
    });

    expect(query.mock.calls[0][1]).toEqual([
      '2026-10-20', '2026-10-20',
    ]);
  });

  it('conserva casos actuales cuando no hay movimientos', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        casos_actuales: 4,
        casos_iniciados: 2,
        casos_en_proceso: 1,
        casos_concluidos: 1,
        sesiones: 0,
        pagos_recibidos: '0.00',
      }],
    });

    const resultado = await servicio.consultar(filtros());

    expect(resultado.casosActuales).toBe(4);
    expect(resultado.sesiones).toBe(0);
    expect(resultado.pagosRecibidos.monto).toBe('0.00');
  });

  it('propaga errores sin mostrarlos como indicadores en cero', async () => {
    query.mockRejectedValueOnce(new Error('Fallo SQL'));

    await expect(servicio.consultar(filtros()))
      .rejects.toThrow('Fallo SQL');
  });

  it('rechaza una respuesta inesperadamente vacía', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.consultar(filtros()))
      .rejects.toMatchObject({ status: 500 });
  });
});

describe('FE-93: fechas del período', () => {
  async function errores(cambios: Record<string, unknown>) {
    const dto = Object.assign(
      new ConsultarIndicadoresQuery(), filtros(), cambios,
    );
    return validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('acepta fechas calendario válidas', async () => {
    expect(await errores({})).toHaveLength(0);
  });

  for (const campo of ['desde', 'hasta']) {
    for (const valor of [
      undefined, null, '', '2026-02-30',
      '12/10/2026', '2026-10-12T00:00:00Z',
    ]) {
      it(`rechaza ${campo}: ${String(valor)}`, async () => {
        expect((await errores({ [campo]: valor })).length)
          .toBeGreaterThan(0);
      });
    }
  }

  it('rechaza parámetros fuera del contrato', async () => {
    const resultado = await errores({ rol: 'administrador' });
    expect(resultado.some((error) => error.property === 'rol'))
      .toBe(true);
  });
});
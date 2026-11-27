import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../../database/database.service.js';
import { GuardarGastoDto } from '../dto/guardar-gasto.dto.js';
import { GastosService } from '../gastos.service.js';

const adminId = 'a7d176ae-e95a-4f4d-8506-f33201d57016';
const gastoId = '6d55de91-8124-4089-a1d1-b6694d47acfd';
const gasto = { id: gastoId, categoria: 'internet', fecha: '2026-11-20', monto: '120.00', descripcion: null, anulado: false };
const errorPg = (code: string, message = 'error de prueba') => Object.assign(new Error(message), { code });

describe('FE-174: servicio de gastos', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: GastosService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation((_usuario: string, fn: (client: { query: typeof query }) => unknown) => fn({ query }));
    servicio = new GastosService({ transaction } as unknown as DatabaseService);
  });

  it('registra con el usuario en la transacción, descripción recortada y tipo egreso', async () => {
    query.mockResolvedValueOnce({ rows: [{ gasto }] });
    const r = await servicio.registrar(adminId, { categoria: 'internet', fecha: '2026-11-20', monto: '120.00', descripcion: '  Wi-Fi  ' });
    expect(r).toBe(gasto);
    expect(transaction).toHaveBeenCalledWith(adminId, expect.any(Function));
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/values \('egreso'/);
    expect(params).toEqual(['internet', '2026-11-20', '120.00', 'Wi-Fi']);
  });

  it('una descripción en blanco se guarda como null', async () => {
    query.mockResolvedValueOnce({ rows: [{ gasto }] });
    await servicio.registrar(adminId, { categoria: 'alquiler', fecha: '2026-11-22', monto: '1500', descripcion: '   ' });
    expect(query.mock.calls[0][1][3]).toBeNull();
  });

  it('«otros» sin descripción se rechaza antes de tocar la base', async () => {
    await expect(servicio.registrar(adminId, { categoria: 'otros', fecha: '2026-11-20', monto: '10.00' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.registrar(adminId, { categoria: 'otros', fecha: '2026-11-20', monto: '10.00', descripcion: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('consulta el mes pedido o el actual (null) con consultar_gastos_mes', async () => {
    const resumen = { mes: '2026-11', totalMes: '1700.00' };
    query.mockResolvedValue({ rows: [{ resumen }] });
    expect(await servicio.consultarMes(adminId, '2026-11')).toBe(resumen);
    expect(query.mock.calls[0]).toEqual([expect.stringMatching(/consultar_gastos_mes\(\$1\)/), ['2026-11']]);
    await servicio.consultarMes(adminId);
    expect(query.mock.calls[1][1]).toEqual([null]);
  });

  it('corregir un gasto inexistente da 404 sin actualizar', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(servicio.corregir(adminId, gastoId, { categoria: 'internet', fecha: '2026-11-20', monto: '1.00' })).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('corregir un gasto anulado da 409 sin actualizar', async () => {
    query.mockResolvedValueOnce({ rows: [{ anulado: true }] });
    await expect(servicio.corregir(adminId, gastoId, { categoria: 'internet', fecha: '2026-11-20', monto: '1.00' })).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('corregir un gasto vigente bloquea la fila y actualiza los cuatro campos', async () => {
    query.mockResolvedValueOnce({ rows: [{ anulado: false }] }).mockResolvedValueOnce({ rows: [{ gasto }] });
    await servicio.corregir(adminId, gastoId, { categoria: 'electricidad', fecha: '2026-11-21', monto: '85.00', descripcion: null });
    expect(query.mock.calls[0][0]).toMatch(/for update/);
    expect(query.mock.calls[1][1]).toEqual([gastoId, 'electricidad', '2026-11-21', '85.00', null]);
  });

  it('anular envía el motivo recortado o null', async () => {
    query.mockResolvedValue({ rows: [{ gasto }] });
    await servicio.anular(adminId, gastoId, '  Duplicado  ');
    await servicio.anular(adminId, gastoId);
    expect(query.mock.calls[0][1]).toEqual([gastoId, 'Duplicado']);
    expect(query.mock.calls[1][1]).toEqual([gastoId, null]);
  });

  it.each([
    ['42501', 'Solo administración gestiona los gastos', ForbiddenException],
    ['P0002', 'Gasto no encontrado', NotFoundException],
    ['22023', 'Mes inválido: use AAAA-MM', BadRequestException],
    ['22008', 'date/time field value out of range', BadRequestException],
    ['23502', 'null value', BadRequestException],
    ['23514', 'La fecha del gasto no puede ser futura', BadRequestException],
    ['23514', 'Un gasto anulado no se modifica', ConflictException],
    ['23514', 'violates check constraint "ck_gasto_categoria"', BadRequestException],
  ])('traduce el error %s (%s)', async (codigo, mensaje, clase) => {
    transaction.mockRejectedValueOnce(errorPg(codigo, mensaje));
    await expect(servicio.consultarMes(adminId, '2026-11')).rejects.toBeInstanceOf(clase);
  });

  it('un error que no es de PostgreSQL se propaga sin cambios', async () => {
    const original = new Error('se cayó la red');
    transaction.mockRejectedValueOnce(original);
    await expect(servicio.consultarMes(adminId)).rejects.toBe(original);
  });
});

describe('FE-174: validación del cuerpo', () => {
  const errores = async (cuerpo: Record<string, unknown>) =>
    (await validate(plainToInstance(GuardarGastoDto, cuerpo))).map((e) => e.property);
  const valido = { categoria: 'internet', fecha: '2026-11-20', monto: '120.00' };

  it('acepta el ejemplo de FE-172', async () => {
    expect(await errores({ ...valido, descripcion: 'Servicio mensual ficticio' })).toEqual([]);
    expect(await errores(valido)).toEqual([]);
  });

  it.each([
    ['monto cero', { monto: '0' }, 'monto'],
    ['monto 0.00', { monto: '0.00' }, 'monto'],
    ['monto negativo', { monto: '-5.00' }, 'monto'],
    ['tres decimales', { monto: '10.005' }, 'monto'],
    ['más de 8 enteros', { monto: '100000000.00' }, 'monto'],
    ['coma decimal', { monto: '10,50' }, 'monto'],
    ['monto numérico', { monto: 120 }, 'monto'],
    ['categoría desconocida', { categoria: 'agua' }, 'categoria'],
    ['categoría en mayúsculas', { categoria: 'Internet' }, 'categoria'],
    ['fecha imposible', { fecha: '2026-02-30' }, 'fecha'],
    ['fecha con otro formato', { fecha: '20/11/2026' }, 'fecha'],
    ['descripción de 201', { descripcion: 'x'.repeat(201) }, 'descripcion'],
    ['descripción vacía', { descripcion: '' }, 'descripcion'],
  ])('rechaza %s', async (_nombre, cambio, propiedad) => {
    expect(await errores({ ...valido, ...cambio })).toContain(propiedad);
  });
});

import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PagosService } from '../pagos.service.js';
import type { RegistrarPagoDto } from '../dto/registrar-pago.dto.js';
import type { DatabaseService } from '../../../database/database.service.js';

const casoId = '10000000-0000-4000-8000-000000000013';
const sesionId = 'ae29f859-bab1-42c9-83ce-7194c12a46d6';
const pagoId = '6d55de91-8124-4089-a1d1-b6694d47acfd';
const adminId = 'a7d176ae-e95a-4f4d-8506-f33201d57016';

const datos = (): RegistrarPagoDto => ({
  sesionId,
  monto: '75.50',
  fecha: '2026-11-12',
  metodo: 'qr',
  referencia: 'QA-PAGO-FICTICIO-001',
});

const fila = () => ({
  id: pagoId,
  caso_id: casoId,
  sesion_id: sesionId,
  monto: '75.50',
  moneda: 'BOB',
  fecha: '2026-11-12',
  metodo: 'qr',
  referencia: 'QA-PAGO-FICTICIO-001',
  registrado_por: adminId,
  creado_en: new Date('2026-11-12T12:00:00Z'),
});

describe('FE-88: servicio de pagos', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: PagosService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(
      async (_actor, ejecutar) => ejecutar({ query }),
    );
    servicio = new PagosService({
      query,
      transaction,
    } as unknown as DatabaseService);
  });

  function casoYSesion() {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] });
  }

  it('listado: rechaza un caso inexistente', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.listar(casoId))
      .rejects.toThrow('Caso no encontrado');

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('listado: devuelve vacío cuando no hay pagos', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(servicio.listar(casoId))
      .resolves.toEqual({ pagos: [] });
  });

  it('listado: conserva importe decimal como texto y trazabilidad', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.listar(casoId);

    expect(resultado.pagos[0]).toMatchObject({
      id: pagoId,
      casoId,
      sesionId,
      monto: '75.50',
      moneda: 'BOB',
      registradoPor: adminId,
    });
    expect(typeof resultado.pagos[0].monto).toBe('string');
  });

  it('listado: propaga errores sin convertirlos en lista vacía', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockRejectedValueOnce(new Error('Fallo de lectura'));

    await expect(servicio.listar(casoId))
      .rejects.toThrow('Fallo de lectura');
  });

  it('registro: rechaza un caso inexistente antes de insertar', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.registrar(casoId, datos(), adminId))
      .rejects.toThrow('Caso no encontrado');

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza sesión inexistente o de otro caso sin insertar', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(servicio.registrar(casoId, datos(), adminId))
      .rejects.toThrow('La sesión no existe o no pertenece al caso');

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([sesionId, casoId]);
  });

  it('registra el pago con actor y monto sin conversión a number', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [{ id: pagoId }] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), coincide: true }],
      });

    const resultado = await servicio.registrar(
      casoId, datos(), adminId,
    );

    expect(resultado.reutilizado).toBe(false);
    expect(resultado.pago).toMatchObject({
      id: pagoId,
      monto: '75.50',
      registradoPor: adminId,
    });
    expect(query.mock.calls[2][1]).toEqual([
      casoId,
      sesionId,
      '75.50',
      '2026-11-12',
      'qr',
      'QA-PAGO-FICTICIO-001',
      adminId,
    ]);
    expect(transaction.mock.calls[0][0]).toBe(adminId);
  });

  it('devuelve el pago existente cuando la base confirma coincidencia', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), coincide: true }],
      });

    const resultado = await servicio.registrar(
      casoId, datos(), adminId,
    );

    expect(resultado.reutilizado).toBe(true);
    expect(resultado.pago.id).toBe(pagoId);
    expect(resultado.pago.creadoEn).toEqual(fila().creado_en);
  });

  it('el reintento conserva al autor original aunque lo haga otro admin', async () => {
    const otroAdmin = '00000000-0000-4000-8000-000000000099';
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), coincide: true }],
      });

    const resultado = await servicio.registrar(
      casoId, datos(), otroAdmin,
    );

    expect(resultado.reutilizado).toBe(true);
    expect(resultado.pago.registradoPor).toBe(adminId);
    expect(transaction.mock.calls[0][0]).toBe(otroAdmin);
  });

  it('devuelve 409 si la base informa datos distintos para la sesión', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), coincide: false }],
      });

    await expect(servicio.registrar(casoId, {
      ...datos(),
      monto: '80.00',
    }, adminId)).rejects.toMatchObject({
      status: 409,
      message: 'La sesión ya tiene un pago registrado con otros datos',
    });
  });

  it('devuelve conflicto si no puede recuperar el pago', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(servicio.registrar(casoId, datos(), adminId))
      .rejects.toMatchObject({ status: 409 });
  });

  it('recorta espacios exteriores de la referencia', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [{ id: pagoId }] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), coincide: true }],
      });

    await servicio.registrar(casoId, {
      ...datos(),
      referencia: '  QA-PAGO-FICTICIO-001  ',
    }, adminId);

    expect(query.mock.calls[2][1][5]).toBe('QA-PAGO-FICTICIO-001');
    expect(query.mock.calls[3][1][5]).toBe('QA-PAGO-FICTICIO-001');
  });

  for (const referencia of [undefined, null, '', '   ']) {
    it(`normaliza referencia vacía a null: ${String(referencia)}`, async () => {
      casoYSesion();
      query
        .mockResolvedValueOnce({ rows: [{ id: pagoId }] })
        .mockResolvedValueOnce({
          rows: [{ ...fila(), referencia: null, coincide: true }],
        });

      const resultado = await servicio.registrar(casoId, {
        ...datos(),
        referencia,
      }, adminId);

      expect(query.mock.calls[2][1][5]).toBeNull();
      expect(query.mock.calls[3][1][5]).toBeNull();
      expect(resultado.pago.referencia).toBeNull();
    });
  }

  it('propaga un fallo de inserción sin devolver éxito', async () => {
    casoYSesion();
    query.mockRejectedValueOnce(new Error('Fallo INSERT'));

    await expect(servicio.registrar(casoId, datos(), adminId))
      .rejects.toThrow('Fallo INSERT');
  });

  it('propaga un fallo de lectura posterior al INSERT', async () => {
    casoYSesion();
    query
      .mockResolvedValueOnce({ rows: [{ id: pagoId }] })
      .mockRejectedValueOnce(new Error('Fallo SELECT'));

    await expect(servicio.registrar(casoId, datos(), adminId))
      .rejects.toThrow('Fallo SELECT');
  });
});
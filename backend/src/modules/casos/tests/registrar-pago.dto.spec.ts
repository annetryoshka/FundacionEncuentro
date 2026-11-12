    import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { RegistrarPagoDto } from '../dto/registrar-pago.dto.js';

const datos = () => ({
  sesionId: 'ae29f859-bab1-42c9-83ce-7194c12a46d6',
  monto: '75.50',
  fecha: '2026-11-12',
  metodo: 'qr',
});

async function errores(cambios: Record<string, unknown>) {
  const dto = Object.assign(new RegistrarPagoDto(), datos(), cambios);
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('FE-88: validación de pago', () => {
  for (const monto of ['0.01', '75', '75.5', '75.50', '99999999.99']) {
    it(`acepta monto ${monto}`, async () => {
      expect(await errores({ monto })).toHaveLength(0);
    });
  }

  for (const monto of [
    '0', '0.00', '-1', '75.555', '75,50',
    '100000000', '1e2', 'NaN', '', ' 75.50 ', 75.5, null,
  ]) {
    it(`rechaza monto ${String(monto)}`, async () => {
      expect((await errores({ monto })).length).toBeGreaterThan(0);
    });
  }

  for (const metodo of ['qr', 'transferencia']) {
    it(`acepta método ${metodo}`, async () => {
      expect(await errores({ metodo })).toHaveLength(0);
    });
  }

  it('rechaza efectivo fuera del alcance actual', async () => {
    expect((await errores({ metodo: 'efectivo' })).length)
      .toBeGreaterThan(0);
  });

  for (const fecha of [
    undefined, '2026-02-30', '12/11/2026', '2026-11-12T10:00:00Z',
  ]) {
    it(`rechaza fecha ${String(fecha)}`, async () => {
      expect((await errores({ fecha })).length).toBeGreaterThan(0);
    });
  }

  it('rechaza una sesión con identificador inválido', async () => {
    expect((await errores({ sesionId: 'inventado' })).length)
      .toBeGreaterThan(0);
  });

  it('acepta referencia opcional', async () => {
    expect(await errores({ referencia: 'QA-FICTICIA-001' }))
      .toHaveLength(0);
    expect(await errores({ referencia: null })).toHaveLength(0);
  });

  it('rechaza referencia demasiado larga', async () => {
    expect((await errores({ referencia: 'a'.repeat(501) })).length)
      .toBeGreaterThan(0);
  });

  for (const campo of ['casoId', 'moneda', 'registradoPor']) {
    it(`rechaza el campo adicional ${campo}`, async () => {
      const resultado = await errores({ [campo]: 'inyectado' });
      expect(resultado.some((error) => error.property === campo))
        .toBe(true);
    });
  }
});
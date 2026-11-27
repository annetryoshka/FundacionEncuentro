import { describe, expect, it } from 'vitest';
import { validarMinimosInforme } from '../informe-minimos.js';

describe('validarMinimosInforme', () => {
  it('permite continuar cuando todos los datos requeridos están presentes', () => {
    expect(() =>
      validarMinimosInforme([{ campo: 'datoDePrueba', presente: true }]),
    ).not.toThrow();
  });

  it('devuelve 422 con todos los campos faltantes', () => {
    expect(() =>
      validarMinimosInforme([
        { campo: 'datoPresente', presente: true },
        { campo: 'datoFaltanteA', presente: false },
        { campo: 'datoFaltanteB', presente: false },
      ]),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        response: expect.objectContaining({
          codigo: 'INFORME_DATOS_INSUFICIENTES',
          camposFaltantes: ['datoFaltanteA', 'datoFaltanteB'],
        }),
      }),
    );
  });
});
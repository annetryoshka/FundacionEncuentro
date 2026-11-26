import { describe, expect, it } from 'vitest';
import { validarArchivoGenograma } from '../genograma/genograma-validacion.js';

describe('validarArchivoGenograma', () => {
  const maxBytes = 32;

  it.each([
    { tipo: 'application/pdf', firma: Buffer.from('%PDF-1.7') },
    { tipo: 'image/png', firma: Buffer.from('89504e470d0a1a0a', 'hex') },
    { tipo: 'image/jpeg', firma: Buffer.from('ffd8ff', 'hex') },
  ])('reconoce la firma de $tipo', ({ tipo, firma }) => {
    expect(validarArchivoGenograma(firma, tipo, maxBytes)).toEqual({
      tipo,
      tamanio: firma.length,
    });
  });

  it('rechaza una carga sin archivo con 400', () => {
    expect(() =>
      validarArchivoGenograma(undefined, 'application/pdf', maxBytes),
    ).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('rechaza un archivo que supera el límite con 413', () => {
    const archivo = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(maxBytes)]);

    expect(() =>
      validarArchivoGenograma(archivo, 'application/pdf', maxBytes),
    ).toThrow(expect.objectContaining({ status: 413 }));
  });

  it('rechaza texto presentado como PDF con 415', () => {
    expect(() =>
      validarArchivoGenograma(Buffer.from('Hola'), 'application/pdf', maxBytes),
    ).toThrow(expect.objectContaining({ status: 415 }));
  });
});
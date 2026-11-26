import { describe, expect, it } from 'vitest';
import { verificarPermisoPagos } from '../exportacion-permisos.js';

describe('verificarPermisoPagos', () => {
  it.each(['terapeuta', 'marketing'] as const)(
    'rechaza una solicitud de pagos del rol %s con 403',
    (rol) => {
      expect(() => verificarPermisoPagos({ rol }, true)).toThrow(
        expect.objectContaining({ status: 403 }),
      );
    },
  );

  it('permite que administración solicite incluir pagos', () => {
    expect(() =>
      verificarPermisoPagos({ rol: 'administrador' }, true),
    ).not.toThrow();
  });
});
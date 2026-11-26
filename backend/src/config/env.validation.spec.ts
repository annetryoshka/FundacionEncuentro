import { isAbsolute, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validarEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgres://qa',
  SUPABASE_URL: 'https://qa.invalid',
  SUPABASE_ANON_KEY: 'ficticia',
  SUPABASE_SERVICE_ROLE_KEY: 'ficticia',
};

describe('validarEnv · EXPORTACIONES_DIR', () => {
  it('sin valor usa una carpeta absoluta dentro del backend', () => {
    const { EXPORTACIONES_DIR } = validarEnv(base);
    expect(isAbsolute(EXPORTACIONES_DIR)).toBe(true);
    expect(EXPORTACIONES_DIR.endsWith(join('almacenamiento', 'exportaciones'))).toBe(true);
  });

  it('respeta una ruta absoluta configurada', () => {
    const ruta = join(process.cwd(), 'otra-carpeta');
    expect(validarEnv({ ...base, EXPORTACIONES_DIR: ` ${ruta} ` }).EXPORTACIONES_DIR).toBe(ruta);
  });

  it('rechaza una ruta relativa al arrancar', () => {
    expect(() => validarEnv({ ...base, EXPORTACIONES_DIR: 'exportaciones' })).toThrow(
      'EXPORTACIONES_DIR debe ser una ruta absoluta.',
    );
  });
});

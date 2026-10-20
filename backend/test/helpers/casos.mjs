import 'reflect-metadata';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../../dist/modules/auth/auth.module.js';
import { CasosModule } from '../../dist/modules/casos/casos.module.js';
import { DatabaseService } from '../../dist/database/database.service.js';

export const actor = '00000000-0000-4000-8000-000000000001';
export const datos = (nombre = 'Paciente ficticio QA', tipo = 'voluntario') => ({
  paciente: { nombreCompleto: nombre }, caso: { tipo, fechaIngreso: '2020-01-01' },
});
export async function servidor(db) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const destino = new URL(url);
    if (destino.hostname === '127.0.0.1') return original(url, init);
    if (String(url) === 'https://auth.invalid/auth/v1/user') {
      return Response.json({ id: actor }, { status: init.headers.Authorization === 'Bearer fixture' ? 200 : 401 });
    }
    throw new Error('Salida externa no permitida en prueba');
  };
  class Infraestructura {}
  Global()(Infraestructura);
  Module({ providers: [
    { provide: DatabaseService, useValue: db },
    { provide: ConfigService, useValue: { getOrThrow: (key) => ({
      SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'ficticia',
    })[key] } },
  ], exports: [DatabaseService, ConfigService] })(Infraestructura);
  class Aplicacion {}
  Module({ imports: [Infraestructura, AuthModule, CasosModule] })(Aplicacion);
  let app;
  try {
    app = await NestFactory.create(Aplicacion, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    return {
      post: (body) => fetch(`${base}/api/casos`, { method: 'POST',
        headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) }),
      get: (id) => fetch(`${base}/api/casos/${id}`, {
        headers: { Authorization: 'Bearer fixture' }, signal: AbortSignal.timeout(15_000) }),
      close: async () => { try { await app.close(); } finally { globalThis.fetch = original; } },
    };
  } catch (error) {
    try { await app?.close(); } finally { globalThis.fetch = original; }
    throw error;
  }
}

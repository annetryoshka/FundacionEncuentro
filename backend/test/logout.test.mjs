// FE-27: NestJS real por HTTP; Supabase y PostgreSQL son dobles sin credenciales.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../dist/modules/auth/auth.module.js';
import { CasosModule } from '../dist/modules/casos/casos.module.js';
import { DatabaseService } from '../dist/database/database.service.js';

const id = '00000000-0000-4000-8000-000000000001';
const fetchReal = globalThis.fetch;
let app, base, logoutStatus, userStatus, refreshStatus, networkFailure, auditFailure, role;
let auditorias, llamadas, consultasClinicas;
const db = {
  async query(sql, params) {
    if (sql.startsWith('select id, nombre_completo')) {
      return { rows: [{ id, nombre_completo: 'Cuenta ficticia', rol: role, activo: true }] };
    }
    if (sql.includes('insert into auditoria')) {
      if (auditFailure) throw new Error('Auditoría no disponible (simulada)');
      auditorias.push({ sql, params });
      return { rows: [] };
    }
    consultasClinicas++;
    if (sql.includes('count(*)')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  },
};
class InfraestructuraPrueba {}
Global()(InfraestructuraPrueba);
Module({
  providers: [
    { provide: DatabaseService, useValue: db },
    { provide: ConfigService, useValue: { getOrThrow: (key) => ({
      SUPABASE_URL: 'https://supabase.invalid', SUPABASE_ANON_KEY: 'clave-ficticia',
    })[key] } },
  ],
  exports: [DatabaseService, ConfigService],
})(InfraestructuraPrueba);
class AplicacionPrueba {}
Module({ imports: [InfraestructuraPrueba, AuthModule, CasosModule] })(AplicacionPrueba);

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://supabase.invalid/')) return fetchReal(url, init);
    const ruta = new URL(url).pathname;
    llamadas.push({ url: String(url), init });
    if (ruta.endsWith('/logout')) {
      if (networkFailure) throw new TypeError('Red interrumpida (simulada)');
      return new Response(null, { status: logoutStatus });
    }
    if (ruta.endsWith('/user')) {
      const valido = init.headers.Authorization === 'Bearer acceso-ficticio';
      return Response.json(valido ? { id } : {}, { status: valido ? userStatus : 401 });
    }
    if (ruta.endsWith('/token')) return Response.json({}, { status: refreshStatus });
    throw new Error('Ruta externa inesperada');
  };
  app = await NestFactory.create(AplicacionPrueba, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
beforeEach(() => {
  logoutStatus = 204; userStatus = 200; refreshStatus = 400;
  networkFailure = false; auditFailure = false; role = 'administrador';
  auditorias = []; llamadas = []; consultasClinicas = 0;
});
after(async () => {
  try { await app?.close(); } finally { globalThis.fetch = fetchReal; }
});
const solicitar = (ruta, { token = 'acceso-ficticio', method = 'GET', body } = {}) =>
  fetch(`${base}/api${ruta}`, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body ? JSON.stringify(body) : undefined });

test('logout 204 utiliza scope local y registra una auditoría asociada al usuario', async () => {
  const respuesta = await solicitar('/auth/logout', { method: 'POST' });
  assert.equal(respuesta.status, 204);
  assert.equal(await respuesta.text(), '');
  const salida = llamadas.find((c) => c.url.includes('/logout'));
  assert.equal(new URL(salida.url).searchParams.get('scope'), 'local');
  assert.equal(salida.init.method, 'POST');
  assert.equal(salida.init.headers.Authorization, 'Bearer acceso-ficticio');
  assert.equal(auditorias.length, 1);
  assert.match(auditorias[0].sql, /'LOGOUT', 'auth'/);
  assert.deepEqual(auditorias[0].params, [id]);
});

for (const status of [400, 401, 403]) {
  test(`DEFECTO FE-26: Supabase ${status} se convierte en 204 y auditoría de éxito`, async () => {
    logoutStatus = status;
    assert.equal((await solicitar('/auth/logout', { method: 'POST' })).status, 204);
    assert.equal(auditorias.length, 1);
  });
}
for (const modo of ['500', 'red']) {
  test(`Supabase ${modo}: responde 503 y no registra LOGOUT`, async () => {
    logoutStatus = 500; networkFailure = modo === 'red';
    assert.equal((await solicitar('/auth/logout', { method: 'POST' })).status, 503);
    assert.equal(auditorias.length, 0);
  });
}

for (const [method, ruta] of [
  ['POST', '/auth/logout'], ['GET', '/auth/me'], ['GET', '/casos'],
  ['GET', `/casos/${id}`], ['POST', '/casos'],
]) {
  for (const token of [null, 'invalido-ficticio']) {
    test(`${method} ${ruta}: rechaza ${token ? 'token inválido' : 'ausencia de token'}`, async () => {
      assert.equal((await solicitar(ruta, { method, token })).status, 401);
      assert.equal(consultasClinicas, 0);
      assert.equal(auditorias.length, 0);
      assert.equal(llamadas.some((c) => c.url.includes('/logout')), false);
    });
  }
}

test('casos permite admin autenticado y rechaza marketing con 403', async () => {
  assert.equal((await solicitar('/casos')).status, 200);
  assert.ok(consultasClinicas > 0);
  consultasClinicas = 0; role = 'marketing';
  assert.equal((await solicitar('/casos')).status, 403);
  assert.equal(consultasClinicas, 0);
});

test('si /user sigue aceptando el access token tras logout, el guard permite su reutilización (mock)', async () => {
  assert.equal((await solicitar('/auth/logout', { method: 'POST' })).status, 204);
  assert.equal((await solicitar('/casos')).status, 200);
  userStatus = 401;
  assert.equal((await solicitar('/casos')).status, 401);
});

test('refresh rechazado por Supabase se propaga como 401 sin auditoría LOGOUT (mock)', async () => {
  assert.equal((await solicitar('/auth/logout', { method: 'POST' })).status, 204);
  auditorias = [];
  const res = await solicitar('/auth/refresh', { method: 'POST', token: null,
    body: { refreshToken: 'refresh-ficticio-anterior' } });
  assert.equal(res.status, 401);
  assert.equal(auditorias.length, 0);
  const peticion = llamadas.find((c) => c.url.includes('grant_type=refresh_token'));
  assert.deepEqual(JSON.parse(peticion.init.body), { refresh_token: 'refresh-ficticio-anterior' });
});

test('fallo de auditoría después de revocación responde 500 sin revertir la llamada remota', async () => {
  auditFailure = true;
  assert.equal((await solicitar('/auth/logout', { method: 'POST' })).status, 500);
  assert.equal(llamadas.filter((c) => c.url.includes('/logout')).length, 1);
  assert.equal(auditorias.length, 0);
});

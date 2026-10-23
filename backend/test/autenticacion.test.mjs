import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../dist/modules/auth/auth.module.js';
import { UsuariosModule } from '../dist/modules/usuarios/usuarios.module.js';
import { DatabaseService } from '../dist/database/database.service.js';

const roles = ['administrador', 'terapeuta', 'marketing'];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fetchReal = globalThis.fetch;
let app, base, perfiles, entradas, auditoria, logs, secretos;
let password, accessToken, refreshToken, hash, sujeto, estadoLogin, estadoUsuario, estadoRefresh, sinRed;
const db = {
  async query(sql, params) {
    entradas.push({ sql, params });
    if (sql.startsWith('select id, nombre_completo, rol, activo')) {
      const p = perfiles.get(params[0]);
      return { rows: p ? [{ ...p }] : [] };
    }
    if (sql.includes('insert into auditoria')) {
      auditoria.push({ sql, params });
      return { rows: [] };
    }
    if (sql.includes('join auth.users')) return { rows: [] };
    throw new Error('Consulta no prevista en la base simulada');
  },
};
class InfraestructuraPrueba {}
Global()(InfraestructuraPrueba);
Module({ providers: [
  { provide: DatabaseService, useValue: db },
  { provide: ConfigService, useValue: { getOrThrow: (key) => ({
    SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'clave-inventada',
    SUPABASE_SERVICE_ROLE_KEY: 'clave-admin-inventada',
  })[key] } },
], exports: [DatabaseService, ConfigService] })(InfraestructuraPrueba);
class AplicacionPrueba {}
Module({ imports: [InfraestructuraPrueba, AuthModule, UsuariosModule] })(AplicacionPrueba);

before(async () => {
  const logger = Object.fromEntries(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']
    .map((nivel) => [nivel, (...args) => logs?.push(args.map(String).join(' '))]));
  globalThis.fetch = async (url, init) => {
    const destino = new URL(url);
    if (destino.hostname === '127.0.0.1') return fetchReal(url, init);
    // Evita cualquier salida accidental a servicios o credenciales reales.
    assert.equal(destino.origin, 'https://auth.invalid');
    if (sinRed) throw new TypeError('Fallo de red simulado');
    const grant = destino.searchParams.get('grant_type');
    if (destino.pathname === '/auth/v1/token') {
      const body = JSON.parse(init.body);
      const renovando = grant === 'refresh_token';
      assert.ok(renovando ? body.refresh_token === refreshToken : body.password === password,
        'El cliente debe enviar la credencial ficticia al proveedor');
      const estado = renovando ? estadoRefresh : estadoLogin;
      return Response.json(estado === 200 ? {
        access_token: accessToken, refresh_token: refreshToken, expires_in: 3600,
        user: { id: sujeto, encrypted_password: hash, user_metadata: { rol: 'administrador' } },
      } : { message: `Detalle externo sensible ${hash}` }, { status: estado });
    }
    if (destino.pathname === '/auth/v1/user') {
      const aceptado = init.headers.Authorization === `Bearer ${accessToken}`;
      return Response.json({ id: sujeto, encrypted_password: hash,
        user_metadata: { rol: 'administrador' } }, { status: aceptado ? estadoUsuario : 401 });
    }
    throw new Error('Ruta de Supabase no prevista');
  };
  app = await NestFactory.create(AplicacionPrueba, { logger });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
beforeEach(() => {
  // Credenciales efímeras generadas en memoria, nunca guardadas en Git o evidencias.
  [password, accessToken, refreshToken, hash] = Array.from({ length: 4 }, () => randomBytes(24).toString('hex'));
  secretos = [password, accessToken, refreshToken, hash];
  perfiles = new Map(roles.map((rol, i) => [id(i + 1), {
    id: id(i + 1), nombre_completo: `Cuenta ficticia ${rol}`, rol, activo: true,
  }]));
  entradas = []; auditoria = []; logs = [];
  sujeto = id(1); estadoLogin = 200; estadoRefresh = 200; estadoUsuario = 200; sinRed = false;
});
afterEach(() => {
  const salida = logs.join('\n');
  assert.ok(secretos.every((s) => !salida.includes(s)), 'Los logs capturados no deben exponer secretos');
  assert.ok(secretos.every((s) => !JSON.stringify(entradas).includes(s)),
    'Las consultas de perfil y auditoría no deben persistir credenciales');
});
after(async () => { try { await app?.close(); } finally { globalThis.fetch = fetchReal; } });

const pedir = (ruta, { method = 'GET', body, token = accessToken, headers = {} } = {}) =>
  fetch(`${base}/api${ruta}`, { method, headers: {
    ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers,
  }, body: body ? JSON.stringify(body) : undefined });
const login = () => pedir('/auth/login', { method: 'POST', token: null,
  body: { email: 'cuenta-ficticia@example.test', password } });
const renovar = () => pedir('/auth/refresh', { method: 'POST', token: null, body: { refreshToken } });
async function comprobarError(res, status, message) {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.equal(body.message, message);
  const texto = JSON.stringify(body);
  assert.ok(secretos.every((s) => !texto.includes(s)), 'El error no debe contener secretos');
  assert.equal(auditoria.length, 0);
}
function comprobarSesion(body, rol) {
  assert.deepEqual(Object.keys(body).sort(), ['accessToken', 'expiresIn', 'refreshToken', 'usuario']);
  assert.ok(body.accessToken === accessToken, 'Access token de sesión esperado, sin imprimir su valor');
  assert.ok(body.refreshToken === refreshToken, 'Refresh token de sesión esperado, sin imprimir su valor');
  assert.equal(body.expiresIn, 3600);
  assert.deepEqual(body.usuario, { id: sujeto, nombreCompleto: perfiles.get(sujeto).nombre_completo, rol });
  // Los tokens solo pertenecen a la respuesta de sesión, no al perfil o a la auditoría.
  assert.ok(!JSON.stringify(body).includes(password) && !JSON.stringify(body).includes(hash),
    'La sesión no debe incluir contraseña ni hash del proveedor');
}

for (const [indice, rol] of roles.entries()) {
  test(`cuenta activa ${rol}: login 200 y perfil/rol recuperados desde DB`, async () => {
    sujeto = id(indice + 1);
    const res = await login();
    assert.equal(res.status, 200); comprobarSesion(await res.json(), rol);
    assert.equal(auditoria.length, 1);
    assert.match(auditoria[0].sql, /'LOGIN', 'auth'/);
    assert.deepEqual(auditoria[0].params, [sujeto]);
    const me = await pedir('/auth/me');
    assert.equal(me.status, 200);
    const identidad = await me.json();
    assert.deepEqual(identidad, { id: sujeto, nombreCompleto: perfiles.get(sujeto).nombre_completo, rol });
    assert.ok(secretos.every((s) => !JSON.stringify(identidad).includes(s)), 'Identidad sin secretos');
    assert.ok(entradas.filter((e) => e.sql.startsWith('select id')).every((e) => e.params[0] === sujeto));
  });
}
for (const status of [400, 401]) {
  test(`credenciales rechazadas por proveedor (${status}): 401 con mensaje propio`, async () => {
    estadoLogin = status;
    await comprobarError(await login(), 401, 'Correo o contraseña incorrectos');
    assert.equal(entradas.length, 0);
  });
}
for (const modo of ['inactiva', 'sin perfil']) {
  test(`${modo}: login, identidad y refresh se rechazan con 403`, async () => {
    if (modo === 'inactiva') perfiles.get(sujeto).activo = false;
    else perfiles.delete(sujeto);
    for (const res of [await login(), await pedir('/auth/me'), await renovar()]) {
      await comprobarError(res, 403, 'Tu usuario no tiene acceso al sistema');
    }
  });
}
test('token ausente: 401 antes de consultar el perfil', async () => {
  await comprobarError(await pedir('/auth/me', { token: null }), 401, 'Falta iniciar sesión');
  assert.equal(entradas.length, 0);
});
test('esquema de autenticación incorrecto: 401', async () => {
  await comprobarError(await pedir('/auth/me', { headers: { Authorization: 'Basic inventado' } }),
    401, 'Falta iniciar sesión');
});
test('token inválido: 401 sin exponer detalles externos', async () => {
  await comprobarError(await pedir('/auth/me', { token: 'credencial-inventada-invalida' }),
    401, 'Sesión inválida o expirada');
  assert.equal(entradas.length, 0);
});
test('token expirado según el proveedor simulado: 401 y sin consulta de perfil', async () => {
  estadoUsuario = 401;
  await comprobarError(await pedir('/auth/me'), 401, 'Sesión inválida o expirada');
  assert.equal(entradas.length, 0);
});
test('admin accede a operación protegida y no recibe secretos', async () => {
  const res = await pedir('/usuarios');
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), []);
});
for (const i of [1, 2]) {
  test(`${roles[i]}: operación administrativa devuelve 403 aunque envíe rol en cabecera`, async () => {
    sujeto = id(i + 1);
    await comprobarError(await pedir('/usuarios', { headers: { 'X-Rol': 'administrador' } }),
      403, 'No tienes permiso para realizar esta acción');
  });
}
test('operación administrativa sin autenticación: 401', async () => {
  await comprobarError(await pedir('/usuarios', { token: null }), 401, 'Falta iniciar sesión');
});
test('desactivar el perfil bloquea el token ya emitido en la siguiente petición', async () => {
  assert.equal((await pedir('/auth/me')).status, 200);
  perfiles.get(sujeto).activo = false;
  await comprobarError(await pedir('/usuarios'), 403, 'Tu usuario no tiene acceso al sistema');
});
test('cambiar el rol persistido limita el token anterior sin confiar en metadata externa', async () => {
  assert.equal((await pedir('/usuarios')).status, 200);
  perfiles.get(sujeto).rol = 'marketing';
  await comprobarError(await pedir('/usuarios'), 403, 'No tienes permiso para realizar esta acción');
});
test('refresh válido recupera el perfil actual, no un rol anterior', async () => {
  perfiles.get(sujeto).rol = 'terapeuta';
  const res = await renovar();
  assert.equal(res.status, 200); comprobarSesion(await res.json(), 'terapeuta');
  assert.equal(auditoria.length, 0);
});
test('access token expirado no impide renovar con refresh válido', async () => {
  estadoUsuario = 401;
  await comprobarError(await pedir('/auth/me'), 401, 'Sesión inválida o expirada');
  const res = await renovar();
  assert.equal(res.status, 200); comprobarSesion(await res.json(), 'administrador');
});
test('refresh inválido: 401, sin sesión ni consulta de perfil', async () => {
  estadoRefresh = 400;
  await comprobarError(await renovar(), 401, 'La sesión expiró, inicia sesión de nuevo');
  assert.equal(entradas.length, 0);
});
test('login con rol inyectado: DTO devuelve 400 antes de autenticar', async () => {
  const res = await pedir('/auth/login', { method: 'POST', token: null,
    body: { email: 'cuenta-ficticia@example.test', password, rol: 'administrador' } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(Array.isArray(body.message));
  assert.equal(entradas.length, 0);
});
for (const fallo of ['red', '500']) {
  test(`fallo externo ${fallo}: login y recurso protegido devuelven 503 saneado`, async () => {
    sinRed = fallo === 'red'; estadoLogin = 500; estadoUsuario = 500;
    for (const res of [await login(), await pedir('/auth/me')]) {
      await comprobarError(res, 503, 'No se pudo contactar el servicio de autenticación');
    }
  });
}
test('rate limit de login: 429 sin consultar perfil ni exponer el cuerpo externo', async () => {
  estadoLogin = 429;
  await comprobarError(await login(), 429, 'Demasiados intentos, espera un momento');
  assert.equal(entradas.length, 0);
});

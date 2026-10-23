// FE-30: módulos Nest reales por HTTP; Auth, administración Supabase y DB simulados.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../dist/modules/auth/auth.module.js';
import { UsuariosModule } from '../dist/modules/usuarios/usuarios.module.js';
import { CasosModule } from '../dist/modules/casos/casos.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { ROLES_VALIDOS } from '../dist/modules/usuarios/dto/crear-usuario.dto.js';

const roles = ['administrador', 'terapeuta', 'marketing'];
const identificador = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Exclusivamente valores ficticios; no se imprimen en evidencias.
const claveFicticia = 'SoloFixture123!';
const fetchReal = globalThis.fetch;
let app, base, cuentas, sesiones, llamadas, escrituras, errorPerfil, errorAdmin, siguiente;
const perfil = (u) => ({ id: u.id, nombre_completo: u.nombreCompleto, rol: u.rol,
  activo: u.activo, email: u.email, creado_en: '2026-10-16T12:00:00Z' });
const db = {
  async query(sql, params = []) {
    if (sql.startsWith('select id, nombre_completo')) {
      const u = cuentas.get(params[0]);
      return { rows: u?.rol ? [perfil(u)] : [] };
    }
    if (sql.includes('join auth.users')) {
      const lista = sql.includes('where p.id') ? [cuentas.get(params[0])] : [...cuentas.values()];
      return { rows: lista.filter((u) => u?.rol).map(perfil) };
    }
    if (sql.includes('insert into auditoria')) return { rows: [] };
    if (sql.includes('count(*)')) return { rows: [{ total: '0' }] };
    if (sql.includes('from casos')) return { rows: [] };
    throw new Error('Consulta no prevista en el doble de DB');
  },
  async transaction(actor, callback) {
    escrituras.push(actor);
    return callback({ query: async (sql, params) => {
      if (errorPerfil) throw new Error('Fallo simulado de perfil');
      if (sql.startsWith('insert into perfiles')) {
        Object.assign(cuentas.get(params[0]), { nombreCompleto: params[1], rol: params[2], activo: true });
      } else if (sql.startsWith('update perfiles')) {
        const u = cuentas.get(params.at(-1));
        for (const match of sql.matchAll(/(nombre_completo|rol|activo) = \$(\d+)/g)) {
          u[match[1] === 'nombre_completo' ? 'nombreCompleto' : match[1]] = params[Number(match[2]) - 1];
        }
      } else throw new Error('Escritura no prevista');
      return { rows: [] };
    } });
  },
};
class InfraestructuraPrueba {}
Global()(InfraestructuraPrueba);
Module({ providers: [
  { provide: DatabaseService, useValue: db },
  { provide: ConfigService, useValue: { getOrThrow: (key) => ({
    SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'ficticia',
    SUPABASE_SERVICE_ROLE_KEY: 'administracion-ficticia',
  })[key] } },
], exports: [DatabaseService, ConfigService] })(InfraestructuraPrueba);
class AplicacionPrueba {}
Module({ imports: [InfraestructuraPrueba, AuthModule, UsuariosModule, CasosModule] })(AplicacionPrueba);

function abrirSesion(u) {
  const token = `fixture-${u.id}`;
  sesiones.set(token, u.id);
  return { access_token: token, refresh_token: `refresh-${token}`, expires_in: 3600, user: { id: u.id } };
}
before(async () => {
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://auth.invalid/')) return fetchReal(url, init);
    const ruta = new URL(url);
    llamadas.push({ ruta: ruta.pathname, method: init.method });
    const body = init.body ? JSON.parse(init.body) : {};
    if (ruta.pathname === '/auth/v1/admin/users' && init.method === 'POST') {
      if (errorAdmin) return Response.json(errorAdmin.body, { status: errorAdmin.status });
      // Modelo del proveedor: NO es una verificación del índice desplegado en Supabase.
      const email = body.email.toLowerCase();
      if ([...cuentas.values()].some((u) => u.email.toLowerCase() === email)) {
        return Response.json({ code: 'email_exists' }, { status: 422 });
      }
      const id = identificador(siguiente++);
      cuentas.set(id, { id, email, password: body.password });
      return Response.json({ id }, { status: 201 });
    }
    if (ruta.pathname.startsWith('/auth/v1/admin/users/') && init.method === 'DELETE') {
      cuentas.delete(ruta.pathname.split('/').at(-1));
      return new Response(null, { status: 204 });
    }
    if (ruta.pathname === '/auth/v1/token') {
      const u = ruta.searchParams.get('grant_type') === 'refresh_token'
        ? cuentas.get(sesiones.get(String(body.refresh_token).replace(/^refresh-/, '')))
        : [...cuentas.values()].find((u) => u.email.toLowerCase() === String(body.email).toLowerCase()
          && u.password === body.password);
      return u ? Response.json(abrirSesion(u)) : Response.json({}, { status: 400 });
    }
    if (ruta.pathname === '/auth/v1/user') {
      const id = sesiones.get(init.headers.Authorization?.replace(/^Bearer /, ''));
      // Incluye metadata hostil: el rol confiable debe salir del perfil de DB.
      return Response.json(id ? { id, user_metadata: { rol: 'administrador' } } : {}, { status: id ? 200 : 401 });
    }
    throw new Error('Llamada externa no prevista');
  };
  app = await NestFactory.create(AplicacionPrueba, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
beforeEach(() => {
  cuentas = new Map(); sesiones = new Map(); llamadas = []; escrituras = [];
  errorPerfil = false; errorAdmin = null; siguiente = 10;
  roles.forEach((rol, i) => {
    const u = { id: identificador(i + 1), email: `${rol}@example.test`, password: claveFicticia,
      nombreCompleto: `Cuenta ${rol}`, rol, activo: true };
    cuentas.set(u.id, u); abrirSesion(u);
  });
});
after(async () => { try { await app?.close(); } finally { globalThis.fetch = fetchReal; } });
const solicitar = (ruta, { method = 'GET', rol = 'administrador', token, body, headers = {} } = {}) =>
  fetch(`${base}/api${ruta}`, { method, headers: {
    ...(token === null ? {} : { Authorization: `Bearer ${token ?? `fixture-${identificador(roles.indexOf(rol) + 1)}`}` }),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers,
  }, body: body ? JSON.stringify(body) : undefined });
const datosCuenta = (rol = 'terapeuta') => ({ email: 'nueva@example.test', password: claveFicticia,
  nombreCompleto: 'Cuenta Nueva', rol });
const login = (email, password = claveFicticia, extra = {}) => solicitar('/auth/login', {
  method: 'POST', token: null, body: { email, password, ...extra },
});

test('los roles del DTO coinciden exactamente con los tres roles inspeccionados', () => {
  assert.deepEqual([...ROLES_VALIDOS], roles);
});
for (const rol of roles) {
  test(`creación y login de cuenta ${rol}: rol de perfil y respuesta sin contraseña`, async () => {
    const res = await solicitar('/usuarios', { method: 'POST', body: datosCuenta(rol) });
    assert.equal(res.status, 201);
    const creada = await res.json();
    assert.equal(creada.rol, rol); assert.equal(creada.activo, true);
    assert.equal('password' in creada, false);
    assert.deepEqual(escrituras, [identificador(1)]);
    const acceso = await login(datosCuenta().email);
    assert.equal(acceso.status, 200);
    const sesion = await acceso.json();
    assert.equal(sesion.usuario.rol, rol);
    assert.equal('password' in sesion, false);
    assert.equal((await solicitar('/auth/me', { token: sesion.accessToken })).status, 200);
  });
}
for (const email of ['terapeuta@example.test', 'TERAPEUTA@EXAMPLE.TEST', 'TeRaPeUtA@example.test']) {
  test(`duplicidad de correo, variante ${email === email.toLowerCase() ? 'exacta' : email === email.toUpperCase() ? 'mayúsculas' : 'mixta'}: 409 con proveedor simulado`, async () => {
    assert.equal((await solicitar('/usuarios', { method: 'POST', body: { ...datosCuenta(), email } })).status, 409);
    assert.equal(cuentas.size, 3); assert.equal(escrituras.length, 0);
  });
}
for (const status of [409, 422]) for (const code of ['email_exists', 'user_already_exists']) {
  test(`duplicidad del proveedor ${status}/${code} se traduce a 409`, async () => {
    errorAdmin = { status, body: { code } };
    assert.equal((await solicitar('/usuarios', { method: 'POST', body: datosCuenta() })).status, 409);
    assert.equal(escrituras.length, 0);
  });
}

const operaciones = [
  ['GET', '/usuarios'], ['GET', `/usuarios/${identificador(2)}`],
  ['POST', '/usuarios', datosCuenta()],
  ['PATCH', `/usuarios/${identificador(2)}`, { rol: 'administrador' }],
  ['GET', '/casos'], ['GET', `/casos/${identificador(9)}`],
  ['POST', '/casos', {}],
];
for (const [method, ruta, body] of operaciones) {
  for (const rol of ['terapeuta', 'marketing']) {
    test(`${rol}: ${method} ${ruta} devuelve 403 sin escrituras`, async () => {
      const res = await solicitar(ruta, { method, rol, body, headers: { 'X-Rol': 'administrador' } });
      assert.equal(res.status, 403); assert.equal(escrituras.length, 0);
      assert.equal(llamadas.some((c) => c.ruta.includes('/admin/')), false);
    });
  }
  test(`sin autenticación: ${method} ${ruta} devuelve 401`, async () => {
    assert.equal((await solicitar(ruta, { method, token: null, body })).status, 401);
    assert.equal(escrituras.length, 0); assert.equal(llamadas.length, 0);
  });
}
test('admin puede listar, consultar, editar y desactivar otra cuenta', async () => {
  assert.equal((await solicitar('/usuarios')).status, 200);
  assert.equal((await solicitar(`/usuarios/${identificador(2)}`)).status, 200);
  const editada = await solicitar(`/usuarios/${identificador(2)}`, {
    method: 'PATCH', body: { rol: 'marketing', activo: false },
  });
  assert.equal(editada.status, 200);
  const u = await editada.json(); assert.equal(u.rol, 'marketing'); assert.equal(u.activo, false);
  assert.equal((await solicitar('/casos')).status, 200);
});
test('admin no puede desactivarse ni quitarse su rol', async () => {
  for (const body of [{ activo: false }, { rol: 'terapeuta' }]) {
    assert.equal((await solicitar(`/usuarios/${identificador(1)}`, { method: 'PATCH', body })).status, 400);
  }
  assert.equal(escrituras.length, 0);
});
test('token alterado no permite elevar privilegios', async () => {
  assert.equal((await solicitar('/usuarios', { token: 'alterado-inventado' })).status, 401);
  assert.equal(escrituras.length, 0);
});
test('edición administrativa rechaza rol desconocido y campos fuera del DTO', async () => {
  for (const body of [{ rol: 'rol-no-definido' }, { email: 'otro@example.test' },
    { usuario: { rol: 'administrador' } }]) {
    assert.equal((await solicitar(`/usuarios/${identificador(2)}`, { method: 'PATCH', body })).status, 400);
  }
  assert.equal(escrituras.length, 0);
});
test('inyectar rol o usuario en login no crea sesión: DTO rechaza campos adicionales', async () => {
  const res = await login('marketing@example.test', claveFicticia,
    { rol: 'administrador', usuario: { rol: 'administrador' } });
  assert.equal(res.status, 400); assert.equal(llamadas.length, 0);
});
test('cuenta inactiva: login, refresh y peticiones con token anterior reciben 403', async () => {
  cuentas.get(identificador(2)).activo = false;
  assert.equal((await login('terapeuta@example.test')).status, 403);
  assert.equal((await solicitar('/auth/me', { rol: 'terapeuta' })).status, 403);
  assert.equal((await solicitar('/auth/refresh', { method: 'POST', token: null,
    body: { refreshToken: `refresh-fixture-${identificador(2)}` } })).status, 403);
});
test('perfil inexistente no permite login ni utilizar el token', async () => {
  cuentas.get(identificador(2)).rol = undefined;
  assert.equal((await login('terapeuta@example.test')).status, 403);
  assert.equal((await solicitar('/auth/me', { rol: 'terapeuta' })).status, 403);
});
test('credenciales incorrectas reciben 401', async () => {
  assert.equal((await login('terapeuta@example.test', 'valor-incorrecto')).status, 401);
});
for (const body of [
  { ...datosCuenta(), rol: 'rol-no-definido' },
  { ...datosCuenta(), usuario: { rol: 'administrador' } },
  { ...datosCuenta(), password: 'Abcd1234' },
]) {
  test(`DTO creación rechaza ${body.usuario ? 'campos adicionales' : body.rol === 'rol-no-definido' ? 'rol desconocido' : 'contraseña de 8 caracteres aceptada por frontend'}`, async () => {
    assert.equal((await solicitar('/usuarios', { method: 'POST', body })).status, 400);
    assert.equal(llamadas.some((c) => c.ruta.includes('/admin/')), false);
  });
}
test('fallo al crear perfil deshace la cuenta Auth simulada', async () => {
  errorPerfil = true;
  assert.equal((await solicitar('/usuarios', { method: 'POST', body: datosCuenta() })).status, 500);
  assert.equal(cuentas.size, 3);
  assert.equal(llamadas.filter((c) => c.method === 'DELETE').length, 1);
});
test('listado backend devuelve { usuarios } como espera el frontend', async () => {
  const res = await solicitar('/usuarios');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(Array.isArray(body.usuarios), true);
  assert.equal(body.usuarios.some((u) => 'password' in u), false);
});

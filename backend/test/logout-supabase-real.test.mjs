// FE-193: logout, tokens y permisos contra Supabase QA REAL (FE-118 / FE-192).
//
// No corre en `npm test` normal: se salta salvo que se active a propósito con
//   FE_SUPABASE_QA=1  y  FE_QA_PASSWORD=<contraseña de las cuentas demo de QA>
// Opcionales: FE_QA_EMAIL (por defecto direccion@fundacion.test, administrador)
//             FE_QA_EMAIL_MARKETING (por defecto apoyo@fundacion.test, marketing)
//
// Qué es real y qué no:
// - Backend NestJS real (AppModule completo, guards, servicios) leyendo backend/.env.
// - Supabase Auth real y PostgreSQL real (la base de backend/.env) para login, refresh,
//   /user, logout y la auditoría.
// - Entre el backend y Supabase hay un proxy local transparente. Solo cuando una prueba
//   lo pide, el proxy NO reenvía el logout y devuelve un fallo controlado (500, 400 o
//   conexión detenida). Así se prueban 502/503/504 con un token real sin romper Supabase.
//
// Seguridad: nunca se imprimen ni se guardan tokens, contraseñas ni correos. El archivo de
// resultados solo tiene códigos HTTP, tiempos y veredictos.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';

const habilitada = process.env.FE_SUPABASE_QA === '1' && Boolean(process.env.FE_QA_PASSWORD);
const opciones = {
  skip: habilitada
    ? false
    : 'Requiere FE_SUPABASE_QA=1 y FE_QA_PASSWORD (ver docs/pruebas/sprint-3/logout-supabase.md)',
  timeout: 60_000,
};

const PLAZO_BACKEND_MS = 5_000; // SUPABASE_AUTH_TIMEOUT_MS de supabase-auth.client.ts
const EMAIL = process.env.FE_QA_EMAIL ?? 'direccion@fundacion.test';
const EMAIL_MARKETING = process.env.FE_QA_EMAIL_MARKETING ?? 'apoyo@fundacion.test';
const PASSWORD = process.env.FE_QA_PASSWORD;
const fetchReal = globalThis.fetch;

let app, base, proxy, db, supabaseReal;
let modoLogout = 'pasar'; // 'pasar' | 'detener' | código HTTP a devolver
let pedidosProxy = 0;
const detenidas = [];
const resultados = [];
// Sesiones reales: solo viven en memoria durante la ejecución.
let sesionA, sesionB, usuarioId;

// --- utilidades -------------------------------------------------------------

async function api(ruta, { method = 'GET', token, body } = {}) {
  const inicio = performance.now();
  const res = await fetchReal(`${base}/api${ruta}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Math.round(performance.now() - inicio);
  const datos = await res.json().catch(() => null);
  return { status: res.status, ms, datos };
}

async function login(email) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(r.status, 200, `login de cuenta QA respondió ${r.status} (revisa FE_QA_PASSWORD / npm run datos:demo)`);
  return { access: r.datos.accessToken, refresh: r.datos.refreshToken, usuario: r.datos.usuario };
}

async function ahoraDb() {
  return (await db.query('select now() as t')).rows[0].t;
}

async function logoutsDesde(desde) {
  const { rows } = await db.query(
    `select count(*)::int as n from auditoria
      where usuario_id = $1 and accion = 'LOGOUT' and tabla = 'auth' and creado_en >= $2`,
    [usuarioId, desde],
  );
  return rows[0].n;
}

function registrar(id, escenario, fuente, esperado, observado, veredicto, ms) {
  resultados.push({ id, escenario, fuente, esperado, observado, veredicto, ms: ms ?? null });
}

// --- preparación ------------------------------------------------------------

before(async () => {
  if (!habilitada) return;
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  supabaseReal = process.env.SUPABASE_URL.replace(/\/+$/, '');

  // Proxy local: reenvía todo a Supabase real salvo el logout cuando se inyecta un fallo.
  proxy = http.createServer(async (req, res) => {
    pedidosProxy++;
    const partes = [];
    for await (const parte of req) partes.push(parte);
    if (req.url.startsWith('/auth/v1/logout') && modoLogout !== 'pasar') {
      if (modoLogout === 'detener') {
        detenidas.push(res); // nunca responde: simula una conexión colgada
        return;
      }
      res.writeHead(modoLogout, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ msg: 'fallo controlado por la prueba FE-193' }));
      return;
    }
    try {
      const cabeceras = { ...req.headers };
      for (const h of ['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding']) {
        delete cabeceras[h];
      }
      const r = await fetchReal(`${supabaseReal}${req.url}`, {
        method: req.method,
        headers: cabeceras,
        body: partes.length ? Buffer.concat(partes) : undefined,
      });
      const cuerpo = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' });
      res.end(cuerpo);
    } catch {
      res.writeHead(599);
      res.end();
    }
  });
  await new Promise((ok) => proxy.listen(0, '127.0.0.1', ok));
  // process.env tiene prioridad sobre el .env que carga ConfigModule.
  process.env.SUPABASE_URL = `http://127.0.0.1:${proxy.address().port}`;

  const { AppModule } = await import('../dist/app.module.js');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  const url = process.env.DATABASE_URL;
  db = new pg.Pool({
    connectionString: url,
    ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 1_000,
  });
  db.on('error', () => {});
});

after(async () => {
  for (const res of detenidas) res.destroy();
  // Limpieza: si alguna sesión quedó abierta, cerrarla de verdad.
  for (const s of [sesionA, sesionB]) {
    if (s?.access && modoLogout === 'pasar') await api('/auth/logout', { method: 'POST', token: s.access }).catch(() => {});
  }
  await app?.close();
  await db?.end();
  await new Promise((ok) => (proxy ? proxy.close(ok) : ok()));
  if (!habilitada || resultados.length === 0) return;

  let commit = 'desconocido';
  try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
  const salida = {
    subtarea: 'FE-193',
    fecha: new Date().toISOString(),
    commit,
    rama: (() => { try { return execSync('git branch --show-current', { encoding: 'utf8' }).trim(); } catch { return ''; } })(),
    node: process.version,
    plazoBackendMs: PLAZO_BACKEND_MS,
    nota: 'Sin tokens, contraseñas ni correos. Fuente: Supabase real salvo donde dice "fallo inyectado".',
    resultados,
  };
  const carpeta = new URL('../../docs/pruebas/sprint-3/', import.meta.url);
  await mkdir(carpeta, { recursive: true });
  await writeFile(new URL('logout-supabase-resultados.json', carpeta), JSON.stringify(salida, null, 2) + '\n');
  console.table(resultados.map(({ id, observado, veredicto, ms }) => ({ id, observado, veredicto, ms })));
});

// --- escenarios (se ejecutan en orden) --------------------------------------

test('R0 · login real de dos sesiones de la misma cuenta y del rol marketing', opciones, async () => {
  sesionA = await login(EMAIL);
  sesionB = await login(EMAIL); // "otro dispositivo" de la misma cuenta
  usuarioId = sesionA.usuario.id;
  assert.ok(pedidosProxy > 0, 'El backend debe pasar por el proxy de la prueba');
  const me = await api('/auth/me', { token: sesionA.access });
  assert.equal(me.status, 200);
  registrar('R0', 'Login real y /auth/me con sesión vigente', 'Supabase real', '200', String(me.status), 'APROBADO', me.ms);
});

test('R1 · Supabase 500 al cerrar → 503, sin auditoría y la sesión sigue viva', opciones, async () => {
  const desde = await ahoraDb();
  modoLogout = 500;
  const r = await api('/auth/logout', { method: 'POST', token: sesionA.access });
  modoLogout = 'pasar';
  assert.equal(r.status, 503);
  assert.equal(await logoutsDesde(desde), 0);
  const me = await api('/auth/me', { token: sesionA.access });
  assert.equal(me.status, 200, 'Sin revocación confirmada, la sesión real sigue vigente');
  registrar('R1', 'Logout con Supabase 500', 'Token real + fallo inyectado', '503, 0 LOGOUT', `${r.status}, 0 LOGOUT`, 'APROBADO', r.ms);
});

test('R2 · Supabase 400 al cerrar → 502 y sin auditoría', opciones, async () => {
  const desde = await ahoraDb();
  modoLogout = 400;
  const r = await api('/auth/logout', { method: 'POST', token: sesionA.access });
  modoLogout = 'pasar';
  assert.equal(r.status, 502);
  assert.equal(await logoutsDesde(desde), 0);
  registrar('R2', 'Logout con Supabase 4xx', 'Token real + fallo inyectado', '502, 0 LOGOUT', `${r.status}, 0 LOGOUT`, 'APROBADO', r.ms);
});

test('R3 · conexión detenida en el logout → 504 dentro del plazo y sin auditoría', opciones, async () => {
  const desde = await ahoraDb();
  modoLogout = 'detener';
  const r = await api('/auth/logout', { method: 'POST', token: sesionA.access });
  modoLogout = 'pasar';
  for (const res of detenidas.splice(0)) res.destroy();
  assert.equal(r.status, 504);
  assert.ok(r.ms >= PLAZO_BACKEND_MS - 200, `terminó demasiado pronto (${r.ms} ms)`);
  assert.ok(r.ms < PLAZO_BACKEND_MS + 3_000, `superó el plazo esperado (${r.ms} ms)`);
  assert.equal(await logoutsDesde(desde), 0);
  registrar('R3', 'Logout con conexión detenida', 'Token real + fallo inyectado', `504 en ~${PLAZO_BACKEND_MS} ms`, `${r.status} en ${r.ms} ms`, 'APROBADO', r.ms);
});

test('R4 · logout real → 204 y exactamente una auditoría LOGOUT', opciones, async () => {
  const desde = await ahoraDb();
  const r = await api('/auth/logout', { method: 'POST', token: sesionA.access });
  assert.equal(r.status, 204);
  assert.equal(await logoutsDesde(desde), 1);
  registrar('R4', 'Cierre real', 'Supabase real', '204, 1 LOGOUT', `${r.status}, 1 LOGOUT`, 'APROBADO', r.ms);
});

test('R5 · reintento de logout con el access anterior', opciones, async () => {
  const desde = await ahoraDb();
  const r = await api('/auth/logout', { method: 'POST', token: sesionA.access });
  const auditadas = await logoutsDesde(desde);
  assert.notEqual(r.status, 204, 'Un segundo cierre no debe confirmarse como nuevo éxito');
  assert.equal(auditadas, 0);
  registrar('R5', 'Reintento de logout', 'Supabase real', '401 (o 502), 0 LOGOUT', `${r.status}, ${auditadas} LOGOUT`, 'APROBADO', r.ms);
});

test('R6 · refresh token anterior tras el cierre → 401', opciones, async () => {
  const r = await api('/auth/refresh', { method: 'POST', body: { refreshToken: sesionA.refresh } });
  assert.equal(r.status, 401);
  registrar('R6', 'Refresh anterior tras logout', 'Supabase real', '401', String(r.status), 'APROBADO', r.ms);
});

test('R7 · access token anterior tras el cierre (se registra la conducta real)', opciones, async () => {
  const me = await api('/auth/me', { token: sesionA.access });
  const casos = await api('/casos', { token: sesionA.access });
  const sigueVigente = me.status === 200 || casos.status === 200;
  registrar(
    'R7', 'Access anterior en /auth/me y /casos', 'Supabase real', '401 en ambos',
    `/auth/me ${me.status}, /casos ${casos.status}`,
    sigueVigente ? 'HALLAZGO: el access anterior sigue sirviendo' : 'APROBADO: rechazado de inmediato',
    me.ms,
  );
  if (sigueVigente) console.warn('FE-193 R7: el access token anterior sigue aceptado. Documentarlo como hallazgo.');
  // No es un assert duro: el criterio de FE-118 pide registrar la conducta real.
  assert.ok([200, 401, 403].includes(me.status));
});

test('R8 · la otra sesión (scope=local) no se ve afectada', opciones, async () => {
  const me = await api('/auth/me', { token: sesionB.access });
  assert.equal(me.status, 200);
  const ref = await api('/auth/refresh', { method: 'POST', body: { refreshToken: sesionB.refresh } });
  assert.equal(ref.status, 200);
  sesionB = { access: ref.datos.accessToken, refresh: ref.datos.refreshToken };
  registrar('R8', 'Sesión B tras cerrar A', 'Supabase real', '/auth/me 200, refresh 200', `/auth/me ${me.status}, refresh ${ref.status}`, 'APROBADO', me.ms);
});

test('R9 · sin token o con token inventado → 401', opciones, async () => {
  const sin = await api('/casos');
  const inventado = await api('/casos', { token: 'token-inventado-fe193' });
  assert.equal(sin.status, 401);
  assert.equal(inventado.status, 401);
  registrar('R9', 'Rutas clínicas sin token / token inventado', 'Supabase real', '401 / 401', `${sin.status} / ${inventado.status}`, 'APROBADO', sin.ms);
});

test('R10 · permisos: marketing no entra a /casos (403) y su logout es 204', opciones, async () => {
  const m = await login(EMAIL_MARKETING);
  const casos = await api('/casos', { token: m.access });
  const salida = await api('/auth/logout', { method: 'POST', token: m.access });
  assert.equal(casos.status, 403);
  assert.equal(salida.status, 204);
  registrar('R10', 'Marketing en /casos y su logout', 'Supabase real', '403 y 204', `${casos.status} y ${salida.status}`, 'APROBADO', casos.ms);
});

test('R11 · cierre de la sesión B (limpieza) → 204', opciones, async () => {
  const r = await api('/auth/logout', { method: 'POST', token: sesionB.access });
  assert.equal(r.status, 204);
  sesionA = sesionB = null;
  registrar('R11', 'Cierre de la sesión B', 'Supabase real', '204', String(r.status), 'APROBADO', r.ms);
});

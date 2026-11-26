// FE-197: ensayo de actualización y recuperación sobre PostgreSQL local (nunca Supabase).
// 1. Base "antes": migraciones hasta --base (011 = Sprint 2) con datos ficticios.
// 2. Respaldo de esa base (punto de reversión).
// 3. Aplica cada migración restante, una por una: tiempo, conservación de filas previas, RLS y permisos de anon.
// 4. Sube archivos de genograma, respalda, restaura en otra base y compara todo (filas, catálogo, sha256).
// 5. Reversión: restaura el respaldo del paso 2 y comprueba que es idéntico a la base "antes".
//
// Uso (PowerShell, Docker accesible):
//   $env:FE_PG_ADMIN_URL = 'postgres://postgres:<clave>@localhost:<puerto>/postgres'
//   $env:FE_PG_CONTENEDOR = '<contenedor postgres:17>'
//   node scripts/ensayo-actualizacion.mjs [--base 011] [--extra ruta.sql ...] [--salida informe.json]
// --extra agrega migraciones que aún no están en db/migrations (mismo nombre = reemplaza).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const valor = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = valor('--base', '011');
const SALIDA = valor('--salida', null);
const EXTRAS = args.flatMap((a, i) => (a === '--extra' ? [args[i + 1]] : []));
// Variante con datos reales: parte de un respaldo (pg_dump -Fc del esquema public) y aplica solo las migraciones indicadas.
const DESDE_RESPALDO = valor('--desde-respaldo', null);
const APLICAR = valor('--aplicar', '').split(',').filter(Boolean);
assert.ok(!DESDE_RESPALDO || APLICAR.length, 'Con --desde-respaldo indique --aplicar 012,019,...');
const CONTENEDOR = process.env.FE_PG_CONTENEDOR;
const ADMIN = new URL(process.env.FE_PG_ADMIN_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(ADMIN.hostname), 'Solo PostgreSQL local (FE_PG_ADMIN_URL)');
assert.ok(CONTENEDOR, 'Falta FE_PG_CONTENEDOR');

const BD = { antes: 'ensayo_antes', actual: 'ensayo_actual', restaurada: 'ensayo_restaurada', revertida: 'ensayo_revertida' };
const P = {
  admin: '00000000-0000-4000-8000-0000000001a1',
  t1: '00000000-0000-4000-8000-0000000001b1',
  t2: '00000000-0000-4000-8000-0000000001b2',
  marketing: '00000000-0000-4000-8000-0000000001c1',
};
const informe = { base: BASE, migraciones: [], genograma: {}, respaldo: {}, reversion: {} };
const ms = (t0) => Math.round(performance.now() - t0);

const admin = new pg.Client({ connectionString: ADMIN.toString() });
await admin.connect();
const conectar = async (bd) => {
  const u = new URL(ADMIN); u.pathname = `/${bd}`;
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  return c;
};

// Roles y permisos por defecto como en Supabase: así se detecta una tabla nueva sin revoke.
await admin.query(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$`);

const PERMISOS_SUPABASE = `grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;`;

async function crearBd(nombre) {
  await admin.query(`drop database if exists "${nombre}" with (force)`);
  await admin.query(`create database "${nombre}"`);
  const c = await conectar(nombre);
  await c.query(`create schema auth; create table auth.users (id uuid primary key); create schema extensions; ${PERMISOS_SUPABASE}`);
  return c;
}

async function migraciones() {
  const carpeta = new URL('../../db/migrations/', import.meta.url);
  const mapa = new Map();
  for (const a of (await readdir(carpeta)).filter((a) => /^\d+.*\.sql$/.test(a))) mapa.set(a, new URL(a, carpeta));
  for (const e of EXTRAS) mapa.set(basename(e), e);
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function comoUsuario(c, usuario, fn) {
  await c.query('begin');
  try {
    await c.query(`select set_config('app.usuario_id', $1, true)`, [usuario]);
    const r = await fn();
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

// Datos ficticios con la forma del Sprint 2 (lo que la aplicación escribía hasta 011).
async function sembrar(c) {
  for (const [clave, id] of Object.entries(P)) {
    const rol = clave === 'admin' ? 'administrador' : clave === 'marketing' ? 'marketing' : 'terapeuta';
    await c.query('insert into auth.users (id) values ($1)', [id]);
    await c.query('insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)', [id, `Ensayo ${clave}`, rol]);
  }
  const estados = ['iniciado', 'en_proceso', 'concluido'];
  const casos = [];
  for (let i = 1; i <= 12; i++) {
    const tipo = i % 3 === 0 ? 'derivado' : 'voluntario';
    const terapeuta = i % 2 ? P.t1 : P.t2;
    const caso = await comoUsuario(c, P.admin, async () => {
      const p = await c.query(
        `insert into pacientes (nombre_completo, fecha_nacimiento, telefono) values ($1, $2, $3) returning id`,
        [`Paciente Ensayo ${String(i).padStart(2, '0')}`, `19${80 + i}-0${1 + (i % 9)}-15`, `7000${String(i).padStart(4, '0')}`]);
      const k = await c.query(
        `insert into casos (paciente_id, tipo, estado, clasificacion, fecha_ingreso)
         values ($1, $2, $3, $4, $5) returning id`,
        [p.rows[0].id, tipo, estados[i % 3], i % 4 ? 'social' : 'privado', `2026-09-${String(i).padStart(2, '0')}`]);
      const id = k.rows[0].id;
      await c.query('insert into asignaciones_caso (caso_id, perfil_id) values ($1, $2)', [id, terapeuta]);
      if (tipo === 'derivado') {
        await c.query(`insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion)
          values ($1, $2, $3, $4)`, [id, `Juzgado Ensayo ${i}`, `EXP-${1000 + i}`, '2026-08-20']);
      }
      const est = ['pendiente', 'registrado', 'no_aplica'][i % 3];
      await c.query(
        `insert into constancias_atencion (caso_id, procedencia, origen_judicial, estado, fecha_consentimiento,
           referencia_evidencia, explicacion, creado_por, actualizado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [id, 'Derivación ficticia', tipo === 'derivado', est, est === 'registrado' ? '2026-09-20' : null,
          est === 'registrado' ? 'Carpeta física ficticia' : null, est === 'no_aplica' ? 'Ensayo sin constancia' : null, P.admin]);
      if (i <= 8) {
        await c.query(`insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
          values ($1, $2, $3, $4, $4)`, [id, '2026-09-25', { motivo: `Motivo ficticio ${i}`, hipotesis: 'Ensayo' }, terapeuta]);
      }
      if (i <= 3) await c.query('insert into genogramas (caso_id, datos) values ($1, $2)', [id, { nota: `Genograma previo ${i}` }]);
      if (i === 4) await c.query(`insert into consentimientos (caso_id, tipo, archivo_path, registrado_por)
        values ($1, 'ingreso', 'consentimientos/ensayo.pdf', $2)`, [id, P.admin]);
      return { id, terapeuta };
    });
    casos.push(caso);
  }
  for (const [n, { id, terapeuta }] of casos.slice(0, 8).entries()) {
    for (let s = 1; s <= 3; s++) {
      await comoUsuario(c, terapeuta, async () => {
        const ses = await c.query(
          `insert into fichas_seguimiento (caso_id, fecha, evolucion, responsable_id, creado_por)
           values ($1, $2, $3, $4, $4) returning id`, [id, `2026-10-${String(s * 7).padStart(2, '0')}`, `Evolución ficticia ${n}.${s}`, terapeuta]);
        await c.query(`insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, $3, $4)`,
          [id, ses.rows[0].id, `Tarea ficticia ${n}.${s}`, terapeuta]);
        if (s < 3) {
          await c.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo, registrado_por) values ($1, $2, $3, $4, $5, $6)`,
            [id, ses.rows[0].id, `2026-10-${String(s * 7).padStart(2, '0')}`, (80 + n * 5.5).toFixed(2), ['qr', 'efectivo', 'transferencia'][s % 3], P.admin]);
        }
      });
    }
  }
  return casos;
}

const tablasDe = async (c) => (await c.query(
  `select c.relname t, c.relrowsecurity rls, array_agg(a.attname order by a.attnum) cols
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' group by c.relname, c.relrowsecurity order by 1`)).rows;

// Huella por tabla: filas y md5 del contenido (solo las columnas indicadas).
async function huellas(c, columnasPorTabla = null) {
  const r = {};
  for (const { t, cols } of await tablasDe(c)) {
    const usar = columnasPorTabla ? columnasPorTabla[t] : cols;
    if (!usar) continue;
    const { rows: [h] } = await c.query(
      `select count(*)::int n, coalesce(md5(string_agg(r::text, E'\\n' order by r::text)), '') md5
         from (select (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(t)) e(k, v) where k = any($1)) r
                 from public."${t}" t) s`, [usar]);
    r[t] = { n: h.n, md5: h.md5 };
  }
  return r;
}

const catalogo = async (c) => (await c.query(`select
  (select count(*) from pg_class k join pg_namespace n on n.oid = k.relnamespace where n.nspname = 'public' and k.relkind = 'r')::int tablas,
  (select count(*) from pg_class k join pg_namespace n on n.oid = k.relnamespace where n.nspname = 'public' and k.relkind = 'v')::int vistas,
  (select count(*) from pg_indexes where schemaname = 'public')::int indices,
  (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname = 'public')::int restricciones,
  (select count(*) from pg_trigger g join pg_class k on k.oid = g.tgrelid join pg_namespace n on n.oid = k.relnamespace
    where n.nspname = 'public' and not g.tgisinternal)::int triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')::int funciones,
  (select count(*) from pg_policy p join pg_class k on k.oid = p.polrelid join pg_namespace n on n.oid = k.relnamespace
    where n.nspname = 'public')::int politicas`)).rows[0];

const sinRls = async (c) => (await tablasDe(c)).filter((x) => !x.rls).map((x) => x.t);
// Supabase da select a anon por defecto: lo que protege es RLS (tablas) y security_invoker (vistas).
// Devuelve las tablas o vistas de las que anon obtiene filas, y las vistas que se ejecutan con permisos del dueño.
async function exposicionAnon(c) {
  const { rows } = await c.query(`select c.relname t, c.relkind k, coalesce('security_invoker=true' = any(c.reloptions), false) invoker
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v') and has_table_privilege('anon', c.oid, 'select') order by 1`);
  const conFilas = [];
  await c.query('begin read only');
  try {
    await c.query('set local role anon');
    for (const { t } of rows) {
      if ((await c.query(`select exists (select 1 from public."${t}") hay`)).rows[0].hay) conFilas.push(t);
    }
  } finally {
    await c.query('rollback');
  }
  return { conFilas, vistasSinInvoker: rows.filter((r) => r.k === 'v' && !r.invoker).map((r) => r.t) };
}

function docker(...a) {
  return execFileSync('docker', ['exec', CONTENEDOR, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Igual que el respaldo de Supabase: solo el esquema public, sin dueños ni permisos.
function respaldar(bd, archivo) {
  const t0 = performance.now();
  docker('pg_dump', '-U', 'postgres', '-d', bd, '--schema=public', '-Fc', '--no-owner', '--no-privileges', '-f', `/tmp/${archivo}`);
  return { ms: ms(t0), bytes: Number(docker('stat', '-c', '%s', `/tmp/${archivo}`).trim()) };
}

// Restauración en tres secciones: auth.users se llena desde perfiles antes de crear las FK (post-data).
async function restaurar(archivo, destino) {
  const c = await crearBd(destino);
  await c.query(`create extension pg_trgm with schema extensions; create extension unaccent with schema extensions;
    drop schema public cascade;`);
  const t0 = performance.now();
  const pasos = {};
  for (const seccion of ['pre-data', 'data', 'post-data']) {
    if (seccion === 'post-data') await c.query('insert into auth.users (id) select id from public.perfiles on conflict do nothing');
    const t = performance.now();
    docker('pg_restore', '-U', 'postgres', '-d', destino, '--no-owner', '--no-privileges', '--exit-on-error', `--section=${seccion}`, `/tmp/${archivo}`);
    pasos[seccion] = ms(t);
  }
  // El esquema public se recreó: se vuelven a dar los permisos que Supabase tendría (tablas existentes y futuras).
  await c.query(`${PERMISOS_SUPABASE}
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    grant all on all functions in schema public to anon, authenticated;`);
  return { c, ms: ms(t0), pasos };
}

const diferencias = (a, b) => Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

try {
  // 1. Base "antes".
  const lista = await migraciones();
  const enBase = DESDE_RESPALDO ? [] : lista.filter(([a]) => a.slice(0, 3) <= BASE);
  const resto = DESDE_RESPALDO ? lista.filter(([a]) => APLICAR.includes(a.slice(0, 3))) : lista.filter(([a]) => a.slice(0, 3) > BASE);
  let antes;
  let casos;
  if (DESDE_RESPALDO) {
    execFileSync('docker', ['cp', DESDE_RESPALDO, `${CONTENEDOR}:/tmp/origen.dump`]);
    const r = await restaurar('origen.dump', BD.antes);
    antes = r.c;
    informe.origen = { respaldo: basename(DESDE_RESPALDO), restauracion: { ms: r.ms, pasos: r.pasos } };
    // Casos para los archivos de prueba: la terapeuta asignada o, si no hay, una administradora.
    casos = (await antes.query(`select c.id, coalesce(a.perfil_id,
        (select id from perfiles where rol = 'administrador' order by id limit 1)) terapeuta
      from casos c left join asignaciones_caso a on a.caso_id = c.id
      where c.deleted_at is null order by c.tipo, c.numero_correlativo limit 5`)).rows;
  } else {
    antes = await crearBd(BD.antes);
    for (const [, ruta] of enBase) await antes.query((await readFile(ruta, 'utf8')).replace(/^﻿/, ''));
    casos = await sembrar(antes);
  }
  const columnasBase = Object.fromEntries((await tablasDe(antes)).map((x) => [x.t, x.cols]));
  const huellaBase = await huellas(antes);
  const catalogoBase = await catalogo(antes);
  informe.antes = { migraciones: enBase.map(([a]) => a), filas: Object.fromEntries(Object.entries(huellaBase).filter(([, v]) => v.n).map(([t, v]) => [t, v.n])), catalogo: catalogoBase };
  await antes.end();

  // 2. Punto de reversión.
  informe.reversion.respaldo = respaldar(BD.antes, 'antes.dump');

  // 3. Actualización paso a paso sobre una copia de la base "antes".
  await admin.query(`drop database if exists "${BD.actual}" with (force)`);
  await admin.query(`create database "${BD.actual}" template "${BD.antes}"`);
  const actual = await conectar(BD.actual);
  for (const [archivo, ruta] of resto) {
    const sql = (await readFile(ruta, 'utf8')).replace(/^﻿/, '');
    const t0 = performance.now();
    let error = null;
    try { await actual.query(sql); } catch (e) { error = `${e.code ?? ''} ${e.message}`; }
    const tiempo = ms(t0);
    const conservadas = diferencias(huellaBase, await huellas(actual, columnasBase));
    informe.migraciones.push({ archivo, ms: tiempo, error, filasPreviasCambiadas: conservadas, sinRls: await sinRls(actual),
      anon: error ? null : await exposicionAnon(actual) });
    if (error) throw new Error(`${archivo}: ${error}`);
  }
  informe.despues = { catalogo: await catalogo(actual) };

  // 4. Archivos de genograma (requiere 012) y recuperación.
  const tiene012 = (await actual.query(`select to_regclass('public.genograma_archivos') t`)).rows[0].t;
  const archivos = [];
  if (tiene012) {
    const subir = async (caso, tipo, bytes, activar, nombre) => {
      const clave = `${caso.id}/${randomUUID()}`;
      const contenido = randomBytes(bytes);
      await actual.query('insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido) values ($1, $2, $3, $4, $5)',
        [clave, caso.id, tipo, bytes, contenido]);
      if (activar) {
        await comoUsuario(actual, caso.terapeuta, async () => {
          await actual.query(`update genograma_archivos set nombre = $2, subido_por = $3, activado_en = now() where clave = $1`,
            [clave, nombre, caso.terapeuta]);
          await actual.query(`insert into genogramas (caso_id, archivo_clave, actualizado_por) values ($1, $2, $3)
            on conflict (caso_id) do update set archivo_clave = excluded.archivo_clave, actualizado_por = excluded.actualizado_por`,
            [caso.id, clave, caso.terapeuta]);
        });
      }
      archivos.push({ clave, caso: caso.id, bytes, activado: activar, sha256: createHash('sha256').update(contenido).digest('hex') });
    };
    await subir(casos[0], 'application/pdf', 250_000, true, 'genograma-v1.pdf');
    await subir(casos[0], 'image/png', 1_500_000, true, 'genograma-v2.png');       // versión nueva del mismo caso
    await subir(casos[1], 'image/jpeg', 10_485_760, true, 'genograma-max.jpg');     // tamaño máximo permitido
    await subir(casos[4], 'image/png', 40_000, true, 'genograma.png');               // caso sin genograma previo
    await subir(casos[2], 'application/pdf', 5_000, false, null);                    // subido y nunca activado
  }
  informe.genograma.archivos = archivos.length;
  const huellaActual = await huellas(actual);
  const catalogoActual = await catalogo(actual);
  await actual.end();

  informe.respaldo.dump = respaldar(BD.actual, 'actual.dump');
  const r = await restaurar('actual.dump', BD.restaurada);
  informe.respaldo.restauracion = { ms: r.ms, pasos: r.pasos };
  informe.respaldo.tablasDistintas = diferencias(huellaActual, await huellas(r.c));
  informe.respaldo.catalogoDistinto = diferencias(catalogoActual, await catalogo(r.c));
  informe.respaldo.sinRls = await sinRls(r.c);
  if (tiene012) {
    const { rows } = await r.c.query(`select clave, encode(sha256, 'hex') guardado, encode(sha256(contenido), 'hex') calculado,
      tamanio = octet_length(contenido) tamanio_ok from genograma_archivos`);
    const porClave = Object.fromEntries(rows.map((x) => [x.clave, x]));
    informe.genograma.recuperados = archivos.filter((a) => porClave[a.clave]?.calculado === a.sha256
      && porClave[a.clave].guardado === a.sha256 && porClave[a.clave].tamanio_ok).length;
    const vigentes = (await r.c.query(`select g.caso_id, g.archivo_clave from genogramas g
      join genograma_archivos a on a.clave = g.archivo_clave and a.caso_id = g.caso_id`)).rows;
    const esperados = Object.fromEntries(archivos.filter((a) => a.activado).map((a) => [a.caso, a.clave]));
    informe.genograma.vigentesOk = Object.keys(esperados).length === vigentes.length
      && vigentes.every((v) => esperados[v.caso_id] === v.archivo_clave);
    informe.genograma.datosPreviosConservados = (await r.c.query(
      `select count(*)::int n from genogramas where datos ? 'nota'`)).rows[0].n;
    // Las reglas vuelven con la restauración: el contenido sigue sin poder cambiarse.
    let inmutable = false;
    try { await r.c.query(`update genograma_archivos set nombre = 'x' where clave = $1`, [archivos[0].clave]); } catch (e) { inmutable = e.code === '23514'; }
    informe.genograma.reglasRestauradas = inmutable;
  }
  await r.c.end();

  // 5. Reversión: volver al punto previo a las migraciones.
  const v = await restaurar('antes.dump', BD.revertida);
  informe.reversion.restauracion = { ms: v.ms, pasos: v.pasos };
  informe.reversion.tablasDistintas = diferencias(huellaBase, await huellas(v.c));
  informe.reversion.catalogoDistinto = diferencias(catalogoBase, await catalogo(v.c));
  await v.c.end();
} finally {
  if (SALIDA) await writeFile(SALIDA, JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
  for (const bd of Object.values(BD)) await admin.query(`drop database if exists "${bd}" with (force)`);
  await admin.end();
}

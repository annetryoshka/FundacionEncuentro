import { execSync, spawnSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pg = require('pg');

const adminUrl = process.env.FE_PG_ADMIN_URL;
if (!adminUrl) {
  console.error('Falta FE_PG_ADMIN_URL, por ejemplo postgres://postgres:<clave>@localhost:5432/postgres');
  process.exit(1);
}
const base = new URL(adminUrl);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) {
  console.error('Solo se admite PostgreSQL local.');
  process.exit(1);
}

const urlDe = (db) => { const u = new URL(base); u.pathname = `/${db}`; return u.toString(); };
const git = (args) => { try { return execSync(`git ${args}`, { encoding: 'utf8' }).trim(); } catch { return 'desconocido'; } };

async function prepararPostgres() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const version = (await admin.query('show server_version')).rows[0].server_version;
    for (const rol of ['anon', 'authenticated']) {
      const { rowCount } = await admin.query('select 1 from pg_roles where rolname = $1', [rol]);
      if (!rowCount) await admin.query(`create role ${rol} nologin`);
    }
    for (const db of ['fe34_qa', 'fe40_qa', 'fe88_qa']) {
      const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [db]);
      if (!rowCount) await admin.query(`create database "${db}"`);
    }
    return version;
  } finally {
    await admin.end();
  }
}

function correr(nombre, comando, args, env = {}) {
  const inicio = Date.now();
  const r = spawnSync(comando, args, {
    encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, ...env }, maxBuffer: 256 * 1024 * 1024,
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { nombre, codigo: r.status, segundos: Math.round((Date.now() - inicio) / 1000), salida };
}

function resumenNodeTest(salida) {
  const dato = (clave) => Number(salida.match(new RegExp(`^# ${clave} (\\d+)`, 'm'))?.[1] ?? NaN);
  const fallidas = [...salida.matchAll(/^not ok \d+ - (.+?)(?: # .*)?$/gm)].map((m) => m[1].trim());
  const omitidas = [...salida.matchAll(/^ok \d+ - (.+?) # SKIP\s*(.*)$/gm)].map((m) => `${m[1].trim()} (${m[2].trim()})`);
  return { pruebas: dato('tests'), aprobadas: dato('pass'), fallidas: dato('fail'), omitidas: dato('skipped'), todo: dato('todo'), nombresFallidas: fallidas, nombresOmitidas: omitidas };
}

function resumenVitest(salida) {
  const linea = salida.match(/Tests\s+(.+)/)?.[1] ?? '';
  const num = (palabra) => Number(linea.match(new RegExp(`(\\d+) ${palabra}`))?.[1] ?? 0);
  return { pruebas: num('passed') + num('failed') + num('skipped'), aprobadas: num('passed'), fallidas: num('failed'), omitidas: num('skipped') };
}

const versionPg = await prepararPostgres();
const envPg = {
  FE_PG_QA: '1',
  FE34_PG_QA: '1', FE34_PG_ADMIN_URL: urlDe('fe34_qa'),
  FE40_PG_QA: '1', FE40_PG_ADMIN_URL: urlDe('fe40_qa'),
  FE88_PG_QA: '1', FE88_PG_ADMIN_URL: urlDe('fe88_qa'),
};

console.log('1/3 Compilando el backend…');
const build = correr('build', 'npm', ['run', 'build']);
if (build.codigo !== 0) {
  console.error(build.salida);
  process.exit(1);
}

console.log('2/3 Pruebas unitarias…');
const unitarias = correr('unitarias', 'npx', ['vitest', 'run', 'src']);

console.log('3/3 Pruebas de integración (todas las suites de test/)…');
const archivos = (await readdir('test')).filter((a) => a.endsWith('.test.mjs')).sort().map((a) => `test/${a}`);
const integracion = correr('integracion', 'node', ['--test', '--test-force-exit', '--test-reporter=tap', '--test-concurrency=1', ...archivos], envPg);

const resultado = {
  subtarea: 'FE-200',
  fecha: new Date().toISOString(),
  commit: git('rev-parse --short HEAD'),
  rama: git('branch --show-current'),
  node: process.version,
  postgres: versionPg,
  supabaseReal: process.env.FE_SUPABASE_QA === '1' ? 'incluido (FE_SUPABASE_QA=1)' : 'no incluido en esta corrida',
  unitarias: { ...resumenVitest(unitarias.salida), segundos: unitarias.segundos },
  integracion: { suites: archivos.length, ...resumenNodeTest(integracion.salida), segundos: integracion.segundos },
};

await mkdir('../docs/pruebas/sprint-3', { recursive: true });
await writeFile('../docs/pruebas/sprint-3/regresion-integrada-resultados.json', `${JSON.stringify(resultado, null, 2)}\n`);
await writeFile('../docs/pruebas/sprint-3/regresion-integrada-salida.txt', integracion.salida.replace(/\r/g, ''));

console.log('\nResultado');
console.table({
  unitarias: resultado.unitarias,
  integracion: { ...resultado.integracion, nombresFallidas: undefined, nombresOmitidas: undefined },
});
if (resultado.integracion.nombresFallidas.length) {
  console.log('\nFallidas:');
  for (const n of resultado.integracion.nombresFallidas) console.log(`  ✖ ${n}`);
}
console.log('\nOmitidas:', resultado.integracion.omitidas);
console.log('Guardado en docs/pruebas/sprint-3/regresion-integrada-resultados.json');

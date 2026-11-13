// FE-64: procedencia y constancia (tabla constancias_atencion de FE-63) en sus tres estados,
// sin duplicar paciente ni carpeta.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
before(async () => { if (opciones.skip) return; base = await crearBase('fe64'); sql = base.cliente; });
after(async () => { await base?.cerrar(); });

// Igual que la API de FE-63: un registro por caso, se crea o se actualiza.
const guardar = (casoId, c, usuario = PERFILES.admin) => comoUsuario(sql, usuario, () => sql.query(
  `insert into constancias_atencion (caso_id, procedencia, origen_judicial, estado,
     fecha_consentimiento, referencia_evidencia, explicacion, creado_por, actualizado_por)
   values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
   on conflict (caso_id) do update set
     procedencia = excluded.procedencia, origen_judicial = excluded.origen_judicial, estado = excluded.estado,
     fecha_consentimiento = excluded.fecha_consentimiento, referencia_evidencia = excluded.referencia_evidencia,
     explicacion = excluded.explicacion, actualizado_por = excluded.actualizado_por`,
  [casoId, c.procedencia ?? null, c.origenJudicial ?? false, c.estado, c.fecha ?? null,
    c.referencia ?? null, c.explicacion ?? null, usuario],
));
const conteos = async () => (await sql.query(
  'select (select count(*)::int from pacientes) as pacientes, (select count(*)::int from casos) as casos',
)).rows[0];
const constanciaDe = async (casoId) => (await sql.query(
  `select estado, procedencia, origen_judicial, to_char(fecha_consentimiento, 'YYYY-MM-DD') as fecha,
          referencia_evidencia, creado_por, actualizado_por
     from constancias_atencion where caso_id = $1`, [casoId])).rows;

test('FE-64: procedencia judicial y constancia no cambian el número ni crean filas nuevas', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA caso B', tipo: 'derivado' });
  const antes = await conteos();
  await guardar(caso.id, { procedencia: 'Juzgado Público de Familia N.º 1', origenJudicial: true, estado: 'pendiente' });
  assert.deepEqual(await conteos(), antes);
  const { rows } = await sql.query('select numero_correlativo from casos where id = $1', [caso.id]);
  assert.equal(rows[0].numero_correlativo, caso.numero_correlativo);
  const [constancia] = await constanciaDe(caso.id);
  assert.equal(constancia.procedencia, 'Juzgado Público de Familia N.º 1');
  assert.equal(constancia.origen_judicial, true);
});

test('FE-64: ejemplos de los tres estados de la constancia', opciones, async () => {
  const pendiente = await crearCaso(sql, { nombre: 'QA pendiente' });
  const registrado = await crearCaso(sql, { nombre: 'QA registrado' });
  const noAplica = await crearCaso(sql, { nombre: 'QA no aplica' });
  await guardar(pendiente.id, { estado: 'pendiente' });
  await guardar(registrado.id, { estado: 'registrado', fecha: '2026-10-10', referencia: 'EVIDENCIA-DEMO' });
  await guardar(noAplica.id, { estado: 'no_aplica', explicacion: 'Caso de prueba sin intervención con menores' });
  const estados = [];
  for (const caso of [pendiente, registrado, noAplica]) estados.push((await constanciaDe(caso.id))[0].estado);
  assert.deepEqual(estados, ['pendiente', 'registrado', 'no_aplica']);
});

test('FE-64: combinaciones inválidas se rechazan y la constancia queda Pendiente', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA validación' });
  await guardar(caso.id, { estado: 'pendiente' });
  const invalidas = [
    { estado: 'registrado', fecha: '2026-10-10' },                                   // sin referencia
    { estado: 'registrado', referencia: 'EVIDENCIA-DEMO' },                          // sin fecha
    { estado: 'registrado', fecha: '2026-10-10', referencia: '   ' },                // referencia vacía
    { estado: 'no_aplica' },                                                         // sin explicación
    { estado: 'pendiente', fecha: '2026-10-10' },                                    // pendiente con datos
    { estado: 'firmado' },                                                           // fuera de catálogo
  ];
  for (const c of invalidas) await rechaza(guardar(caso.id, c), '23514');
  assert.equal((await constanciaDe(caso.id))[0].estado, 'pendiente');

  // Sin el "on conflict", una segunda constancia del mismo caso se rechaza.
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into constancias_atencion (caso_id, origen_judicial, estado, creado_por, actualizado_por)
     values ($1, false, 'pendiente', $2, $2)`, [caso.id, PERFILES.admin])), '23505');
});

test('FE-64: pasar a Registrado guarda fecha de evidencia y autoría por separado', opciones, async () => {
  const caso = await crearCaso(sql, { nombre: 'QA registrar' });
  await guardar(caso.id, { estado: 'pendiente' }, PERFILES.admin);
  await guardar(caso.id, { estado: 'registrado', fecha: '2026-10-09', referencia: 'EVIDENCIA-DEMO' }, PERFILES.t1);
  const [constancia] = await constanciaDe(caso.id);
  assert.deepEqual(
    { estado: constancia.estado, fecha: constancia.fecha, creado_por: constancia.creado_por, actualizado_por: constancia.actualizado_por },
    { estado: 'registrado', fecha: '2026-10-09', creado_por: PERFILES.admin, actualizado_por: PERFILES.t1 },
  );
  const auditoria = await sql.query(`select count(*)::int as n from auditoria where tabla = 'constancias_atencion'
    and registro_id = (select id from constancias_atencion where caso_id = $1)`, [caso.id]);
  assert.equal(auditoria.rows[0].n, 2);
});

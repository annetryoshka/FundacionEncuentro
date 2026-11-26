// FE-163: lotes de importación histórica (migración 017). Muestras en db/importacion/muestras/.
// Reglas de docs/srs/sprint-3/FE-162-importacion-historica.md: validar, mostrar coincidencias,
// decidir sin fusionar ni borrar, confirmar todo el lote o nada, y repetir sin duplicar.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, existentes;
const muestras = new URL('../../db/importacion/', import.meta.url);

/** CSV RFC 4180 (comillas dobles, comas y saltos dentro de comillas). */
function leerCsvTexto(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  texto = texto.replace(/^﻿/, '');
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/** Filas de una muestra como objetos { columna: texto }, con su número de línea (encabezado = 1). */
async function leerMuestra(archivo) {
  const [encabezado, ...filas] = leerCsvTexto(await readFile(new URL(archivo, muestras), 'utf8'));
  return { encabezado, filas: filas.map((f) => Object.fromEntries(encabezado.map((c, i) => [c, f[i] ?? '']))) };
}

/** Lo que hará la API (FE-164): cabecera + filas leídas + clasificación, en una transacción. */
async function cargarLote(filas, { archivo = 'lote.csv', sha = null, cliente = sql } = {}) {
  return comoUsuario(cliente, PERFILES.admin, async () => {
    const { rows: [lote] } = await cliente.query(
      `insert into importaciones (perfil_id, archivo_nombre, formato, archivo_sha256, origen)
       values ($1, $2, 'csv', $3, 'Excel antiguo QA') returning id`, [PERFILES.admin, archivo, sha]);
    for (const [i, datos] of filas.entries()) {
      await cliente.query(
        'insert into importacion_filas (importacion_id, numero_fila, referencia_origen, datos) values ($1, $2, $3, $4)',
        [lote.id, i + 2, datos.referenciaOrigen || null, datos]);
    }
    await cliente.query('select clasificar_importacion($1)', [lote.id]);
    return lote.id;
  });
}

const filasDe = async (lote) => (await sql.query(
  `select numero_fila, referencia_origen, estado, errores, coincidencias, advertencias, decision,
          decidido_por, resultado, paciente_id, caso_id
     from importacion_filas where importacion_id = $1 order by numero_fila`, [lote])).rows;
const porReferencia = async (lote) => Object.fromEntries((await filasDe(lote)).map((f) => [f.referencia_origen, f]));
const version = async (lote) => (await sql.query('select version from importaciones where id = $1', [lote])).rows[0].version;
const cabecera = async (lote) => (await sql.query('select * from importaciones where id = $1', [lote])).rows[0];

/** Decisión de administración sobre una fila. */
const decidir = (lote, numeroFila, decision, destino = {}) => comoUsuario(sql, PERFILES.admin, () => sql.query(
  `update importacion_filas set decision = $3, paciente_destino_id = $4, caso_destino_id = $5, fila_destino = $6
    where importacion_id = $1 and numero_fila = $2`,
  [lote, numeroFila, decision, destino.paciente ?? null, destino.caso ?? null, destino.fila ?? null]));

// acepta: administración aceptó el salto del contador (tiene su propia prueba; en las demás no es el tema).
const confirmar = async (lote, v, { cliente = sql, acepta = true } = {}) => comoUsuario(cliente, PERFILES.admin,
  async () => (await cliente.query('select confirmar_importacion($1, $2, $3) as r', [lote, v, acepta])).rows[0].r);

async function conteos() {
  const { rows: [c] } = await sql.query(
    `select (select count(*)::int from pacientes) as pacientes, (select count(*)::int from casos) as casos,
            (select count(*)::int from contexto_judicial) as judicial,
            (select jsonb_object_agg(tipo, ultimo_numero) from contadores_caso) as contadores`);
  return c;
}

// md5 de pacientes, casos y contextos que ya existían: la importación no debe tocarlos.
const huellaExistentes = async () => (await sql.query(
  `select md5(string_agg(t, '|' order by t)) as md5 from (
     select p::text as t from pacientes p where p.id = any ($1)
     union all select c::text from casos c where c.id = any ($2)
     union all select j::text from contexto_judicial j where j.caso_id = any ($2)) x`,
  [existentes.map((e) => e.pacienteId), existentes.map((e) => e.id)])).rows[0].md5;

const tipos = (f) => f.coincidencias.map((c) => c.tipo).sort();

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe163_qa');
  sql = base.cliente;
  existentes = [
    await crearCaso(sql, { nombre: 'QA Paciente Antiguo', fechaIngreso: '2017-01-10' }),
    await crearCaso(sql, { nombre: 'QA Existente Derivado', tipo: 'derivado', fechaIngreso: '2017-01-11' }),
  ];
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update casos set comentarios_clinicos = 'Historia vigente QA' where id = $1`, [existentes[0].id]));
});

after(async () => {
  if (base) await base.cerrar();
});

test('la plantilla y las muestras usan las columnas de importacion_columnas()', opciones, async () => {
  const { rows: [{ columnas }] } = await sql.query('select importacion_columnas() as columnas');
  const [plantilla] = leerCsvTexto(await readFile(new URL('plantilla-importacion-historica.csv', muestras), 'utf8'));
  assert.deepEqual(plantilla, columnas);
  for (const archivo of ['01-lote-valido.csv', '02-lote-errores.csv', '03-lote-duplicados.csv', '04-ejemplo-fe162.csv']) {
    const { encabezado } = await leerMuestra(`muestras/${archivo}`);
    assert.deepEqual(encabezado.filter((c) => !columnas.includes(c)), [], archivo);
  }
});

let loteValido, filasValidas;
test('lote válido: crea pacientes y casos con número, residencia, contexto judicial y procedencia', opciones, async () => {
  ({ filas: filasValidas } = await leerMuestra('muestras/01-lote-valido.csv'));
  const antes = await conteos();
  const huella = await huellaExistentes();
  loteValido = await cargarLote(filasValidas, { archivo: '01-lote-valido.csv', sha: 'a'.repeat(64) });

  const vista = await porReferencia(loteValido);
  for (const f of Object.values(vista)) {
    assert.equal(f.estado, 'valida_nueva', `${f.referencia_origen}: ${JSON.stringify(f.coincidencias)}`);
    assert.equal(f.decision, 'crear');
    assert.equal(f.decidido_por, PERFILES.admin);
  }
  // Los números 15 y 16 superan el último voluntario: se advierte que el contador avanzará.
  assert.match(vista['V-0101'].advertencias[0].mensaje, /contador pasará a 15/);
  assert.deepEqual(vista['V-0102'].advertencias, []);
  assert.equal(await version(loteValido), 1, 'cargar y clasificar en la misma transacción deja la versión en 1');

  const r = await confirmar(loteValido, 1);
  assert.equal(r.estado, 'confirmada');
  assert.deepEqual([r.creadas, r.vinculadas, r.excluidas], [3, 0, 0]);

  const despues = await conteos();
  assert.equal(despues.pacientes, antes.pacientes + 3);
  assert.equal(despues.casos, antes.casos + 3);
  assert.equal(despues.judicial, antes.judicial + 1);
  // Números propios respetados; sin número, el siguiente del contador derivado.
  assert.deepEqual(despues.contadores, { voluntario: 16, derivado: antes.contadores.derivado + 1 });

  const { rows } = await sql.query(
    `select f.referencia_origen, f.resultado, p.nombre_completo, to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as nacimiento,
            p.edad_al_ingreso, p.ciudad_residencia, p.otra_localidad, p.creado_por as p_autor,
            c.tipo, c.numero_correlativo, c.estado, c.clasificacion, to_char(c.fecha_ingreso, 'YYYY-MM-DD') as ingreso,
            c.diagnostico_ingreso, c.hipotesis_relacional, c.creado_por as c_autor,
            j.juzgado, j.nro_expediente, to_char(j.fecha_derivacion, 'YYYY-MM-DD') as derivacion
       from importacion_filas f
       join pacientes p on p.id = f.paciente_id
       join casos c on c.id = f.caso_id and c.paciente_id = p.id
       left join contexto_judicial j on j.caso_id = c.id
      where f.importacion_id = $1 order by f.numero_fila`, [loteValido]);
  const [rosa, mario, lucia] = rows;
  assert.deepEqual(
    [rosa.nacimiento, rosa.edad_al_ingreso, rosa.ciudad_residencia, rosa.numero_correlativo, rosa.estado,
      rosa.clasificacion, rosa.ingreso, rosa.diagnostico_ingreso],
    ['2010-05-14', 7, 'la_paz', 15, 'concluido', 'social', '2018-03-12', 'Ansiedad, según ficha antigua']);
  assert.deepEqual(
    [mario.tipo, mario.numero_correlativo, mario.edad_al_ingreso, mario.ciudad_residencia, mario.otra_localidad,
      mario.juzgado, mario.nro_expediente, mario.derivacion, mario.hipotesis_relacional],
    ['derivado', antes.contadores.derivado + 1, 34, 'otra', 'Viacha',
      'Juzgado 3.º de Familia QA', 'QA-123/2019', '2019-06-20', 'Conflicto de pareja']);
  assert.deepEqual([lucia.numero_correlativo, lucia.estado, lucia.ciudad_residencia, lucia.clasificacion],
    [16, 'en_proceso', 'el_alto', null]);
  for (const f of rows) {
    assert.equal(f.resultado, 'creada');
    assert.equal(f.p_autor, PERFILES.admin);
    assert.equal(f.c_autor, PERFILES.admin);
  }

  const lote = await cabecera(loteValido);
  assert.deepEqual([lote.estado, lote.confirmada_por, lote.filas_total, lote.filas_ok, lote.filas_error],
    ['confirmada', PERFILES.admin, 3, 3, 0]);
  assert.ok(lote.confirmada_en instanceof Date);
  const { rows: [aud] } = await sql.query(
    `select count(*)::int as n from auditoria
      where tabla in ('pacientes', 'casos') and accion = 'INSERT' and usuario_id = $1
        and registro_id in (select paciente_id from importacion_filas where importacion_id = $2
                            union select caso_id from importacion_filas where importacion_id = $2)`,
    [PERFILES.admin, loteValido]);
  assert.equal(aud.n, 6, 'cada paciente y caso importado queda en la auditoría con su autor');
  assert.equal(await huellaExistentes(), huella, 'pacientes y casos existentes sin cambios');

  // El alta manual siguiente continúa después del mayor número importado.
  const siguiente = await crearCaso(sql, { nombre: 'QA Alta Manual Posterior' });
  assert.equal(siguiente.numero_correlativo, 17);
});

test('confirmar otra vez el mismo lote devuelve su resultado sin escribir nada', opciones, async () => {
  const antes = await conteos();
  const primero = await confirmar(loteValido, 1);
  const otraVersion = await confirmar(loteValido, 99);
  assert.deepEqual(otraVersion, primero);
  assert.deepEqual([primero.estado, primero.creadas], ['confirmada', 3]);
  assert.deepEqual(await conteos(), antes);
});

test('volver a subir el mismo archivo: cada fila aparece como ya importada y no se puede crear de nuevo', opciones, async () => {
  const antes = await conteos();
  const { rows: previo } = await sql.query(
    `select id from importaciones where archivo_sha256 = $1 and estado = 'confirmada'`, ['a'.repeat(64)]);
  assert.deepEqual(previo.map((r) => r.id), [loteValido], 'la API puede avisar que el archivo ya se importó');

  const lote = await cargarLote(filasValidas, { archivo: '01-lote-valido.csv', sha: 'a'.repeat(64) });
  const filas = await filasDe(lote);
  for (const f of filas) {
    assert.equal(f.estado, 'posible_duplicado');
    assert.equal(f.decision, null, 'una coincidencia nunca recibe decisión automática');
    assert.ok(tipos(f).includes('ya_importada'), JSON.stringify(f.coincidencias));
  }
  assert.ok(tipos(filas[0]).includes('carpeta'));
  assert.ok(tipos(filas[1]).includes('nombre'), 'sin número, se reconoce por los datos y el nombre');

  for (const f of filas) await decidir(lote, f.numero_fila, 'crear');
  await assert.rejects(confirmar(lote, await version(lote)), (e) => {
    assert.equal(e.code, 'FEI02');
    const detalle = JSON.parse(e.detail);
    assert.deepEqual(detalle.map((d) => d.motivo), [
      'El número ya existe: vincule al caso existente o excluya',
      'La fila ya fue importada: vincule al caso existente o excluya',
      'El número ya existe: vincule al caso existente o excluya']);
    return true;
  });
  assert.deepEqual(await conteos(), antes);

  // Vincular cada fila al caso que ya creó el primer lote: queda registrado, nada se duplica.
  for (const f of filas) {
    const ya = f.coincidencias.find((c) => c.tipo === 'ya_importada');
    await decidir(lote, f.numero_fila, 'vincular', { caso: ya.casoId });
  }
  const r = await confirmar(lote, await version(lote));
  assert.deepEqual([r.creadas, r.vinculadas], [0, 3]);
  assert.deepEqual(await conteos(), antes);
  const originales = (await filasDe(loteValido)).map((f) => f.caso_id);
  assert.deepEqual((await filasDe(lote)).map((f) => f.caso_id), originales);
});

test('filas inválidas: cada error se informa por columna y ninguna se importa', opciones, async () => {
  const { filas } = await leerMuestra('muestras/02-lote-errores.csv');
  const antes = await conteos();
  const lote = await cargarLote(filas, { archivo: '02-lote-errores.csv' });
  const vista = await porReferencia(lote);
  const esperados = {
    'E-01': 'nombreCompleto', 'E-02': 'tipo', 'E-03': 'fechaIngreso', 'E-04': 'fechaIngreso',
    'E-05': 'fechaNacimiento', 'E-06': 'numeroCorrelativo', 'E-07': 'otraLocalidad', 'E-08': 'juzgado',
    'E-09': 'clasificacion', 'E-10': 'edadAlIngreso', 'E-11': 'fechaIngreso',
  };
  for (const [ref, campo] of Object.entries(esperados)) {
    assert.equal(vista[ref].estado, 'error', ref);
    assert.deepEqual(vista[ref].errores.map((e) => e.campo), [campo], `${ref}: ${JSON.stringify(vista[ref].errores)}`);
    assert.equal(vista[ref].decision, null);
  }
  assert.equal(vista['E-03'].errores[0].mensaje, 'Fecha inválida, use AAAA-MM-DD', '2026-02-30 no se convierte en marzo');
  assert.equal(vista['E-12'].estado, 'valida_nueva');

  await assert.rejects(confirmar(lote, 1), (e) => {
    assert.equal(e.code, 'FEI02');
    assert.equal(JSON.parse(e.detail).length, 11);
    return true;
  });
  assert.deepEqual(await conteos(), antes);

  // Una fila con error solo puede excluirse (o corregirse).
  await decidir(lote, 2, 'crear');
  await rechaza(confirmar(lote, await version(lote)), 'FEI02');
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update importacion_filas set decision = 'excluir' where importacion_id = $1 and estado = 'error'`, [lote]));
  await rechaza(confirmar(lote, 1), 'FEI01');
  const r = await confirmar(lote, await version(lote));
  assert.deepEqual([r.creadas, r.excluidas], [1, 11]);
  const despues = await conteos();
  assert.deepEqual([despues.pacientes, despues.casos], [antes.pacientes + 1, antes.casos + 1]);
  for (const f of await filasDe(lote)) {
    if (f.referencia_origen === 'E-12') continue;
    assert.deepEqual([f.resultado, f.paciente_id, f.caso_id], ['excluida', null, null]);
  }
  const lote2 = await cabecera(lote);
  assert.deepEqual([lote2.filas_total, lote2.filas_ok, lote2.filas_error], [12, 1, 11]);
});

test('validar_fila_importacion rechaza columnas desconocidas y valores que no son texto', opciones, async () => {
  const { rows: [{ e }] } = await sql.query(`select validar_fila_importacion($1) as e`, [{
    nombreCompleto: 'QA Columnas', tipo: 'voluntario', fechaIngreso: '2018-01-01', juzgadoX: 'x', edadAlIngreso: 5,
  }]);
  assert.deepEqual(e.map((x) => [x.campo, x.mensaje]).sort(),
    [['edadAlIngreso', 'Debe ser texto'], ['juzgadoX', 'Columna desconocida']]);
});

test('corregir una fila con error la vuelve válida y sube la versión', opciones, async () => {
  const lote = await cargarLote([{ referenciaOrigen: 'C-01', nombreCompleto: 'QA Beatriz Mendoza',
    tipo: 'voluntario', fechaIngreso: '2018-02-30' }]);
  assert.equal((await filasDe(lote))[0].estado, 'error');
  const cambiadas = await comoUsuario(sql, PERFILES.admin, async () => {
    await sql.query(`update importacion_filas set datos = jsonb_set(datos, '{fechaIngreso}', '"2018-02-28"')
                      where importacion_id = $1`, [lote]);
    return (await sql.query('select n from clasificar_importacion($1) n', [lote])).rows.map((r) => r.n);
  });
  assert.deepEqual(cambiadas, [2]);
  const [f] = await filasDe(lote);
  assert.deepEqual([f.estado, f.decision], ['valida_nueva', 'crear']);
  assert.equal(await version(lote), 2);
  await rechaza(confirmar(lote, 1), 'FEI01');
  assert.equal((await confirmar(lote, 2)).creadas, 1);
});

test('coincidencias con registros existentes y dentro del lote: decidir sin fusionar ni modificar', opciones, async () => {
  const { filas } = await leerMuestra('muestras/03-lote-duplicados.csv');
  const antes = await conteos();
  const huella = await huellaExistentes();
  const [antiguo] = existentes;
  const lote = await cargarLote(filas, { archivo: '03-lote-duplicados.csv' });
  const v = await porReferencia(lote);

  assert.equal(v['D-01'].estado, 'posible_duplicado');
  const carpeta = v['D-01'].coincidencias.find((c) => c.tipo === 'carpeta');
  assert.deepEqual([carpeta.casoId, carpeta.numero, carpeta.eliminado], [antiguo.id, 1, false]);
  assert.equal(v['D-02'].estado, 'posible_duplicado');
  assert.equal(v['D-02'].coincidencias.find((c) => c.tipo === 'nombre').pacienteId, antiguo.pacienteId);
  for (const ref of ['D-03', 'D-04']) {
    assert.equal(v[ref].estado, 'duplicado_en_lote', ref);
    assert.deepEqual(v[ref].coincidencias.map((c) => c.mismoNumero), [true]);
  }
  for (const ref of ['D-05', 'D-06']) {
    assert.equal(v[ref].estado, 'duplicado_en_lote', ref);
    assert.deepEqual(v[ref].coincidencias.map((c) => c.mismoNumero), [false]);
  }
  assert.deepEqual([v['D-07'].estado, v['D-07'].decision], ['valida_nueva', 'crear']);
  for (const ref of ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']) assert.equal(v[ref].decision, null, ref);

  // Crear lo que ya existe o dos carpetas con el mismo número no se acepta.
  for (const n of [2, 3, 4, 5, 6, 7]) await decidir(lote, n, 'crear');
  await assert.rejects(confirmar(lote, await version(lote)), (e) => {
    assert.equal(e.code, 'FEI02');
    assert.deepEqual(JSON.parse(e.detail).map((d) => [d.numeroFila, d.motivo]), [
      [2, 'El número ya existe: vincule al caso existente o excluya'],
      [4, 'Otra fila del lote usa el mismo número'],
      [5, 'Otra fila del lote usa el mismo número']]);
    return true;
  });
  await decidir(lote, 2, 'vincular', { paciente: antiguo.pacienteId });
  await rechaza(confirmar(lote, await version(lote)), 'FEI02');

  await decidir(lote, 2, 'vincular', { caso: antiguo.id });            // misma carpeta: solo se registra
  await decidir(lote, 3, 'vincular', { paciente: antiguo.pacienteId }); // mismo paciente, carpeta nueva
  await decidir(lote, 5, 'excluir');                                    // D-04 choca con D-03
  await decidir(lote, 7, 'vincular', { fila: 6 });                      // D-06 es la persona de D-05
  const r = await confirmar(lote, await version(lote));
  assert.deepEqual([r.creadas, r.vinculadas, r.excluidas], [3, 3, 1]);

  const despues = await conteos();
  assert.equal(despues.pacientes, antes.pacientes + 3, 'D-03, D-05 y D-07');
  assert.equal(despues.casos, antes.casos + 5, 'D-02, D-03, D-05, D-06 y D-07');
  assert.equal(await huellaExistentes(), huella, 'el caso y el paciente existentes no cambian');

  const f = await porReferencia(lote);
  assert.deepEqual([f['D-01'].resultado, f['D-01'].caso_id, f['D-01'].paciente_id],
    ['vinculada', antiguo.id, antiguo.pacienteId]);
  assert.equal(f['D-02'].paciente_id, antiguo.pacienteId);
  assert.notEqual(f['D-02'].caso_id, antiguo.id);
  assert.equal(f['D-06'].paciente_id, f['D-05'].paciente_id);
  assert.notEqual(f['D-06'].caso_id, f['D-05'].caso_id);
  const { rows: numeros } = await sql.query(
    'select numero_correlativo from casos where id = any ($1) order by 1', [[f['D-05'].caso_id, f['D-06'].caso_id]]);
  assert.deepEqual(numeros.map((n) => n.numero_correlativo), [41, 42]);
  assert.deepEqual([f['D-04'].resultado, f['D-04'].caso_id], ['excluida', null]);
  assert.equal(f['D-01'].decidido_por, PERFILES.admin);
});

test('un fallo a mitad de la confirmación revierte el lote completo y el reintento no pierde ni duplica', opciones, async () => {
  const lote = await cargarLote([
    { referenciaOrigen: 'F-01', nombreCompleto: 'QA Ricardo Salinas', tipo: 'voluntario', numeroCorrelativo: '500', fechaIngreso: '2016-01-04' },
    { referenciaOrigen: 'F-02', nombreCompleto: 'QA Teresa Gutiérrez', tipo: 'derivado', fechaIngreso: '2016-01-05', juzgado: 'Juzgado QA' },
    { referenciaOrigen: 'F-03', nombreCompleto: 'QA Wilson Mamani', tipo: 'voluntario', fechaIngreso: '2016-01-06', comentariosClinicos: 'FALLA' },
  ]);
  for (const f of await filasDe(lote)) assert.equal(f.estado, 'valida_nueva', JSON.stringify(f.coincidencias));
  const antes = await conteos();
  // Solo en esta base de prueba: la tercera inserción falla.
  await sql.query(`create function qa_falla() returns trigger language plpgsql as $$
    begin if new.comentarios_clinicos = 'FALLA' then raise exception 'Fallo simulado'; end if; return new; end $$;
    create trigger qa_falla before insert on casos for each row execute function qa_falla()`);
  await assert.rejects(confirmar(lote, 1), /Fallo simulado/);

  assert.deepEqual(await conteos(), antes, 'ni pacientes, ni casos, ni contexto judicial, ni contadores');
  assert.equal((await cabecera(lote)).estado, 'en_revision');
  assert.equal(await version(lote), 1);
  for (const f of await filasDe(lote)) assert.deepEqual([f.resultado, f.paciente_id, f.caso_id], [null, null, null]);

  await sql.query('drop trigger qa_falla on casos; drop function qa_falla()');
  const r = await confirmar(lote, 1);
  assert.equal(r.creadas, 3);
  const despues = await conteos();
  assert.deepEqual([despues.pacientes, despues.casos, despues.judicial],
    [antes.pacientes + 3, antes.casos + 3, antes.judicial + 1]);
  assert.equal(despues.contadores.voluntario, 501);
});

test('si otra alta ocupa el número después de la vista previa, la confirmación pide revisar', opciones, async () => {
  const lote = await cargarLote([{ referenciaOrigen: 'R-01', nombreCompleto: 'QA Hugo Paredes',
    tipo: 'voluntario', numeroCorrelativo: '600', fechaIngreso: '2016-03-01' }]);
  assert.equal((await filasDe(lote))[0].decision, 'crear');
  const otro = await comoUsuario(sql, PERFILES.admin, async () => {
    const p = await sql.query(`insert into pacientes (nombre_completo) values ('QA Gladys Rocha') returning id`);
    return (await sql.query(
      `insert into casos (paciente_id, tipo, numero_correlativo) values ($1, 'voluntario', 600) returning id`,
      [p.rows[0].id])).rows[0].id;
  });
  const antes = await conteos();
  const r = await confirmar(lote, 1);
  assert.deepEqual([r.estado, r.filas, r.version], ['revisar', [2], 2]);
  assert.deepEqual(await conteos(), antes);
  const [f] = await filasDe(lote);
  assert.deepEqual([f.estado, f.decision], ['posible_duplicado', null], 'la decisión anterior se vuelve a pedir');
  assert.equal(f.coincidencias.find((c) => c.tipo === 'carpeta').casoId, otro);

  await decidir(lote, 2, 'vincular', { caso: otro });
  assert.equal((await confirmar(lote, await version(lote))).vinculadas, 1);
  assert.deepEqual(await conteos(), antes);
});

test('dos confirmaciones simultáneas: una aplica el lote y la otra devuelve el mismo resultado', opciones, async () => {
  const lote = await cargarLote([
    { referenciaOrigen: 'S-01', nombreCompleto: 'QA Silvia Ortiz', tipo: 'voluntario', fechaIngreso: '2016-05-01' },
    { referenciaOrigen: 'S-02', nombreCompleto: 'QA Ramiro Flores', tipo: 'voluntario', fechaIngreso: '2016-05-02' },
  ]);
  const antes = await conteos();
  const [c1, c2] = [await base.conectar(), await base.conectar()];
  try {
    const [r1, r2] = await Promise.all([confirmar(lote, 1, { cliente: c1 }), confirmar(lote, 1, { cliente: c2 })]);
    assert.deepEqual(r1, r2);
    assert.equal(r1.creadas, 2);
  } finally {
    await c1.end();
    await c2.end();
  }
  const despues = await conteos();
  assert.deepEqual([despues.pacientes, despues.casos], [antes.pacientes + 2, antes.casos + 2]);
});

test('un lote confirmado o descartado no cambia; confirmar exige usuario', opciones, async () => {
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update importacion_filas set decision = 'excluir' where importacion_id = $1`, [loteValido])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    'delete from importacion_filas where importacion_id = $1', [loteValido])), '23514');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update importaciones set origen = 'otro' where id = $1`, [loteValido])), '23514');

  const lote = await cargarLote([{ referenciaOrigen: 'X-01', nombreCompleto: 'QA Norma Vela',
    tipo: 'voluntario', fechaIngreso: '2016-06-01' }]);
  await sql.query('begin');
  await rechaza(sql.query('select confirmar_importacion($1, 1)', [lote]), '42501');
  await sql.query('rollback');
  await comoUsuario(sql, PERFILES.admin, () => sql.query(
    `update importaciones set estado = 'descartada' where id = $1`, [lote]));
  await rechaza(confirmar(lote, 1), 'FEI03');
  await rechaza(comoUsuario(sql, PERFILES.admin, () => sql.query(
    `insert into importacion_filas (importacion_id, numero_fila, datos) values ($1, 3, '{}')`, [lote])), '23514');
  await rechaza(confirmar('00000000-0000-4000-8000-0000000000ff', 1), 'P0002');
});

test('números consecutivos al contador o por debajo de él no requieren aceptar un salto', opciones, async () => {
  const { contadores } = await conteos();
  const lote = await cargarLote([
    { referenciaOrigen: 'K-01', nombreCompleto: 'QA Elena Cusi', tipo: 'voluntario',
      numeroCorrelativo: String(contadores.voluntario + 1), fechaIngreso: '2015-01-05' },
    { referenciaOrigen: 'K-02', nombreCompleto: 'QA Óscar Laura', tipo: 'voluntario',
      numeroCorrelativo: String(contadores.voluntario + 2), fechaIngreso: '2015-01-06' },
    { referenciaOrigen: 'K-03', nombreCompleto: 'QA Inés Ticona', tipo: 'voluntario',
      numeroCorrelativo: '550', fechaIngreso: '2015-01-07' },
  ]);
  for (const f of await filasDe(lote)) assert.equal(f.estado, 'valida_nueva', JSON.stringify(f.coincidencias));
  const r = await confirmar(lote, 1, { acepta: false });
  assert.equal(r.creadas, 3);
  assert.equal((await conteos()).contadores.voluntario, contadores.voluntario + 2);
  assert.equal((await cabecera(lote)).acepta_avance_contador, false);
});

test('ejemplo de FE-162: estados esperados de las siete filas de Andrea', opciones, async () => {
  await comoUsuario(sql, PERFILES.admin, async () => {
    const p = await sql.query(`insert into pacientes (nombre_completo) values ('Paciente QA A') returning id`);
    await sql.query(`insert into casos (paciente_id, tipo, numero_correlativo) values ($1, 'voluntario', 101)`,
      [p.rows[0].id]);
  });
  const { filas } = await leerMuestra('muestras/04-ejemplo-fe162.csv');
  const lote = await cargarLote(filas, { archivo: '04-ejemplo-fe162.csv' });
  const v = await porReferencia(lote);
  assert.deepEqual(Object.fromEntries(Object.entries(v).map(([k, f]) => [k, f.estado])), {
    'QA-001': 'duplicado_en_lote', 'QA-002': 'posible_duplicado', 'QA-003': 'error', 'QA-004': 'error',
    'QA-005': 'duplicado_en_lote', 'QA-006': 'error', 'QA-007': 'valida_nueva',
  });
  assert.deepEqual(v['QA-003'].errores.map((e) => e.campo), ['fechaIngreso']);
  assert.deepEqual(v['QA-004'].errores.map((e) => e.campo), ['nombreCompleto']);
  assert.deepEqual(v['QA-006'].errores.map((e) => e.campo), ['otraLocalidad']);
  const coincidencias = v['QA-002'].coincidencias;
  assert.deepEqual(coincidencias.filter((c) => c.tipo === 'carpeta').map((c) => c.numero), [101]);
  // El más parecido primero; "QA Paciente Antiguo" (0.62) también supera el umbral de 0.6 del alta manual.
  assert.deepEqual(coincidencias.filter((c) => c.tipo === 'nombre').map((c) => [c.nombreCompleto, c.similitud]),
    [['Paciente QA A', 1], ['QA Paciente Antiguo', 0.62]]);
  // Los números 9000xx moverían el contador muy por encima de la numeración real.
  assert.match(v['QA-001'].advertencias[0].mensaje, /contador pasará a 900001/);

  // Sin aceptar el salto, confirmar se detiene y no escribe nada.
  await decidir(lote, 2, 'crear');                                       // QA-001
  await decidir(lote, 3, 'vincular', { caso: coincidencias.find((c) => c.tipo === 'carpeta').casoId }); // QA-002
  for (const n of [4, 5, 6, 7]) await decidir(lote, n, 'excluir');       // QA-003..006 (QA-005 choca con QA-001)
  const antes = await conteos();
  await assert.rejects(confirmar(lote, await version(lote), { acepta: false }), (e) => {
    assert.equal(e.code, 'FEI04');
    assert.deepEqual(JSON.parse(e.detail), [
      { tipo: 'derivado', ultimoActual: antes.contadores.derivado, nuevoUltimo: 900007 },
      { tipo: 'voluntario', ultimoActual: antes.contadores.voluntario, nuevoUltimo: 900001 }]);
    return true;
  });
  assert.deepEqual(await conteos(), antes);
  // Aceptado de forma explícita: se aplica y queda registrado en el lote.
  const r = await confirmar(lote, await version(lote), { acepta: true });
  assert.deepEqual([r.creadas, r.vinculadas, r.excluidas], [2, 1, 4]);
  assert.deepEqual((await conteos()).contadores, { voluntario: 900001, derivado: 900007 });
  assert.equal((await cabecera(lote)).acepta_avance_contador, true);
});

test('permisos: RLS activa y sin acceso directo a tablas ni funciones', opciones, async () => {
  const { rows } = await sql.query(
    `select relname, relrowsecurity from pg_class where relname in ('importaciones', 'importacion_filas') order by 1`);
  assert.deepEqual(rows.map((r) => [r.relname, r.relrowsecurity]), [['importacion_filas', true], ['importaciones', true]]);
  const rol = `fe163_sin_permisos_${process.pid}`;
  await sql.query(`create role ${rol} nologin`);
  try {
    const { rows: [p] } = await sql.query(
      `select has_table_privilege($1, 'importacion_filas', 'select') as filas,
              has_table_privilege($1, 'importaciones', 'select') as lotes,
              has_function_privilege($1, 'confirmar_importacion(uuid, int, boolean)', 'execute') as confirmar,
              has_function_privilege($1, 'clasificar_importacion(uuid)', 'execute') as clasificar`, [rol]);
    assert.deepEqual(p, { filas: false, lotes: false, confirmar: false, clasificar: false });
  } finally {
    await sql.query(`drop role ${rol}`);
  }
});

test('migración 017 sobre datos existentes: no altera registros y deja la tabla de 001 utilizable', opciones, async () => {
  const b = await crearBase('fe163_mig', { hasta: '016' });
  try {
    const c = b.cliente;
    const caso = await crearCaso(c, { nombre: 'QA Previo a 017' });
    await c.query(`insert into importaciones (perfil_id, archivo_nombre, filas_total) values ($1, 'viejo.csv', 4)`,
      [PERFILES.admin]);
    const foto = async () => (await c.query(
      `select md5(string_agg(t, '|' order by t)) as m from (
         select p::text as t from pacientes p union all select x::text from casos x
         union all select k::text from contadores_caso k) z`)).rows[0].m;
    const antes = await foto();
    await b.migrar();
    assert.equal(await foto(), antes);
    const { rows: [viejo] } = await c.query(`select archivo_nombre, filas_total, estado, version from importaciones`);
    assert.deepEqual(viejo, { archivo_nombre: 'viejo.csv', filas_total: 4, estado: 'en_revision', version: 1 });
    const id = (await c.query('select id from importaciones')).rows[0].id;
    await c.query('begin');
    await c.query(`select set_config('app.usuario_id', $1, true)`, [PERFILES.admin]);
    await rechaza(c.query('select confirmar_importacion($1, 1)', [id]), 'FEI02');
    await c.query('rollback');
    assert.ok(caso.id);
  } finally {
    await b.cerrar();
  }
});

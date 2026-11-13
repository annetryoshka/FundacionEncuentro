// FE-84: consultas revisadas del historial clínico (FE-57).
// Cada sección se consulta por separado con el id del caso ($1), ya autorizado por la API.
// No se unen sesiones, tareas y pagos en una sola consulta: eso multiplica filas.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, crearCaso, crearSesion, opciones } from './helpers/pg-qa.mjs';

const CONSULTAS_HISTORIAL = {
  // Datos judiciales del alta (solo carpetas derivadas).
  contexto: `
    select juzgado, nro_expediente, to_char(fecha_derivacion, 'YYYY-MM-DD') as fecha_derivacion
      from contexto_judicial where caso_id = $1`,
  // Procedencia y constancia (FE-63).
  constancia: `
    select procedencia, origen_judicial, estado,
           to_char(fecha_consentimiento, 'YYYY-MM-DD') as fecha_consentimiento,
           referencia_evidencia, explicacion, actualizado_por, actualizado_en
      from constancias_atencion where caso_id = $1`,
  // Ficha de diagnóstico (FE-68): los campos van en contenido.
  diagnostico: `
    select id, to_char(fecha, 'YYYY-MM-DD') as fecha,
           contenido ->> 'diagnosticoIngreso' as diagnostico_ingreso,
           contenido ->> 'hipotesisRelacional' as hipotesis_relacional,
           contenido ->> 'comentariosClinicos' as comentarios_clinicos,
           creado_por, creado_en, actualizado_por, actualizado_en
      from fichas_diagnostico where caso_id = $1`,
  // nro_sesion es único en el caso: (fecha, nro_sesion) da un orden estable.
  sesiones: `
    select s.id, s.nro_sesion, to_char(s.fecha, 'YYYY-MM-DD') as fecha, s.evolucion,
           r.id as responsable_id, r.nombre_completo as responsable
      from fichas_seguimiento s
      join perfiles r on r.id = s.responsable_id
     where s.caso_id = $1
     order by s.fecha, s.nro_sesion`,
  // La API agrupa las tareas por sesion_id dentro de cada sesión.
  tareas: `
    select t.id, t.sesion_id, t.descripcion, t.completada,
           t.cumplimiento_actualizado_por, t.cumplimiento_actualizado_en
      from tareas_terapeuticas t
      join fichas_seguimiento s on s.id = t.sesion_id
     where t.caso_id = $1
     order by s.fecha, s.nro_sesion, t.creado_en, t.id`,
  // Solo para administración. monto va como texto para no perder centavos en JavaScript.
  pagos: `
    select g.id, g.sesion_id, s.nro_sesion, to_char(g.fecha, 'YYYY-MM-DD') as fecha,
           g.monto::text as monto, g.metodo, g.referencia
      from pagos g
      join fichas_seguimiento s on s.id = g.sesion_id
     where g.caso_id = $1
     order by g.fecha, s.nro_sesion`,
};

let base, sql;
const datos = {};
before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe84'); sql = base.cliente;
  // Dos carpetas con las mismas fechas, para que una mezcla se note.
  for (const [clave, terapeuta] of [['A', PERFILES.t1], ['B', PERFILES.t2]]) {
    const caso = await crearCaso(sql, { nombre: `QA historial ${clave}`, terapeuta });
    const s1 = await crearSesion(sql, caso.id, { fecha: '2026-10-12', evolucion: `${clave} uno`, responsable: terapeuta });
    const s2 = await crearSesion(sql, caso.id, { fecha: '2026-10-12', evolucion: `${clave} dos`, responsable: terapeuta });
    await comoUsuario(sql, terapeuta, () => sql.query(
      `insert into fichas_diagnostico (caso_id, fecha, contenido, creado_por, actualizado_por)
       values ($1, '2026-10-12', $2::jsonb, $3, $3)`,
      [caso.id, JSON.stringify({ diagnosticoIngreso: `Diagnóstico ${clave}` }), terapeuta]));
    // Cada tarea en su propia transacción, como llegan desde la API (creado_en distinto).
    for (const [sesion, descripcion] of [[s1, `${clave} tarea 1`], [s1, `${clave} tarea 2`], [s2, `${clave} tarea 3`]]) {
      await comoUsuario(sql, terapeuta, () => sql.query(
        'insert into tareas_terapeuticas (caso_id, sesion_id, descripcion) values ($1, $2, $3)',
        [caso.id, sesion.id, descripcion]));
    }
    await comoUsuario(sql, PERFILES.admin, async () => {
      await sql.query(`insert into constancias_atencion (caso_id, origen_judicial, estado, creado_por, actualizado_por)
                       values ($1, false, 'pendiente', $2, $2)`, [caso.id, PERFILES.admin]);
      for (const sesion of [s1, s2]) {
        await sql.query(`insert into pagos (caso_id, sesion_id, fecha, monto, metodo) values ($1, $2, '2026-10-12', '50.00', 'qr')`,
          [caso.id, sesion.id]);
      }
    });
    datos[clave] = { caso, sesiones: [s1.id, s2.id] };
  }
});
after(async () => { await base?.cerrar(); });

const historial = async (casoId) => {
  const resultado = {};
  for (const [seccion, consulta] of Object.entries(CONSULTAS_HISTORIAL)) {
    resultado[seccion] = (await sql.query(consulta, [casoId])).rows;
  }
  return resultado;
};

test('FE-84: cada carpeta ve solo sus registros, sin duplicados', opciones, async () => {
  for (const clave of ['A', 'B']) {
    const h = await historial(datos[clave].caso.id);
    assert.equal(h.contexto.length, 0);   // caso voluntario sin contexto: la UI muestra «Sin registro»
    assert.equal(h.constancia.length, 1);
    assert.equal(h.diagnostico.length, 1);
    assert.equal(h.diagnostico[0].diagnostico_ingreso, `Diagnóstico ${clave}`);
    assert.deepEqual(h.sesiones.map((s) => s.evolucion), [`${clave} uno`, `${clave} dos`]);
    assert.deepEqual(h.tareas.map((t) => t.descripcion), [`${clave} tarea 1`, `${clave} tarea 2`, `${clave} tarea 3`]);
    assert.equal(h.pagos.length, 2);
    // Todo lo que apunta a una sesión apunta a una sesión de esta carpeta.
    const propias = new Set(datos[clave].sesiones);
    assert.ok([...h.tareas, ...h.pagos].every((fila) => propias.has(fila.sesion_id)));
    // Sin ids repetidos en ninguna sección.
    for (const filas of Object.values(h)) {
      const ids = filas.filter((f) => f.id).map((f) => f.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('FE-84: las tareas quedan dentro de la sesión correcta', opciones, async () => {
  const h = await historial(datos.A.caso.id);
  const porSesion = Object.fromEntries(h.sesiones.map((s) => [s.nro_sesion,
    h.tareas.filter((t) => t.sesion_id === s.id).map((t) => t.descripcion)]));
  assert.deepEqual(porSesion, { 1: ['A tarea 1', 'A tarea 2'], 2: ['A tarea 3'] });
});

test('FE-84: el orden es estable entre consultas repetidas', opciones, async () => {
  const primera = await historial(datos.B.caso.id);
  const segunda = await historial(datos.B.caso.id);
  assert.deepEqual(segunda, primera);
});

test('FE-84: unir sesiones, tareas y pagos en una consulta duplica filas (por eso se separan)', opciones, async () => {
  const { rows } = await sql.query(
    `select s.id from fichas_seguimiento s
       left join tareas_terapeuticas t on t.sesion_id = s.id
       left join pagos g on g.sesion_id = s.id
      where s.caso_id = $1`, [datos.A.caso.id]);
  assert.equal(rows.length, 3);                  // 2 sesiones aparecen 3 veces
  assert.equal(new Set(rows.map((r) => r.id)).size, 2);
});

// FE-142: publicaciones de difusión, estados, imágenes y consulta pública (contrato de FE-140).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql;
before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe142'); sql = base.cliente;
});
after(async () => { await base?.cerrar(); });

const ACTIVIDAD = {
  tipo: 'actividad', titulo: 'Actividad ficticia QA', resumen: 'Texto de prueba para revisar el portal.',
  contenido: 'Ejemplo sin datos de pacientes.', fecha_inicio: '2026-12-01', fecha_fin: '2026-12-01',
  modalidad: 'presencial', lugar: 'Lugar ficticio de QA', contacto_url: null,
};

const crear = (datos = {}, usuario = PERFILES.marketing) => comoUsuario(sql, usuario, async () => {
  const campos = { ...ACTIVIDAD, ...datos };
  const columnas = Object.keys(campos);
  const { rows } = await sql.query(
    `insert into publicaciones_difusion (${columnas.join(', ')})
     values (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(campos));
  return rows[0];
});
const cambiar = (id, datos, usuario = PERFILES.marketing) => comoUsuario(sql, usuario, async () => {
  const columnas = Object.keys(datos);
  const { rows } = await sql.query(
    `update publicaciones_difusion set ${columnas.map((c, i) => `${c} = $${i + 2}`).join(', ')}
      where id = $1 returning *`, [id, ...Object.values(datos)]);
  return rows[0];
});
const leer = async (id) => (await sql.query('select * from publicaciones_difusion where id = $1', [id])).rows[0];
const publica = async (id) => (await sql.query('select * from v_publicaciones_publicas where id = $1', [id])).rows[0];
const imagen = (publicacionId, datos = {}) => comoUsuario(sql, PERFILES.marketing, () => {
  const campos = { publicacion_id: publicacionId, ruta: `publicaciones/${publicacionId}/portada.webp`,
    tipo_mime: 'image/webp', tamano_bytes: 120000, ancho: 1200, alto: 630,
    texto_alternativo: 'Ilustración ficticia de la actividad', principal: true, ...datos };
  const columnas = Object.keys(campos);
  return sql.query(`insert into recursos_difusion (${columnas.join(', ')})
    values (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(campos));
});

test('FE-142: sin publicaciones la vista pública está vacía, no falla', opciones, async () => {
  assert.equal((await sql.query('select count(*)::int as n from v_publicaciones_publicas')).rows[0].n, 0);
});

test('FE-142: crear deja un borrador de quien lo crea, fuera de la vista pública', opciones, async () => {
  const p = await crear({ publicado_en: '2026-01-01T00:00:00Z', creado_por: PERFILES.admin });
  assert.equal(p.estado, 'borrador');
  assert.equal(p.creado_por, PERFILES.marketing);
  assert.equal(p.actualizado_por, PERFILES.marketing);
  assert.equal(p.publicado_en, null);
  assert.equal(await publica(p.id), undefined);
  await rechaza(crear({ estado: 'publicado' }), '23514');
  await rechaza(crear({ estado: 'retirado' }), '23514');
});

test('FE-142: campos inválidos se rechazan', opciones, async () => {
  for (const datos of [
    { tipo: 'taller' }, { titulo: '   ' }, { titulo: 'x'.repeat(151) }, { resumen: 'x'.repeat(501) },
    { contenido: 'x'.repeat(10001) }, { modalidad: 'hibrida' }, { lugar: ' ' }, { lugar: 'x'.repeat(201) },
    { contacto_url: 'javascript:alert(1)' }, { contacto_url: 'ftp://fundacion.test' }, { contacto_url: 'https://' },
    { contacto_url: 'https://fundacion .test' }, { fecha_inicio: '2026-12-02', fecha_fin: '2026-12-01' },
  ]) {
    await rechaza(crear(datos), '23514');
  }
  await rechaza(crear({ titulo: null }), '23502');
  await rechaza(crear({ tipo: null }), '23502');
  for (const datos of [
    { titulo: 'x'.repeat(150), resumen: 'x'.repeat(500) }, { contacto_url: 'https://fundacion.test/contacto?via=qa' },
    { tipo: 'campana', fecha_inicio: null, fecha_fin: null, modalidad: null, lugar: null }, { tipo: 'curso', modalidad: 'virtual' },
  ]) {
    assert.equal((await crear(datos)).estado, 'borrador');
  }
});

test('FE-142: publicar incompleto falla y conserva el borrador', opciones, async () => {
  const p = await crear({ resumen: null });
  await rechaza(cambiar(p.id, { estado: 'publicado' }), '23514');
  await rechaza(cambiar(p.id, { estado: 'publicado', resumen: '   ' }), '23514');
  const guardado = await leer(p.id);
  assert.equal(guardado.estado, 'borrador');
  assert.equal(guardado.titulo, ACTIVIDAD.titulo);
  assert.equal(guardado.contenido, ACTIVIDAD.contenido);
});

test('FE-142: publicar, editar publicado, retirar y volver a borrador', opciones, async () => {
  const p = await crear();
  const publicada = await cambiar(p.id, { estado: 'publicado' });
  assert.ok(publicada.publicado_en);
  assert.equal(publicada.publicado_por, PERFILES.marketing);
  assert.deepEqual(await publica(p.id), {
    id: p.id, tipo: 'actividad', titulo: ACTIVIDAD.titulo, resumen: ACTIVIDAD.resumen, contenido: ACTIVIDAD.contenido,
    fecha_inicio: publicada.fecha_inicio, fecha_fin: publicada.fecha_fin, modalidad: 'presencial', lugar: ACTIVIDAD.lugar,
    contacto_url: null, publicado_en: publicada.publicado_en,
    imagen_ruta: null, imagen_texto_alternativo: null, imagen_ancho: null, imagen_alto: null,
  });

  // Editar lo publicado: conserva autoría y fecha de publicación; el cliente no puede falsificarlas.
  const editada = await cambiar(p.id, { titulo: 'Actividad ficticia QA (editada)', publicado_en: '2020-01-01T00:00:00Z',
    publicado_por: PERFILES.t1, creado_por: PERFILES.t1 }, PERFILES.admin);
  assert.equal(editada.estado, 'publicado');
  assert.deepEqual([editada.publicado_en, editada.publicado_por, editada.creado_por],
    [publicada.publicado_en, PERFILES.marketing, PERFILES.marketing]);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  assert.equal((await publica(p.id)).titulo, 'Actividad ficticia QA (editada)');

  const retirada = await cambiar(p.id, { estado: 'retirado' }, PERFILES.admin);
  assert.ok(retirada.retirado_en);
  assert.equal(retirada.retirado_por, PERFILES.admin);
  assert.equal(await publica(p.id), undefined);

  const corregida = await cambiar(p.id, { estado: 'borrador', resumen: 'Resumen corregido de QA.' });
  assert.equal(await publica(p.id), undefined);
  const republicada = await cambiar(corregida.id, { estado: 'publicado' });
  assert.ok(republicada.publicado_en > publicada.publicado_en);
  assert.equal((await publica(p.id)).resumen, 'Resumen corregido de QA.');
});

test('FE-142: transiciones no previstas se rechazan', opciones, async () => {
  const borrador = await crear();
  await rechaza(cambiar(borrador.id, { estado: 'retirado' }), '23514');
  const publicada = await crear();
  await cambiar(publicada.id, { estado: 'publicado' });
  await rechaza(cambiar(publicada.id, { estado: 'borrador' }), '23514');
  await cambiar(publicada.id, { estado: 'retirado' });
  await rechaza(cambiar(publicada.id, { estado: 'publicado' }), '23514');
  await rechaza(cambiar(publicada.id, { estado: 'eliminado' }), '23514');
  assert.equal((await leer(borrador.id)).estado, 'borrador');
  assert.equal((await leer(publicada.id)).estado, 'retirado');
});

test('FE-142: imágenes con metadatos válidos y una sola principal', opciones, async () => {
  const p = await crear();
  for (const datos of [
    { tipo_mime: 'application/pdf' }, { tipo_mime: 'image/svg+xml' }, { tamano_bytes: 0 }, { tamano_bytes: 5242881 },
    { ancho: 0 }, { texto_alternativo: '  ' }, { texto_alternativo: 'x'.repeat(301) }, { ruta: '../casos/genograma.png' },
    { ruta: '/publicaciones/a.png' }, { ruta: 'publicaciones/a b.png' }, { almacenamiento: 'genogramas' }, { sha256: 'abc' },
  ]) {
    await rechaza(imagen(p.id, datos), '23514');
  }
  await rechaza(imagen(p.id, { texto_alternativo: null }), '23502');
  // Un fallo de imagen no toca el texto ya guardado.
  assert.equal((await leer(p.id)).titulo, ACTIVIDAD.titulo);

  await imagen(p.id, { sha256: 'a'.repeat(64) });
  await rechaza(imagen(p.id, { ruta: `publicaciones/${p.id}/otra.png`, tipo_mime: 'image/png' }), '23505');
  await rechaza(imagen(p.id, { principal: false }), '23505'); // misma ruta
  await imagen(p.id, { ruta: `publicaciones/${p.id}/galeria-1.jpg`, tipo_mime: 'image/jpeg', principal: false });

  await cambiar(p.id, { estado: 'publicado' });
  const vista = await publica(p.id);
  assert.deepEqual([vista.imagen_ruta, vista.imagen_texto_alternativo, vista.imagen_ancho, vista.imagen_alto],
    [`publicaciones/${p.id}/portada.webp`, 'Ilustración ficticia de la actividad', 1200, 630]);
  assert.equal((await sql.query('select count(*)::int as n from v_publicaciones_publicas where id = $1', [p.id])).rows[0].n, 1);

  await comoUsuario(sql, PERFILES.admin, () => sql.query('delete from publicaciones_difusion where id = $1', [p.id]));
  assert.equal((await sql.query('select count(*)::int as n from recursos_difusion where publicacion_id = $1', [p.id])).rows[0].n, 0);
});

test('FE-142: la vista pública solo expone lo publicado y campos permitidos', opciones, async () => {
  const { rows: columnas } = await sql.query(
    `select column_name from information_schema.columns where table_name = 'v_publicaciones_publicas' order by ordinal_position`);
  assert.deepEqual(columnas.map((c) => c.column_name), [
    'id', 'tipo', 'titulo', 'resumen', 'contenido', 'fecha_inicio', 'fecha_fin', 'modalidad', 'lugar', 'contacto_url',
    'publicado_en', 'imagen_ruta', 'imagen_texto_alternativo', 'imagen_ancho', 'imagen_alto',
  ]);
  const { rows } = await sql.query(
    `select (select count(*)::int from v_publicaciones_publicas) as vista,
            (select count(*)::int from publicaciones_difusion where estado = 'publicado') as publicadas,
            (select count(*)::int from publicaciones_difusion where estado <> 'publicado') as privadas`);
  assert.equal(rows[0].vista, rows[0].publicadas);
  assert.ok(rows[0].privadas > 0);
  const { rows: [{ n }] } = await sql.query(
    `select count(*)::int as n from v_publicaciones_publicas v
       join publicaciones_difusion p using (id) where p.estado <> 'publicado'`);
  assert.equal(n, 0);
});

test('FE-142: difusión separada de lo clínico; RLS activo', opciones, async () => {
  const { rows } = await sql.query(
    `select distinct ccu.table_name as destino
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu using (constraint_schema, constraint_name)
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_name in ('publicaciones_difusion', 'recursos_difusion') order by 1`);
  assert.deepEqual(rows.map((f) => f.destino), ['perfiles', 'publicaciones_difusion']);
  const { rows: rls } = await sql.query(
    `select relname, relrowsecurity from pg_class
      where relname in ('publicaciones_difusion', 'recursos_difusion') order by relname`);
  assert.deepEqual(rls.map((f) => f.relrowsecurity), [true, true]);
});

test('FE-142: los cambios quedan en auditoría con su autor', opciones, async () => {
  const p = await crear();
  await cambiar(p.id, { estado: 'publicado' }, PERFILES.admin);
  const { rows } = await sql.query(
    `select accion, usuario_id, datos_anteriores ->> 'estado' as antes, datos_nuevos ->> 'estado' as despues
       from auditoria where tabla = 'publicaciones_difusion' and registro_id = $1 order by id`, [p.id]);
  assert.deepEqual(rows, [
    { accion: 'INSERT', usuario_id: PERFILES.marketing, antes: null, despues: 'borrador' },
    { accion: 'UPDATE', usuario_id: PERFILES.admin, antes: 'borrador', despues: 'publicado' },
  ]);
});

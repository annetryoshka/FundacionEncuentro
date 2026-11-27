// FE-183: investigaciones públicas sobre publicaciones_foro (migración 023, contrato FE-182). Sin comentarios. Datos ficticios.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PERFILES, comoUsuario, crearBase, opciones, rechaza } from './helpers/pg-qa.mjs';

let base, sql, previo;

const ARTICULO = {
  titulo: 'Investigación ficticia QA', resumen: 'Resumen ficticio para revisar el portal.',
  contenido: 'Texto ficticio sin datos de pacientes.', autor_visible: 'Equipo QA',
};

const crear = (datos = {}, usuario = PERFILES.marketing) => comoUsuario(sql, usuario, async () => {
  const campos = { ...ARTICULO, ...datos };
  const columnas = Object.keys(campos);
  const { rows } = await sql.query(
    `insert into publicaciones_foro (${columnas.join(', ')})
     values (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(campos));
  return rows[0];
});
const cambiar = (id, datos, usuario = PERFILES.marketing) => comoUsuario(sql, usuario, async () => {
  const columnas = Object.keys(datos);
  const { rows } = await sql.query(
    `update publicaciones_foro set ${columnas.map((c, i) => `${c} = $${i + 2}`).join(', ')}
      where id = $1 returning *`, [id, ...Object.values(datos)]);
  return rows[0];
});
const borrar = (id, usuario = PERFILES.admin) => comoUsuario(sql, usuario, () =>
  sql.query('delete from publicaciones_foro where id = $1', [id]));
const leer = async (id) => (await sql.query('select * from publicaciones_foro where id = $1', [id])).rows[0];
const publica = async (id) => (await sql.query('select * from v_investigaciones_publicas where id = $1', [id])).rows[0];
const fechaLaPaz = (instante) => instante.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
// 024: archivo ficticio en imagenes_publicas (la base no decodifica; el backend valida el formato).
const archivo = () => comoUsuario(sql, PERFILES.marketing, async () => {
  const contenido = Buffer.from(`RIFF\0\0\0\0WEBPVP8 ${randomUUID()}`);
  const { rows } = await sql.query(
    `insert into imagenes_publicas (tipo_mime, tamano_bytes, ancho, alto, contenido)
     values ('image/webp', $1, 800, 400, $2) returning id`, [contenido.length, contenido]);
  return rows[0].id;
});
const existeArchivo = async (id) =>
  (await sql.query('select count(*)::int as n from imagenes_publicas where id = $1', [id])).rows[0].n === 1;

before(async () => {
  if (opciones.skip) return;
  // Un artículo cargado con 001–022 (sin estado); la 023 se aplica después, como en Supabase.
  base = await crearBase('fe183', { hasta: '022' });
  sql = base.cliente;
  await sql.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000aa')`);
  await sql.query(`insert into perfiles (id, nombre_completo, rol) values ('00000000-0000-4000-8000-0000000000aa', 'Autor previo QA', 'administrador')`);
  previo = (await sql.query(
    `insert into publicaciones_foro (titulo, contenido, autor_id)
     values ('Artículo previo QA', 'Contenido previo ficticio.', '00000000-0000-4000-8000-0000000000aa') returning *`)).rows[0];
  // Permisos por defecto de Supabase para anon/authenticated: la 023 debe quitarlos.
  // Solo si existen (PostgreSQL de Supabase o local con esos roles); sin ellos la prueba de permisos no aplica.
  await sql.query(`do $$ begin
                     if exists (select 1 from pg_roles where rolname = 'anon') then
                       grant all on all tables in schema public to anon, authenticated;
                       alter default privileges in schema public grant all on tables to anon, authenticated;
                     end if;
                   end $$`);
  await base.migrar();
});
after(async () => { await base?.cerrar(); });

test('FE-183: la 023 deja los artículos existentes en borrador, fuera de la vista pública', opciones, async () => {
  const p = await leer(previo.id);
  assert.equal(p.estado, 'borrador');
  assert.deepEqual([p.titulo, p.contenido, p.autor_id, p.resumen], [previo.titulo, previo.contenido, previo.autor_id, null]);
  assert.deepEqual(p.creado_en, previo.creado_en);
  assert.equal(await publica(previo.id), undefined);
  assert.equal((await sql.query('select count(*)::int as n from v_investigaciones_publicas')).rows[0].n, 0);
  // Para publicarlo hace falta un resumen.
  await rechaza(cambiar(previo.id, { estado: 'publicado' }, PERFILES.admin), '23514');
  await cambiar(previo.id, { resumen: 'Resumen agregado QA.' }, PERFILES.admin);
  assert.equal((await cambiar(previo.id, { estado: 'publicado' }, PERFILES.admin)).estado, 'publicado');
  assert.equal((await publica(previo.id)).titulo, 'Artículo previo QA');
  assert.equal((await leer(previo.id)).autor_id, previo.autor_id);
});

test('FE-183: crear deja un borrador de quien lo crea; el cliente no fija autoría, estado ni fechas', opciones, async () => {
  const p = await crear({ autor_id: PERFILES.admin, publicado_en: '2026-01-01T00:00:00Z', publicado_por: PERFILES.admin,
    creado_en: '2020-01-01T00:00:00Z' });
  assert.equal(p.estado, 'borrador');
  assert.equal(p.autor_id, PERFILES.marketing);
  assert.equal(p.actualizado_por, PERFILES.marketing);
  assert.deepEqual([p.publicado_en, p.publicado_por], [null, null]);
  assert.ok(p.creado_en > new Date('2026-01-01'));
  assert.equal(await publica(p.id), undefined);
  await rechaza(crear({ estado: 'publicado' }), '23514');
  await rechaza(crear({ estado: 'retirado' }), '23514');
});

test('FE-183: campos inválidos se rechazan', opciones, async () => {
  const imagen = await archivo();
  for (const datos of [
    { titulo: '   ' }, { titulo: 'x'.repeat(151) }, { contenido: ' ' }, { contenido: 'x'.repeat(20001) },
    { resumen: 'x'.repeat(501) }, { autor_visible: '  ' }, { autor_visible: 'x'.repeat(151) },
    { imagen_id: imagen }, { imagen_id: imagen, imagen_texto_alternativo: ' ' },
    { imagen_texto_alternativo: 'Sin imagen' },
    { imagen_id: imagen, imagen_texto_alternativo: 'x'.repeat(301) },
    { estado: 'eliminado' },
  ]) {
    await rechaza(crear(datos), '23514');
  }
  await rechaza(crear({ titulo: null }), '23502');
  await rechaza(crear({ contenido: null }), '23502');
  await rechaza(crear({ imagen_id: randomUUID(), imagen_texto_alternativo: 'Alt' }), '23503');
  for (const datos of [
    { titulo: 'x'.repeat(150), resumen: 'x'.repeat(500), autor_visible: 'x'.repeat(150) },
    { resumen: null, autor_visible: null }, { contenido: 'x'.repeat(20000) },
    { imagen_id: imagen, imagen_texto_alternativo: 'Ilustración ficticia' },
  ]) {
    assert.equal((await crear(datos)).estado, 'borrador');
  }
  // El mismo archivo no sirve para dos artículos.
  await rechaza(crear({ imagen_id: imagen, imagen_texto_alternativo: 'Otra' }), '23505');
});

test('024: quitar o reemplazar la imagen, o borrar el artículo, elimina el archivo', opciones, async () => {
  const [a, b] = [await archivo(), await archivo()];
  const p = await crear({ imagen_id: a, imagen_texto_alternativo: 'Portada ficticia' });
  await cambiar(p.id, { imagen_texto_alternativo: 'Otro texto' });
  assert.equal(await existeArchivo(a), true);
  await cambiar(p.id, { imagen_id: b });
  assert.equal(await existeArchivo(a), false);
  await cambiar(p.id, { imagen_id: null, imagen_texto_alternativo: null });
  assert.equal(await existeArchivo(b), false);

  const c = await archivo();
  const q = await crear({ imagen_id: c, imagen_texto_alternativo: 'Portada ficticia' });
  await borrar(q.id);
  assert.equal(await existeArchivo(c), false);
});

test('FE-183: publicar incompleto falla y conserva el borrador', opciones, async () => {
  const p = await crear({ resumen: null });
  await rechaza(cambiar(p.id, { estado: 'publicado' }), '23514');
  await rechaza(cambiar(p.id, { estado: 'publicado', resumen: '   ' }), '23514');
  const guardado = await leer(p.id);
  assert.deepEqual([guardado.estado, guardado.titulo, guardado.contenido], ['borrador', ARTICULO.titulo, ARTICULO.contenido]);
});

test('FE-183: publicar, editar publicado, retirar y volver a borrador', opciones, async () => {
  const imagen = await archivo();
  const p = await crear({ imagen_id: imagen, imagen_texto_alternativo: 'Portada ficticia' });
  const publicada = await cambiar(p.id, { estado: 'publicado' });
  assert.ok(publicada.publicado_en);
  assert.equal(publicada.publicado_por, PERFILES.marketing);
  assert.deepEqual(await publica(p.id), {
    id: p.id, titulo: ARTICULO.titulo, resumen: ARTICULO.resumen, contenido: ARTICULO.contenido, autor: 'Equipo QA',
    fecha_publicacion: (await publica(p.id)).fecha_publicacion, publicado_en: publicada.publicado_en,
    imagen_id: imagen, imagen_texto_alternativo: 'Portada ficticia', imagen_ancho: 800, imagen_alto: 400,
  });
  const { rows: [f] } = await sql.query(
    `select to_char(fecha_publicacion, 'YYYY-MM-DD') as fecha from v_investigaciones_publicas where id = $1`, [p.id]);
  assert.equal(f.fecha, fechaLaPaz(publicada.publicado_en));

  // Editar lo publicado conserva autoría y fecha de publicación; el cliente no puede falsificarlas.
  const editada = await cambiar(p.id, { titulo: 'Investigación ficticia QA (editada)', autor_visible: null,
    publicado_en: '2020-01-01T00:00:00Z', publicado_por: PERFILES.t1, autor_id: PERFILES.t1 }, PERFILES.admin);
  assert.equal(editada.estado, 'publicado');
  assert.deepEqual([editada.publicado_en, editada.publicado_por, editada.autor_id],
    [publicada.publicado_en, PERFILES.marketing, PERFILES.marketing]);
  assert.equal(editada.actualizado_por, PERFILES.admin);
  const vista = await publica(p.id);
  assert.deepEqual([vista.titulo, vista.autor], ['Investigación ficticia QA (editada)', null]);

  const retirada = await cambiar(p.id, { estado: 'retirado' }, PERFILES.admin);
  assert.deepEqual([Boolean(retirada.retirado_en), retirada.retirado_por], [true, PERFILES.admin]);
  assert.equal(await publica(p.id), undefined);

  await cambiar(p.id, { estado: 'borrador', resumen: 'Resumen corregido QA.' });
  assert.equal(await publica(p.id), undefined);
  const republicada = await cambiar(p.id, { estado: 'publicado' });
  assert.ok(republicada.publicado_en > publicada.publicado_en);
  assert.equal((await publica(p.id)).resumen, 'Resumen corregido QA.');
});

test('FE-183: transiciones no previstas se rechazan', opciones, async () => {
  const borrador = await crear();
  await rechaza(cambiar(borrador.id, { estado: 'retirado' }), '23514');
  const publicada = await crear();
  await cambiar(publicada.id, { estado: 'publicado' });
  await rechaza(cambiar(publicada.id, { estado: 'borrador' }), '23514');
  await cambiar(publicada.id, { estado: 'retirado' });
  await rechaza(cambiar(publicada.id, { estado: 'publicado' }), '23514');
  assert.equal((await leer(borrador.id)).estado, 'borrador');
  assert.equal((await leer(publicada.id)).estado, 'retirado');
});

test('FE-183: solo administración o marketing activos escriben', opciones, async () => {
  const p = await crear();
  const antes = (await sql.query('select count(*)::int as n from publicaciones_foro')).rows[0].n;
  await sql.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000bb')`);
  await sql.query(`insert into perfiles (id, nombre_completo, rol, activo) values ('00000000-0000-4000-8000-0000000000bb', 'Marketing inactivo QA', 'marketing', false)`);
  for (const usuario of [PERFILES.t1, PERFILES.t2, randomUUID(), '00000000-0000-4000-8000-0000000000bb']) {
    await rechaza(crear({}, usuario), '42501');
    await rechaza(cambiar(p.id, { estado: 'publicado' }, usuario), '42501');
    await rechaza(borrar(p.id, usuario), '42501');
  }
  await rechaza(sql.query(`insert into publicaciones_foro (titulo, contenido, autor_id) values ('x', 'y', $1)`, [PERFILES.admin]), '42501');
  assert.equal((await sql.query('select count(*)::int as n from publicaciones_foro')).rows[0].n, antes);
  assert.equal((await leer(p.id)).estado, 'borrador');
  assert.equal((await crear({}, PERFILES.admin)).autor_id, PERFILES.admin);
});

test('FE-183: solo se elimina lo que nunca se publicó', opciones, async () => {
  const borrador = await crear();
  await borrar(borrador.id, PERFILES.marketing);
  assert.equal(await leer(borrador.id), undefined);
  const publicada = await crear();
  await cambiar(publicada.id, { estado: 'publicado' });
  await rechaza(borrar(publicada.id), '23514');
  await cambiar(publicada.id, { estado: 'retirado' });
  await rechaza(borrar(publicada.id), '23514');
  await cambiar(publicada.id, { estado: 'borrador' });
  await rechaza(borrar(publicada.id), '23514');
  assert.ok(await leer(publicada.id));
});

test('FE-183: la vista pública solo expone lo publicado y campos permitidos', opciones, async () => {
  const { rows: columnas } = await sql.query(
    `select column_name from information_schema.columns where table_name = 'v_investigaciones_publicas' order by ordinal_position`);
  assert.deepEqual(columnas.map((c) => c.column_name), [
    'id', 'titulo', 'resumen', 'contenido', 'autor', 'fecha_publicacion', 'publicado_en',
    'imagen_id', 'imagen_texto_alternativo', 'imagen_ancho', 'imagen_alto',
  ]);
  const { rows: [r] } = await sql.query(
    `select (select count(*)::int from v_investigaciones_publicas) as vista,
            (select count(*)::int from publicaciones_foro where estado = 'publicado') as publicadas,
            (select count(*)::int from publicaciones_foro where estado <> 'publicado') as privadas`);
  assert.equal(r.vista, r.publicadas);
  assert.ok(r.privadas > 0);
});

test('FE-183: sin comentarios expuestos; separado de lo clínico; RLS activo', opciones, async () => {
  const { rows } = await sql.query(
    `select distinct ccu.table_name as destino
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu using (constraint_schema, constraint_name)
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_name = 'publicaciones_foro' order by 1`);
  assert.deepEqual(rows.map((f) => f.destino), ['imagenes_publicas', 'perfiles']);
  const { rows: rls } = await sql.query(
    `select relname, relrowsecurity from pg_class where relname in ('publicaciones_foro', 'comentarios_foro') order by relname`);
  assert.deepEqual(rls.map((f) => f.relrowsecurity), [true, true]);
  const { rows: vistas } = await sql.query(
    `select viewname from pg_views where schemaname = 'public' and definition ilike '%comentarios_foro%'`);
  assert.deepEqual(vistas, []);
  const { rows: roles } = await sql.query(
    `select r.rolname,
            has_table_privilege(r.rolname, 'public.publicaciones_foro', 'select') as foro,
            has_table_privilege(r.rolname, 'public.comentarios_foro', 'insert') as comentar,
            has_table_privilege(r.rolname, 'public.v_investigaciones_publicas', 'select') as vista
       from pg_roles r where r.rolname in ('anon', 'authenticated') order by 1`);
  for (const f of roles) assert.deepEqual([f.foro, f.comentar, f.vista], [false, false, false], f.rolname);
});

test('FE-183: los cambios quedan en auditoría con su autor', opciones, async () => {
  const p = await crear();
  await cambiar(p.id, { estado: 'publicado' }, PERFILES.admin);
  const { rows } = await sql.query(
    `select accion, usuario_id, datos_anteriores ->> 'estado' as antes, datos_nuevos ->> 'estado' as despues
       from auditoria where tabla = 'publicaciones_foro' and registro_id = $1 order by id`, [p.id]);
  assert.deepEqual(rows, [
    { accion: 'INSERT', usuario_id: PERFILES.marketing, antes: null, despues: 'borrador' },
    { accion: 'UPDATE', usuario_id: PERFILES.admin, antes: 'borrador', despues: 'publicado' },
  ]);
});

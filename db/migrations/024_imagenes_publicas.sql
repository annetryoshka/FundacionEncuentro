-- Imágenes del portal público: portada de publicaciones de difusión (014) y de artículos de investigación (023).
-- El archivo se guarda en la base, como los genogramas (012): entra en el respaldo pg_dump y no depende de
-- un bucket de Storage. Reemplaza las rutas al bucket `difusion-publica`, que nunca existió.
-- El backend recibe la foto, la reduce, la convierte a WebP y le quita los metadatos (EXIF, GPS) antes de guardarla.
-- Una imagen por publicación o artículo. Al quitarla o reemplazarla, el archivo se borra.
-- Separado de lo clínico: ninguna tabla clínica referencia estas imágenes.
begin;

create table public.imagenes_publicas (
  id           uuid primary key default gen_random_uuid(),
  tipo_mime    text not null check (tipo_mime in ('image/webp', 'image/jpeg', 'image/png')),
  tamano_bytes int  not null check (tamano_bytes between 1 and 3145728),
  ancho        int  not null check (ancho between 1 and 4000),
  alto         int  not null check (alto between 1 and 4000),
  contenido    bytea not null,
  sha256       bytea generated always as (sha256(contenido)) stored,
  subido_por   uuid references public.perfiles (id)
               default nullif(current_setting('app.usuario_id', true), '')::uuid,
  creado_en    timestamptz not null default now(),

  constraint ck_imagen_publica_tamano check (tamano_bytes = octet_length(contenido))
);

comment on table public.imagenes_publicas is
  'Imágenes del portal (difusión e investigaciones), ya procesadas por el backend. Se leen solo si lo que las usa está publicado.';

-- Una imagen no cambia: para cambiarla se sube otra.
create or replace function public.imagen_publica_inmutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Una imagen guardada no se modifica: se reemplaza' using errcode = '23514';
end;
$$;

create trigger trg_imagen_publica_inmutable
  before update on public.imagenes_publicas
  for each row execute function public.imagen_publica_inmutable();

-- Sin trigger de auditoría en imagenes_publicas: copiaría el archivo entero en auditoria.
-- Quién puso o quitó la imagen queda auditado en recursos_difusion y publicaciones_foro.

-- Las vistas públicas dependen de las columnas que se cambian: se recrean al final.
drop view public.v_publicaciones_publicas;
drop view public.v_investigaciones_publicas;

-- Difusión: las filas existentes apuntaban a archivos que nunca se subieron.
delete from public.recursos_difusion;
drop index if exists public.uq_recursos_difusion_principal;
alter table public.recursos_difusion
  drop constraint uq_recursos_difusion_ruta,
  drop constraint ck_recursos_difusion_ruta,
  drop column almacenamiento,
  drop column ruta,
  drop column tipo_mime,
  drop column tamano_bytes,
  drop column ancho,
  drop column alto,
  drop column sha256,
  drop column principal,
  add column imagen_id uuid not null references public.imagenes_publicas (id) on delete restrict,
  add constraint uq_recursos_difusion_publicacion unique (publicacion_id),
  add constraint uq_recursos_difusion_imagen unique (imagen_id);

comment on table public.recursos_difusion is
  'Imagen de portada de una publicación (una por publicación) con su texto alternativo. El archivo está en imagenes_publicas.';

-- Investigaciones: se quitan las columnas de ruta. imagen_texto_alternativo se vuelve a crear vacía
-- (sin UPDATE, que exigiría app.usuario_id): ninguna ruta guardada apuntaba a un archivo real.
alter table public.publicaciones_foro
  drop constraint ck_investigacion_imagen,
  drop column imagen_ruta,
  drop column imagen_texto_alternativo,
  drop column imagen_ancho,
  drop column imagen_alto,
  add column imagen_id uuid references public.imagenes_publicas (id) on delete restrict,
  add column imagen_texto_alternativo text,
  add constraint uq_investigacion_imagen unique (imagen_id),
  add constraint ck_investigacion_imagen check (
    (imagen_id is null and imagen_texto_alternativo is null)
    or (imagen_id is not null
        and btrim(coalesce(imagen_texto_alternativo, '')) <> ''
        and char_length(imagen_texto_alternativo) <= 300));

-- Una imagen que nada usa se borra: al quitarla, al reemplazarla o al borrar lo que la usaba.
create or replace function public.borrar_imagen_publica_sin_uso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.imagen_id is null or (tg_op = 'UPDATE' and new.imagen_id is not distinct from old.imagen_id) then
    return null;
  end if;
  delete from imagenes_publicas i
   where i.id = old.imagen_id
     and not exists (select 1 from recursos_difusion r where r.imagen_id = i.id)
     and not exists (select 1 from publicaciones_foro f where f.imagen_id = i.id);
  return null;
end;
$$;

create trigger trg_recursos_difusion_imagen_sin_uso
  after update of imagen_id or delete on public.recursos_difusion
  for each row execute function public.borrar_imagen_publica_sin_uso();
create trigger trg_investigacion_imagen_sin_uso
  after update of imagen_id or delete on public.publicaciones_foro
  for each row execute function public.borrar_imagen_publica_sin_uso();

-- Mismas columnas públicas que antes, con imagen_id en lugar de la ruta.
create view public.v_publicaciones_publicas
with (security_invoker = true) as
select p.id, p.tipo, p.titulo, p.resumen, p.contenido,
       p.fecha_inicio, p.fecha_fin, p.modalidad, p.lugar, p.contacto_url, p.publicado_en,
       r.imagen_id, r.texto_alternativo as imagen_texto_alternativo,
       i.ancho as imagen_ancho, i.alto as imagen_alto
  from public.publicaciones_difusion p
  left join public.recursos_difusion r on r.publicacion_id = p.id
  left join public.imagenes_publicas i on i.id = r.imagen_id
 where p.estado = 'publicado';

create view public.v_investigaciones_publicas
with (security_invoker = true) as
select f.id, f.titulo, f.resumen, f.contenido,
       f.autor_visible as autor,
       (f.publicado_en at time zone 'America/La_Paz')::date as fecha_publicacion,
       f.publicado_en,
       f.imagen_id, f.imagen_texto_alternativo,
       i.ancho as imagen_ancho, i.alto as imagen_alto
  from public.publicaciones_foro f
  left join public.imagenes_publicas i on i.id = f.imagen_id
 where f.estado = 'publicado';

alter table public.imagenes_publicas enable row level security;

-- Solo el backend accede: nada directo desde la API de Supabase.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.imagenes_publicas, public.v_publicaciones_publicas, public.v_investigaciones_publicas
      from anon, authenticated;
  end if;
end $$;

commit;

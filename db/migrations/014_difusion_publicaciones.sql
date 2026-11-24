-- FE-142: publicaciones del portal (campañas, actividades y cursos) y sus imágenes (contrato de FE-140).
-- Separado de lo clínico: ninguna tabla referencia casos, pacientes ni archivos clínicos.
-- Estados: borrador → publicado → retirado → borrador. Lo público sale solo de v_publicaciones_publicas.
begin;

create table public.publicaciones_difusion (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('campana', 'actividad', 'curso')),
  titulo         text not null,
  resumen        text,
  contenido      text,
  fecha_inicio   date,
  fecha_fin      date,
  modalidad      text check (modalidad in ('presencial', 'virtual', 'mixta')),
  lugar          text,
  contacto_url   text,
  estado         text not null default 'borrador'
                 check (estado in ('borrador', 'publicado', 'retirado')),
  publicado_en   timestamptz,
  publicado_por  uuid references public.perfiles (id),
  retirado_en    timestamptz,
  retirado_por   uuid references public.perfiles (id),
  creado_por     uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id),
  actualizado_en timestamptz not null default now(),

  constraint ck_difusion_titulo check (btrim(titulo) <> '' and char_length(titulo) <= 150),
  constraint ck_difusion_resumen check (resumen is null or char_length(resumen) <= 500),
  constraint ck_difusion_contenido check (contenido is null or char_length(contenido) <= 10000),
  constraint ck_difusion_lugar check (lugar is null or (btrim(lugar) <> '' and char_length(lugar) <= 200)),
  constraint ck_difusion_contacto check (
    contacto_url is null or (contacto_url ~* '^https?://[^\s/]+[^\s]*$' and char_length(contacto_url) <= 500)),
  constraint ck_difusion_fechas check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio),
  -- Mínimo para publicar; los mínimos por tipo los valida la API (FE-143) hasta que FE-141 los ratifique.
  constraint ck_difusion_publicada check (
    estado <> 'publicado' or (publicado_en is not null and btrim(coalesce(resumen, '')) <> ''))
);

comment on table public.publicaciones_difusion is
  'FE-142: publicaciones del portal. Solo marketing/administración las editan; el público ve v_publicaciones_publicas.';
comment on column public.publicaciones_difusion.publicado_en is
  'Fecha de la última publicación (no es la fecha de la actividad).';

create index idx_difusion_estado_tipo on public.publicaciones_difusion (estado, tipo, publicado_en desc);

-- Transiciones de FE-140 y datos de publicación puestos por la base, no por el cliente.
create or replace function public.controlar_estado_difusion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' then
      raise exception 'Una publicación nueva empieza en borrador' using errcode = 'check_violation';
    end if;
    new.creado_por := coalesce(v_usuario, new.creado_por);
    new.publicado_en := null; new.publicado_por := null;
    new.retirado_en := null;  new.retirado_por := null;
    return new;
  end if;

  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.publicado_en := old.publicado_en; new.publicado_por := old.publicado_por;
  new.retirado_en := old.retirado_en;   new.retirado_por := old.retirado_por;

  if new.estado is distinct from old.estado then
    if (old.estado, new.estado) not in (('borrador', 'publicado'), ('publicado', 'retirado'), ('retirado', 'borrador')) then
      raise exception 'No se puede pasar de % a %', old.estado, new.estado using errcode = 'check_violation';
    end if;
    if new.estado = 'publicado' then
      new.publicado_en := now(); new.publicado_por := v_usuario;
    elsif new.estado = 'retirado' then
      new.retirado_en := now(); new.retirado_por := v_usuario;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_difusion_estado
  before insert or update on public.publicaciones_difusion
  for each row execute function public.controlar_estado_difusion();
create trigger trg_difusion_upd
  before update on public.publicaciones_difusion
  for each row execute function public.set_actualizado_en();
create trigger trg_difusion_actualizado_por
  before insert or update on public.publicaciones_difusion
  for each row execute function public.registrar_actualizado_por();
create trigger trg_aud_difusion
  after insert or update or delete on public.publicaciones_difusion
  for each row execute function public.auditar_cambio();

-- Imágenes: aquí solo los metadatos; el archivo va en el bucket público de difusión,
-- nunca en el almacenamiento clínico (genogramas, documentos).
create table public.recursos_difusion (
  id                uuid primary key default gen_random_uuid(),
  publicacion_id    uuid not null references public.publicaciones_difusion (id) on delete cascade,
  almacenamiento    text not null default 'difusion-publica' check (almacenamiento = 'difusion-publica'),
  ruta              text not null,
  tipo_mime         text not null check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp')),
  tamano_bytes      int  not null check (tamano_bytes between 1 and 5242880),
  ancho             int  check (ancho > 0),
  alto              int  check (alto > 0),
  sha256            text check (sha256 ~ '^[0-9a-f]{64}$'),
  texto_alternativo text not null,
  principal         boolean not null default false,
  creado_por        uuid references public.perfiles (id),
  creado_en         timestamptz not null default now(),

  constraint uq_recursos_difusion_ruta unique (almacenamiento, ruta),
  constraint ck_recursos_difusion_ruta check (
    ruta ~ '^[A-Za-z0-9_-][A-Za-z0-9/_.-]*$' and ruta !~ '\.\.' and char_length(ruta) <= 300),
  constraint ck_recursos_difusion_alt check (btrim(texto_alternativo) <> '' and char_length(texto_alternativo) <= 300)
);

-- Una sola imagen principal por publicación.
create unique index uq_recursos_difusion_principal
  on public.recursos_difusion (publicacion_id) where principal;

create trigger trg_aud_recursos_difusion
  after insert or update or delete on public.recursos_difusion
  for each row execute function public.auditar_cambio();

-- Única fuente de la consulta pública: solo lo publicado y solo campos permitidos
-- (sin estado, autoría ni borradores). La API pública (FE-143) lee de aquí.
create view public.v_publicaciones_publicas
with (security_invoker = true) as
select p.id, p.tipo, p.titulo, p.resumen, p.contenido,
       p.fecha_inicio, p.fecha_fin, p.modalidad, p.lugar, p.contacto_url, p.publicado_en,
       r.ruta as imagen_ruta, r.texto_alternativo as imagen_texto_alternativo,
       r.ancho as imagen_ancho, r.alto as imagen_alto
  from public.publicaciones_difusion p
  left join public.recursos_difusion r on r.publicacion_id = p.id and r.principal
 where p.estado = 'publicado';

alter table public.publicaciones_difusion enable row level security;
alter table public.recursos_difusion enable row level security;

-- Solo el backend accede: nada directo desde la API de Supabase.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.publicaciones_difusion, public.recursos_difusion, public.v_publicaciones_publicas
      from anon, authenticated;
  end if;
end $$;

commit;

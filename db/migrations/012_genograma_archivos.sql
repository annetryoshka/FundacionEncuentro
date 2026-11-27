-- FE-130: archivo privado del genograma (PDF, PNG o JPEG) con sus versiones.
--   genograma_archivos  una fila por archivo subido; el contenido no se modifica.
--   genogramas          referencia al archivo vigente del caso (una por caso).
-- Flujo: se guarda el archivo (sin activar) y luego, en una transacción, se activa
-- y se cambia la referencia. Si la activación falla, el vigente anterior no cambia.
-- Las versiones anteriores se conservan; los archivos nunca activados son descartables.
begin;

create table public.genograma_archivos (
  clave        text primary key,
  caso_id      uuid not null references public.casos (id) on delete restrict,
  tipo         text not null
    check (tipo in ('application/pdf', 'image/png', 'image/jpeg')),
  tamanio      int not null check (tamanio between 1 and 10485760),
  contenido    bytea not null,
  sha256       bytea generated always as (sha256(contenido)) stored,
  nombre       text,
  subido_por   uuid references public.perfiles (id),
  activado_en  timestamptz,
  creado_en    timestamptz not null default now(),

  -- La clave es <caso_id>/<uuid>: un archivo no puede figurar en otro caso.
  constraint ck_genograma_archivo_clave check (
    clave ~ ('^' || caso_id::text || '/[0-9a-f-]{36}$')
  ),
  constraint ck_genograma_archivo_tamanio check (tamanio = octet_length(contenido)),
  constraint ck_genograma_archivo_nombre check (
    nombre is null or char_length(btrim(nombre)) between 1 and 255
  ),
  -- Sin activar: sin nombre ni autor. Activado: los tres datos.
  constraint ck_genograma_archivo_activacion check (
    (activado_en is null and nombre is null and subido_por is null)
    or (activado_en is not null and nombre is not null and subido_por is not null)
  ),
  constraint uq_genograma_archivo_caso unique (clave, caso_id)
);

create index idx_genograma_archivos_caso on public.genograma_archivos (caso_id, activado_en);

-- El contenido y su identidad no cambian; un archivo se activa una sola vez.
create or replace function public.genograma_archivo_inmutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.clave is distinct from old.clave
     or new.caso_id is distinct from old.caso_id
     or new.tipo is distinct from old.tipo
     or new.tamanio is distinct from old.tamanio
     or new.contenido is distinct from old.contenido then
    raise exception 'El archivo del genograma no se puede modificar'
      using errcode = '23514';
  end if;
  if old.activado_en is not null then
    raise exception 'El archivo del genograma ya fue activado'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_genograma_archivo_inmutable
  before update on public.genograma_archivos
  for each row execute function public.genograma_archivo_inmutable();

-- Sin trigger de auditoría aquí: copiaría el archivo entero en auditoria.
-- El cambio de vigente queda auditado en genogramas.
alter table public.genograma_archivos enable row level security;

alter table public.genogramas
  add column archivo_clave text,
  add constraint fk_genograma_archivo_vigente
    foreign key (archivo_clave, caso_id)
    references public.genograma_archivos (clave, caso_id) on delete restrict;

create trigger trg_aud_genogramas
  after insert or update or delete on public.genogramas
  for each row execute function public.auditar_cambio();

-- Solo el backend accede. Los roles anon/authenticated existen en Supabase; en otro PostgreSQL no hay nada que revocar.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.genograma_archivos from anon, authenticated;
  end if;
end $$;

commit;

-- FE-125: composición familiar por caso (contrato FE-123) y fuente clínica vigente.
-- No modifica datos existentes: casos, fichas_diagnostico y genogramas quedan igual.
-- Ningún caso recibe familia automáticamente: sin fila en fichas_familiares = sin registrar.
begin;

-- Cabecera: una por caso. Distingue "sin registrar" (no hay fila) de "registrada sin integrantes"
-- y lleva la versión para que la API rechace ediciones concurrentes.
create table public.fichas_familiares (
  id                  uuid primary key default gen_random_uuid(),
  caso_id             uuid not null unique references public.casos (id) on delete restrict,
  version             int  not null default 1 check (version > 0),
  version_transaccion xid8 not null default pg_current_xact_id(),
  creado_por          uuid references public.perfiles (id),
  creado_en           timestamptz not null default now(),
  actualizado_por     uuid references public.perfiles (id),
  actualizado_en      timestamptz not null default now()
);

comment on table public.fichas_familiares is
  'FE-125: composición familiar del caso. Sin fila = sin registrar; fila sin familiares = registrada sin integrantes.';
comment on column public.fichas_familiares.version is
  'Sube una vez por transacción que cambia familiares del caso. La API la compara antes de guardar.';
comment on column public.fichas_familiares.version_transaccion is
  'Interno: transacción que subió la versión por última vez.';

-- Integrantes. El parentesco es respecto del paciente del caso. NULL = dato desconocido.
create table public.familiares (
  id                    uuid primary key default gen_random_uuid(),
  caso_id               uuid not null references public.fichas_familiares (caso_id) on delete restrict,
  parentesco            text not null,
  parentesco_detalle    text,
  nombre_completo       text,
  fecha_nacimiento      date,
  edad_referida         smallint,
  fecha_referencia      date,
  ocupacion             text,
  lugar_trabajo_estudio text,
  convive_con_paciente  boolean,
  observaciones         text,
  -- Orden en que se registraron; creado_en se repite dentro de una misma transacción.
  orden_registro        bigint generated always as identity,
  creado_por            uuid references public.perfiles (id),
  creado_en             timestamptz not null default now(),
  actualizado_por       uuid references public.perfiles (id),
  actualizado_en        timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint ck_familiares_parentesco check (parentesco in (
    'madre', 'padre', 'hermano', 'hermana', 'hijo', 'hija',
    'abuelo_materno', 'abuela_materna', 'abuelo_paterno', 'abuela_paterna',
    'tio', 'tia', 'pareja', 'tutor', 'tutora', 'otro')),
  -- "otro" exige describir el parentesco; los demás no lo admiten.
  constraint ck_familiares_parentesco_detalle check (case
    when parentesco = 'otro'
      then btrim(coalesce(parentesco_detalle, '')) <> '' and char_length(parentesco_detalle) <= 100
    else parentesco_detalle is null end),
  constraint ck_familiares_nombre check (
    nombre_completo is null or (btrim(nombre_completo) <> '' and char_length(nombre_completo) <= 150)),
  constraint ck_familiares_ocupacion check (
    ocupacion is null or (btrim(ocupacion) <> '' and char_length(ocupacion) <= 200)),
  constraint ck_familiares_lugar check (
    lugar_trabajo_estudio is null or (btrim(lugar_trabajo_estudio) <> '' and char_length(lugar_trabajo_estudio) <= 150)),
  constraint ck_familiares_observaciones check (
    observaciones is null or (btrim(observaciones) <> '' and char_length(observaciones) <= 2000)),
  -- Edad: fecha de nacimiento, o edad referida con la fecha en que se informó. No ambas.
  constraint ck_familiares_edad_referida check (edad_referida between 0 and 130),
  constraint ck_familiares_fecha_referencia check ((edad_referida is null) = (fecha_referencia is null)),
  constraint ck_familiares_nacimiento_o_edad check (fecha_nacimiento is null or edad_referida is null),
  constraint ck_familiares_fechas_minimas check (
    coalesce(fecha_nacimiento, '1900-01-01') >= '1900-01-01'
    and coalesce(fecha_referencia, '1900-01-01') >= '1900-01-01')
);

comment on table public.familiares is
  'FE-125: integrantes de la familia del caso. No enlaza con pacientes. Se elimina con deleted_at.';
comment on column public.familiares.parentesco is 'Relación respecto del paciente del caso.';
comment on column public.familiares.edad_referida is
  'Edad informada en fecha_referencia. No se actualiza sola: la edad actual se calcula solo desde fecha_nacimiento.';
comment on column public.familiares.convive_con_paciente is 'true, false o NULL = desconocido.';

create index idx_familiares_caso on public.familiares (caso_id, orden_registro) where deleted_at is null;

-- Edad cumplida en una fecha. NULL si no hay nacimiento o la fecha es anterior.
create or replace function public.edad_en(nacimiento date, al date)
returns int
language sql
immutable
set search_path = public
as $$
  select case when nacimiento is not null and al >= nacimiento
              then extract(year from age(al, nacimiento))::int end;
$$;

-- Autoría desde app.usuario_id (como en sesiones).
create or replace function public.registrar_creado_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.creado_por := coalesce(nullif(current_setting('app.usuario_id', true), '')::uuid, new.creado_por);
  return new;
end;
$$;

-- Un familiar no cambia de caso, uno eliminado no se edita y las fechas no son futuras (hora de Bolivia).
create or replace function public.validar_familiar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.caso_id <> old.caso_id then
      raise exception 'Un familiar no se puede mover a otro caso' using errcode = 'check_violation';
    end if;
    if old.deleted_at is not null then
      raise exception 'Un familiar eliminado no se puede modificar' using errcode = 'check_violation';
    end if;
  end if;
  if new.fecha_nacimiento > hoy or new.fecha_referencia > hoy then
    raise exception 'Las fechas del familiar no pueden ser futuras' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.proteger_ficha_familiar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.caso_id <> old.caso_id then
    raise exception 'La composición familiar no se puede mover a otro caso' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Sube la versión de la cabecera una sola vez por transacción, aunque cambien varios familiares.
-- Crear cabecera e integrantes en la misma transacción deja la versión en 1.
create or replace function public.versionar_ficha_familiar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update fichas_familiares
     set version = version + 1,
         version_transaccion = pg_current_xact_id()
   where caso_id = coalesce(new.caso_id, old.caso_id)
     and version_transaccion <> pg_current_xact_id();
  return null;
end;
$$;

create trigger trg_ffam_autor before insert on public.fichas_familiares
  for each row execute function public.registrar_creado_por();
create trigger trg_ffam_actualizado_por before insert or update on public.fichas_familiares
  for each row execute function public.registrar_actualizado_por();
create trigger trg_ffam_upd before update on public.fichas_familiares
  for each row execute function public.set_actualizado_en();
create trigger trg_ffam_caso_fijo before update of caso_id on public.fichas_familiares
  for each row execute function public.proteger_ficha_familiar();
create trigger trg_aud_ffam after insert or update or delete on public.fichas_familiares
  for each row execute function public.auditar_cambio();

create trigger trg_familiares_autor before insert on public.familiares
  for each row execute function public.registrar_creado_por();
create trigger trg_familiares_actualizado_por before insert or update on public.familiares
  for each row execute function public.registrar_actualizado_por();
create trigger trg_familiares_upd before update on public.familiares
  for each row execute function public.set_actualizado_en();
create trigger trg_familiares_validar before insert or update on public.familiares
  for each row execute function public.validar_familiar();
create trigger trg_familiares_version after insert or update or delete on public.familiares
  for each row execute function public.versionar_ficha_familiar();
create trigger trg_aud_familiares after insert or update or delete on public.familiares
  for each row execute function public.auditar_cambio();

alter table public.fichas_familiares enable row level security;
alter table public.familiares enable row level security;

-- Fuente clínica vigente (FE-123 §3), solo lectura. Si el caso tiene ficha de diagnóstico, manda la ficha;
-- si no, los datos clínicos del alta como antecedente. Un NULL de la ficha no se completa con el alta.
-- Ambos orígenes se exponen: no se copia ni se borra nada.
create view public.v_fuente_clinica_vigente
with (security_invoker = true) as
select c.id as caso_id,
       case when f.id is not null then 'ficha'
            when coalesce(c.diagnostico_ingreso, c.hipotesis_relacional, c.comentarios_clinicos) is not null then 'alta'
            else 'sin_datos' end as origen,
       case when f.id is not null then f.contenido ->> 'diagnosticoIngreso' else c.diagnostico_ingreso end
         as diagnostico_ingreso,
       case when f.id is not null then f.contenido ->> 'hipotesisRelacional' else c.hipotesis_relacional end
         as hipotesis_relacional,
       case when f.id is not null then f.contenido ->> 'comentariosClinicos' else c.comentarios_clinicos end
         as comentarios_clinicos,
       f.id              as ficha_id,
       f.fecha           as ficha_fecha,
       f.actualizado_por as ficha_actualizada_por,
       f.actualizado_en  as ficha_actualizada_en,
       c.diagnostico_ingreso  as alta_diagnostico_ingreso,
       c.hipotesis_relacional as alta_hipotesis_relacional,
       c.comentarios_clinicos as alta_comentarios_clinicos
  from public.casos c
  join public.pacientes p on p.id = c.paciente_id
  left join public.fichas_diagnostico f on f.caso_id = c.id
 where c.deleted_at is null
   and p.deleted_at is null;

comment on view public.v_fuente_clinica_vigente is
  'FE-125: diagnóstico vigente por caso (origen ficha, alta o sin_datos) con los valores del alta conservados.';

commit;

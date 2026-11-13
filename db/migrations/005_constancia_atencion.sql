begin;

create table public.constancias_atencion (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null unique
    references public.casos(id) on delete restrict,

  procedencia text,
  origen_judicial boolean not null,

  estado text not null
    check (estado in ('pendiente', 'registrado', 'no_aplica')),

  fecha_consentimiento date,
  referencia_evidencia text,
  explicacion text,

  creado_por uuid not null references public.perfiles(id),
  creado_en timestamptz not null default now(),
  actualizado_por uuid not null references public.perfiles(id),
  actualizado_en timestamptz not null default now(),

  constraint ck_constancia_procedencia check (
    procedencia is null
    or char_length(btrim(procedencia)) between 1 and 500
  ),

  constraint ck_constancia_evidencia check (
    referencia_evidencia is null
    or char_length(btrim(referencia_evidencia)) between 1 and 1000
  ),

  constraint ck_constancia_explicacion check (
    explicacion is null
    or char_length(btrim(explicacion)) between 1 and 1000
  ),

  constraint ck_constancia_estado_campos check (
    (
      estado = 'pendiente'
      and fecha_consentimiento is null
      and referencia_evidencia is null
      and explicacion is null
    )
    or (
      estado = 'registrado'
      and fecha_consentimiento is not null
      and referencia_evidencia is not null
      and explicacion is null
    )
    or (
      estado = 'no_aplica'
      and explicacion is not null
      and fecha_consentimiento is null
      and referencia_evidencia is null
    )
  )
);

create trigger trg_constancia_upd
  before update on public.constancias_atencion
  for each row execute function public.set_actualizado_en();

create trigger trg_aud_constancia
  after insert or update or delete on public.constancias_atencion
  for each row execute function public.auditar_cambio();

alter table public.constancias_atencion enable row level security;

commit;
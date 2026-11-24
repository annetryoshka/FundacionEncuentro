-- FE-135: ciudad de residencia actual del paciente (catálogo de FE-134).
-- NULL = sin registrar: los pacientes existentes quedan así, no se adivina su domicilio.
-- La residencia es del paciente y la comparten todas sus carpetas; cambiarla no toca
-- número, origen, fecha de ingreso ni asignación del caso.
begin;

alter table public.pacientes
  add column ciudad_residencia          text,
  add column otra_localidad             text,
  add column residencia_actualizada_en  timestamptz,
  add column residencia_actualizada_por uuid references public.perfiles (id),
  add constraint ck_pacientes_ciudad_residencia
    check (ciudad_residencia in ('la_paz', 'el_alto', 'otra')),
  -- "otra" exige el nombre de la localidad; las demás no lo admiten.
  add constraint ck_pacientes_otra_localidad
    check (case when ciudad_residencia = 'otra'
                then btrim(coalesce(otra_localidad, '')) <> '' and char_length(otra_localidad) <= 100
                else otra_localidad is null end);

comment on column public.pacientes.ciudad_residencia is
  'FE-135: la_paz, el_alto u otra. NULL = sin registrar. Residencia actual, no sede de atención.';
comment on column public.pacientes.otra_localidad is
  'FE-135: nombre de la localidad cuando ciudad_residencia = otra.';

create index idx_pacientes_ciudad_residencia on public.pacientes (ciudad_residencia);

-- Fecha y autor del último cambio de residencia (además de la auditoría general).
create or replace function public.registrar_cambio_residencia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.ciudad_residencia is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.ciudad_residencia is not distinct from old.ciudad_residencia
     and new.otra_localidad is not distinct from old.otra_localidad then
    return new;
  end if;
  new.residencia_actualizada_en := now();
  new.residencia_actualizada_por := nullif(current_setting('app.usuario_id', true), '')::uuid;
  return new;
end;
$$;

create trigger trg_pacientes_residencia
  before insert or update of ciudad_residencia, otra_localidad on public.pacientes
  for each row execute function public.registrar_cambio_residencia();

-- Desglose de indicadores_operativos (FE-94) por residencia actual del paciente.
-- Siempre 4 filas (la_paz, el_alto, otra, sin_registrar); su suma es igual a
-- indicadores_operativos(desde, hasta). Cada indicador se cuenta en su propia
-- subconsulta, así sesiones, tareas o pagos no multiplican casos.
create or replace function public.indicadores_por_residencia(desde date, hasta date)
returns table (
  residencia       text,
  casos_actuales   int,
  casos_iniciados  int,
  casos_en_proceso int,
  casos_concluidos int,
  sesiones         int,
  pagos_recibidos  numeric
)
language sql
stable
set search_path = public
as $$
  with ciudades (ciudad, orden) as (
    values ('la_paz', 1), ('el_alto', 2), ('otra', 3), ('sin_registrar', 4)
  ),
  casos_vigentes as (
    select c.id, c.estado, coalesce(p.ciudad_residencia, 'sin_registrar') as ciudad
      from casos c
      join pacientes p on p.id = c.paciente_id
     where c.deleted_at is null
       and p.deleted_at is null
  ),
  por_casos as (
    select ciudad,
           count(*) as total,
           count(*) filter (where estado = 'iniciado')   as iniciados,
           count(*) filter (where estado = 'en_proceso') as en_proceso,
           count(*) filter (where estado = 'concluido')  as concluidos
      from casos_vigentes
     group by ciudad
  ),
  por_sesiones as (
    select c.ciudad, count(*) as total
      from fichas_seguimiento s
      join casos_vigentes c on c.id = s.caso_id
     where s.fecha between desde and hasta
     group by c.ciudad
  ),
  por_pagos as (
    select c.ciudad, sum(g.monto) as total
      from pagos g
      join casos_vigentes c on c.id = g.caso_id
     where g.fecha between desde and hasta
       and g.moneda = 'BOB'
     group by c.ciudad
  )
  select r.ciudad,
         coalesce(pc.total, 0)::int,
         coalesce(pc.iniciados, 0)::int,
         coalesce(pc.en_proceso, 0)::int,
         coalesce(pc.concluidos, 0)::int,
         coalesce(ps.total, 0)::int,
         coalesce(pp.total, 0)
    from ciudades r
    left join por_casos pc on pc.ciudad = r.ciudad
    left join por_sesiones ps on ps.ciudad = r.ciudad
    left join por_pagos pp on pp.ciudad = r.ciudad
   order by r.orden;
$$;

-- Solo el backend la usa: se quita el acceso directo desde la API pública de Supabase.
revoke execute on function public.indicadores_por_residencia(date, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.indicadores_por_residencia(date, date) from anon, authenticated;
  end if;
end $$;

commit;

-- FE-94: indicadores del dashboard (FE-6) en una sola llamada:
--   select * from public.indicadores_operativos('2026-10-12', '2026-10-19');
-- Cada indicador se cuenta en su propia subconsulta, así las tareas o los pagos
-- no multiplican sesiones. Fechas inclusivas. Solo cuentan casos y pacientes no eliminados.
begin;

create or replace function public.indicadores_operativos(desde date, hasta date)
returns table (
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
  with casos_vigentes as (
    select c.id, c.estado
      from casos c
      join pacientes p on p.id = c.paciente_id
     where c.deleted_at is null
       and p.deleted_at is null
  )
  select
    (select count(*)::int from casos_vigentes),
    (select count(*)::int from casos_vigentes where estado = 'iniciado'),
    (select count(*)::int from casos_vigentes where estado = 'en_proceso'),
    (select count(*)::int from casos_vigentes where estado = 'concluido'),
    (select count(*)::int
       from fichas_seguimiento s
       join casos_vigentes c on c.id = s.caso_id
      where s.fecha between desde and hasta),
    (select coalesce(sum(g.monto), 0)
       from pagos g
       join casos_vigentes c on c.id = g.caso_id
      where g.fecha between desde and hasta
        and g.moneda = 'BOB');
$$;

-- Solo el backend la usa: se quita el acceso directo desde la API pública de Supabase.
revoke execute on function public.indicadores_operativos(date, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.indicadores_operativos(date, date) from anon, authenticated;
  end if;
end $$;

commit;

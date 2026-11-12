-- FE-60: el origen (tipo) y el número correlativo de un caso no cambian después del alta.
begin;

create index if not exists idx_casos_clasificacion on public.casos (clasificacion);

create or replace function public.proteger_numero_caso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo <> old.tipo or new.numero_correlativo <> old.numero_correlativo then
    raise exception 'El origen y el número de un caso no se pueden modificar'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_casos_numero_fijo
  before update of tipo, numero_correlativo on public.casos
  for each row execute function public.proteger_numero_caso();

commit;

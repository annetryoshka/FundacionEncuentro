begin;

-- Función compartida tomada de FE-64.
create or replace function public.registrar_actualizado_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_por := coalesce(
    nullif(current_setting('app.usuario_id', true), '')::uuid,
    new.actualizado_por
  );
  return new;
end;
$$;

commit;
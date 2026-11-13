-- FE-74: cada fila de fichas_seguimiento es una sesión del caso con su evolución.
-- El id de la sesión es el que usan tareas y pagos.
begin;

alter table public.fichas_seguimiento
  alter column fecha drop default,            -- la fecha de la sesión la envía la API
  add column evolucion       text not null,
  add column responsable_id  uuid not null references public.perfiles (id),
  add column actualizado_por uuid references public.perfiles (id),
  add constraint ck_fichas_seg_evolucion check (btrim(evolucion) <> ''),
  -- Permite que tareas y pagos exijan que la sesión sea del mismo caso.
  add constraint uq_fichas_seg_id_caso unique (id, caso_id);

comment on column public.fichas_seguimiento.responsable_id is
  'Terapeuta responsable al registrar la sesión. No cambia si después se reasigna el caso.';
comment on column public.fichas_seguimiento.contenido is 'Sin uso desde FE-74: la evolución tiene columna propia.';

-- Listado en orden de fecha y número.
create index idx_fichas_seg_orden on public.fichas_seguimiento (caso_id, fecha, nro_sesion);

-- Si no se envía nro_sesion, asigna el siguiente del caso.
-- El bloqueo sobre el caso hace que dos altas simultáneas esperen su turno y no repitan número.
create or replace function public.asignar_numero_sesion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.nro_sesion is null then
    perform 1 from public.casos where id = new.caso_id for no key update;
    select coalesce(max(nro_sesion), 0) + 1
      into new.nro_sesion
      from public.fichas_seguimiento
     where caso_id = new.caso_id;
  end if;
  return new;
end;
$$;

create trigger trg_fseg_numero before insert on public.fichas_seguimiento
  for each row execute function public.asignar_numero_sesion();
create trigger trg_fseg_autor before insert or update on public.fichas_seguimiento
  for each row execute function public.registrar_actualizado_por();

commit;

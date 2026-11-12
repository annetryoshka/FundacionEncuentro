-- FE-79: cada tarea pertenece a una sesión del mismo caso y guarda quién cambió su cumplimiento.
begin;

alter table public.tareas_terapeuticas
  add column sesion_id                    uuid not null,
  add column creado_en                    timestamptz not null default now(),
  add column cumplimiento_actualizado_por uuid references public.perfiles (id),
  add column cumplimiento_actualizado_en  timestamptz,
  -- La sesión debe existir y ser del mismo caso: no hay tareas huérfanas ni cruzadas.
  add constraint fk_tareas_sesion foreign key (sesion_id, caso_id)
    references public.fichas_seguimiento (id, caso_id) on delete restrict,
  add constraint ck_tareas_descripcion check (btrim(descripcion) <> '');

comment on column public.tareas_terapeuticas.perfil_id is 'Quién asignó la tarea.';
comment on column public.tareas_terapeuticas.completada is 'false = Pendiente, true = Realizada.';

create index idx_tareas_sesion on public.tareas_terapeuticas (sesion_id);

-- Al cambiar completada, registra quién y cuándo.
create or replace function public.registrar_cumplimiento_tarea()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.completada is distinct from old.completada then
    new.cumplimiento_actualizado_por := nullif(current_setting('app.usuario_id', true), '')::uuid;
    new.cumplimiento_actualizado_en := now();
  end if;
  return new;
end;
$$;

create trigger trg_tareas_cumplimiento before update on public.tareas_terapeuticas
  for each row execute function public.registrar_cumplimiento_tarea();

-- Faltaba en 001: las tareas también quedan en auditoria.
create trigger trg_aud_tareas after insert or update or delete on public.tareas_terapeuticas
  for each row execute function public.auditar_cambio();

commit;

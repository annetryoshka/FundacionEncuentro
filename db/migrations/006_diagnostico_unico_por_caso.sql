begin;

alter table public.fichas_diagnostico
  add constraint uq_ficha_diagnostico_caso unique (caso_id);

alter table public.fichas_diagnostico
  add column actualizado_por uuid
    references public.perfiles(id);

commit;
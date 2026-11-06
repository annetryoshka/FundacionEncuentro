begin;

alter table public.casos
  add column clasificacion text,
  add constraint ck_casos_clasificacion
    check (clasificacion in ('social', 'privado'));

comment on column public.casos.clasificacion is
  'Clasificación social/privado de FE-14, independiente del origen derivado/voluntario. NULL indica pendiente de clasificar.';

commit;
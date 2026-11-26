begin;

alter table public.exportaciones
  add column huella_revision_investigacion text,
  add constraint ck_exportaciones_huella_revision_investigacion check (
    huella_revision_investigacion is null
    or (
      tipo = 'atlas_ti'
      and revisado_en is not null
      and huella_revision_investigacion ~ '^[0-9a-f]{64}$'
    )
  );

commit;
-- FE-183: investigaciones públicas (contrato FE-182, HU FE-116). Alcance acordado el 26/11/2026:
-- administración o marketing publican artículos y el público los consulta. Sin comentarios de visitantes.
-- Reutiliza publicaciones_foro (001); comentarios_foro queda sin uso y nada lo expone.
-- Estados como difusión (FE-140): borrador → publicado → retirado → borrador.
-- Lo público sale solo de v_investigaciones_publicas. Separado de lo clínico: solo hay FK a perfiles.
begin;

alter table public.publicaciones_foro
  add column resumen                  text,
  add column autor_visible            text,
  add column imagen_ruta              text,
  add column imagen_texto_alternativo text,
  add column imagen_ancho             int,
  add column imagen_alto              int,
  add column estado                   text not null default 'borrador'
                                      check (estado in ('borrador', 'publicado', 'retirado')),
  add column publicado_en             timestamptz,
  add column publicado_por            uuid references public.perfiles (id),
  add column retirado_en              timestamptz,
  add column retirado_por             uuid references public.perfiles (id),
  add column actualizado_en           timestamptz not null default now(),
  add column actualizado_por          uuid references public.perfiles (id),
  add constraint ck_investigacion_titulo check (btrim(titulo) <> '' and char_length(titulo) <= 150),
  add constraint ck_investigacion_contenido check (btrim(contenido) <> '' and char_length(contenido) <= 20000),
  add constraint ck_investigacion_resumen check (resumen is null or char_length(resumen) <= 500),
  add constraint ck_investigacion_autor check (
    autor_visible is null or (btrim(autor_visible) <> '' and char_length(autor_visible) <= 150)),
  -- Imagen opcional: misma regla de ruta que recursos_difusion (bucket público de difusión), con texto alternativo.
  add constraint ck_investigacion_imagen check (
    (imagen_ruta is null and imagen_texto_alternativo is null and imagen_ancho is null and imagen_alto is null)
    or (imagen_ruta is not null
        and imagen_ruta ~ '^[A-Za-z0-9_-][A-Za-z0-9/_.-]*$' and imagen_ruta !~ '\.\.' and char_length(imagen_ruta) <= 300
        and btrim(coalesce(imagen_texto_alternativo, '')) <> '' and char_length(imagen_texto_alternativo) <= 300
        and (imagen_ancho is null or imagen_ancho > 0) and (imagen_alto is null or imagen_alto > 0))),
  add constraint ck_investigacion_publicada check (
    estado <> 'publicado' or (publicado_en is not null and btrim(coalesce(resumen, '')) <> ''));

comment on table public.publicaciones_foro is
  'FE-183: artículos de investigación para el portal público. Sin comentarios (comentarios_foro sin uso).';
comment on column public.publicaciones_foro.autor_id is 'Quién creó el artículo en el sistema (no se publica).';
comment on column public.publicaciones_foro.autor_visible is 'Autoría que se muestra al público; NULL si no se autorizó.';
comment on column public.publicaciones_foro.publicado_en is 'Última publicación; su fecha en Bolivia es la fecha pública.';

create index idx_investigaciones_estado on public.publicaciones_foro (estado, publicado_en desc);

-- Solo administración o marketing activos (app.usuario_id). Transiciones y fechas las pone la base.
create or replace function public.controlar_investigacion_publica()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from perfiles where id = usuario and activo and rol in ('administrador', 'marketing')) then
    raise exception 'Solo administración o marketing gestionan investigaciones' using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'DELETE' then
    if old.publicado_en is not null then
      raise exception 'Una investigación ya publicada no se elimina: se retira' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' then
      raise exception 'Una investigación nueva empieza en borrador' using errcode = 'check_violation';
    end if;
    new.autor_id := usuario;
    new.creado_en := now();
    new.publicado_en := null; new.publicado_por := null;
    new.retirado_en := null;  new.retirado_por := null;
  else
    new.autor_id := old.autor_id;
    new.creado_en := old.creado_en;
    new.publicado_en := old.publicado_en; new.publicado_por := old.publicado_por;
    new.retirado_en := old.retirado_en;   new.retirado_por := old.retirado_por;
    if new.estado is distinct from old.estado then
      if (old.estado, new.estado) not in (('borrador', 'publicado'), ('publicado', 'retirado'), ('retirado', 'borrador')) then
        raise exception 'No se puede pasar de % a %', old.estado, new.estado using errcode = 'check_violation';
      end if;
      if new.estado = 'publicado' then
        new.publicado_en := now(); new.publicado_por := usuario;
      elsif new.estado = 'retirado' then
        new.retirado_en := now(); new.retirado_por := usuario;
      end if;
    end if;
  end if;
  new.actualizado_por := usuario;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_investigacion_publica
  before insert or update or delete on public.publicaciones_foro
  for each row execute function public.controlar_investigacion_publica();
create trigger trg_aud_investigaciones
  after insert or update or delete on public.publicaciones_foro
  for each row execute function public.auditar_cambio();

-- Única fuente de la consulta pública: solo lo publicado y solo campos permitidos
-- (sin estado, borradores ni quién lo creó). fecha_publicacion = fecha en Bolivia.
create view public.v_investigaciones_publicas
with (security_invoker = true) as
select i.id, i.titulo, i.resumen, i.contenido,
       i.autor_visible as autor,
       (i.publicado_en at time zone 'America/La_Paz')::date as fecha_publicacion,
       i.publicado_en,
       i.imagen_ruta, i.imagen_texto_alternativo, i.imagen_ancho, i.imagen_alto
  from public.publicaciones_foro i
 where i.estado = 'publicado';

-- Solo el backend accede: nada directo desde la API de Supabase.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.publicaciones_foro, public.comentarios_foro, public.v_investigaciones_publicas
      from anon, authenticated;
  end if;
end $$;

commit;

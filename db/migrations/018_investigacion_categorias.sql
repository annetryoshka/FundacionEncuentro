-- FE-168: categorías de investigación, selección autorizada y paquete para Atlas.ti (propuesta de FE-167).
--   categorias_investigacion  (001) gana código, vigencia y validaciones; una categoría usada no se borra.
--   caso_categorias           (001) exige que la ficha sea del mismo caso y no repite etiquetas.
--   seleccion_investigacion() casos autorizados según rol y filtros; conteo_categorias() por categoría.
--   exportaciones             (001) registra el paquete atlas_ti y su revisión.
--   exportacion_documentos    une cada INV-NNN con su caso; el caso no sale en el paquete.
--   preparar_exportacion_investigacion(), manifiesto_exportacion(), datos_documento_investigacion(),
--   marcar_revision_exportacion().
-- Documentos y manifiesto sin nombres, teléfonos, nacimiento, residencia, números de carpeta, datos judiciales,
-- familia ni pagos. El texto libre (evolución, fragmentos, notas) se revisa antes de descargar: no se anonimiza solo.
-- Solo agrega columnas y reglas; a una categoría existente sin código le asigna CAT-NNN.
begin;

-- ---------------------------------------------------------------------
-- 1. Catálogo de categorías
-- ---------------------------------------------------------------------
alter table public.categorias_investigacion
  add column codigo          text,
  add column activa          boolean not null default true,
  add column actualizado_por uuid references public.perfiles (id),
  add column actualizado_en  timestamptz not null default now();

update public.categorias_investigacion c
   set codigo = 'CAT-' || lpad(x.n::text, 3, '0')
  from (select id, row_number() over (order by creado_en, id) as n from public.categorias_investigacion) x
 where x.id = c.id;

alter table public.categorias_investigacion
  alter column codigo set not null,
  add constraint uq_categorias_codigo unique (codigo),
  add constraint ck_categorias_codigo check (codigo ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(codigo) <= 30),
  add constraint ck_categorias_nombre check (btrim(nombre) <> '' and char_length(nombre) <= 100),
  add constraint ck_categorias_descripcion check (descripcion is null or char_length(descripcion) <= 1000),
  add constraint ck_categorias_color check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint ck_categorias_padre check (padre_id is distinct from id),
  -- Una categoría con subcategorías no se borra: se retira con activa = false.
  drop constraint categorias_investigacion_padre_id_fkey,
  add constraint fk_categorias_padre foreign key (padre_id)
    references public.categorias_investigacion (id) on delete restrict,
  drop constraint uq_categoria_nombre;

-- Nombre único dentro del mismo nivel, sin distinguir mayúsculas.
create unique index uq_categorias_nombre_nivel on public.categorias_investigacion
  (coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
create index idx_categorias_padre on public.categorias_investigacion (padre_id);

comment on column public.categorias_investigacion.codigo is
  'FE-168: código del catálogo (QA-CAT-01). Es el que figura en el manifiesto; no cambia.';
comment on column public.categorias_investigacion.activa is
  'FE-168: false = retirada. No admite etiquetas nuevas; las existentes se conservan.';

-- Normaliza código y nombre, impide ciclos y deja el código fijo.
create or replace function public.validar_categoria_investigacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.codigo := upper(btrim(new.codigo));
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.descripcion := nullif(btrim(new.descripcion), '');
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo then
    raise exception 'El código de una categoría no cambia' using errcode = 'check_violation';
  end if;
  if new.padre_id is not null and (tg_op = 'INSERT' or new.padre_id is distinct from old.padre_id) then
    if exists (
      with recursive arriba(id, padre_id) as (
        select id, padre_id from categorias_investigacion where id = new.padre_id
        union
        select c.id, c.padre_id from categorias_investigacion c join arriba a on c.id = a.padre_id)
      select 1 from arriba where id = new.id) then
      raise exception 'Una categoría no puede depender de sí misma ni de sus subcategorías' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_categorias_validar before insert or update on public.categorias_investigacion
  for each row execute function public.validar_categoria_investigacion();
create trigger trg_categorias_autor before insert on public.categorias_investigacion
  for each row execute function public.registrar_creado_por();
create trigger trg_categorias_actualizado_por before insert or update on public.categorias_investigacion
  for each row execute function public.registrar_actualizado_por();
create trigger trg_categorias_upd before update on public.categorias_investigacion
  for each row execute function public.set_actualizado_en();
create trigger trg_aud_categorias after insert or update or delete on public.categorias_investigacion
  for each row execute function public.auditar_cambio();

-- ---------------------------------------------------------------------
-- 2. Etiquetas: categoría en un caso o en una ficha del mismo caso
-- ---------------------------------------------------------------------
alter table public.caso_categorias
  drop constraint caso_categorias_categoria_id_fkey,
  drop constraint caso_categorias_ficha_diagnostico_id_fkey,
  drop constraint caso_categorias_ficha_seguimiento_id_fkey,
  add column actualizado_por uuid references public.perfiles (id),
  add column actualizado_en  timestamptz not null default now(),
  -- Una categoría usada no se borra (antes se borraban sus etiquetas en cascada).
  add constraint fk_caso_cat_categoria foreign key (categoria_id)
    references public.categorias_investigacion (id) on delete restrict,
  -- La ficha debe ser del mismo caso (claves de 016 y 008).
  add constraint fk_caso_cat_diagnostico foreign key (ficha_diagnostico_id, caso_id)
    references public.fichas_diagnostico (id, caso_id) on delete cascade,
  add constraint fk_caso_cat_sesion foreign key (ficha_seguimiento_id, caso_id)
    references public.fichas_seguimiento (id, caso_id) on delete cascade,
  add constraint uq_caso_cat_destino
    unique nulls not distinct (categoria_id, caso_id, ficha_diagnostico_id, ficha_seguimiento_id),
  add constraint ck_caso_cat_fragmento check (fragmento is null or char_length(fragmento) <= 2000),
  add constraint ck_caso_cat_nota check (nota is null or char_length(nota) <= 2000);

create index idx_caso_cat_sesion on public.caso_categorias (ficha_seguimiento_id) where ficha_seguimiento_id is not null;

comment on table public.caso_categorias is
  'FE-168: etiqueta de investigación en un caso (sin ficha) o en su ficha de diagnóstico o una sesión. Una por categoría y destino.';

-- Solo categorías vigentes y carpetas activas; el destino no cambia; autor desde app.usuario_id.
create or replace function public.validar_caso_categoria()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fragmento := nullif(btrim(new.fragmento), '');
  new.nota := nullif(btrim(new.nota), '');
  if tg_op = 'UPDATE' then
    if (new.caso_id, new.categoria_id, new.ficha_diagnostico_id, new.ficha_seguimiento_id)
       is distinct from (old.caso_id, old.categoria_id, old.ficha_diagnostico_id, old.ficha_seguimiento_id) then
      raise exception 'Una etiqueta no cambia de caso, categoría ni ficha: elimínela y regístrela de nuevo'
        using errcode = 'check_violation';
    end if;
    new.etiquetado_por := old.etiquetado_por;
    return new;
  end if;
  if exists (select 1 from categorias_investigacion where id = new.categoria_id and not activa) then
    raise exception 'La categoría está retirada' using errcode = 'check_violation';
  end if;
  if exists (select 1 from casos c join pacientes p on p.id = c.paciente_id
              where c.id = new.caso_id and (c.deleted_at is not null or p.deleted_at is not null)) then
    raise exception 'La carpeta está dada de baja' using errcode = 'check_violation';
  end if;
  new.etiquetado_por := coalesce(nullif(current_setting('app.usuario_id', true), '')::uuid, new.etiquetado_por);
  return new;
end;
$$;

create trigger trg_caso_cat_validar before insert or update on public.caso_categorias
  for each row execute function public.validar_caso_categoria();
create trigger trg_caso_cat_actualizado_por before insert or update on public.caso_categorias
  for each row execute function public.registrar_actualizado_por();
create trigger trg_caso_cat_upd before update on public.caso_categorias
  for each row execute function public.set_actualizado_en();
create trigger trg_aud_caso_cat after insert or update or delete on public.caso_categorias
  for each row execute function public.auditar_cambio();

-- ---------------------------------------------------------------------
-- 3. Selección y conteos (solo lectura)
-- ---------------------------------------------------------------------
-- Casos que un perfil puede usar para investigación: administración, todos; terapeuta, los asignados;
-- marketing, inactivo o desconocido, ninguno. Excluye carpetas y pacientes dados de baja.
create or replace function public.casos_investigacion_autorizados(p_perfil uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select c.id
    from casos c
    join pacientes p on p.id = c.paciente_id
    join perfiles u on u.id = p_perfil and u.activo
   where c.deleted_at is null
     and p.deleted_at is null
     and (u.rol = 'administrador'
          or (u.rol = 'terapeuta'
              and exists (select 1 from asignaciones_caso a where a.caso_id = c.id and a.perfil_id = u.id)))
$$;

create or replace function public.validar_filtros_investigacion(p_desde date, p_hasta date, p_residencias text[])
returns void
language plpgsql
immutable
as $$
begin
  if p_desde is not null and p_hasta is not null and p_desde > p_hasta then
    raise exception 'La fecha inicial es posterior a la final' using errcode = 'invalid_parameter_value';
  end if;
  if p_residencias is not null
     and not (p_residencias <@ array['la_paz', 'el_alto', 'otra', 'sin_registrar']) then
    raise exception 'Residencia no admitida' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Casos autorizados que cumplen los filtros. Sin filtro = no se filtra por ese criterio.
--   p_categorias: el caso tiene al menos una (en el caso o en una ficha), contando subcategorías.
--   p_desde/p_hasta: al menos una sesión en el período (fechas inclusivas).
--   p_residencias: la_paz, el_alto, otra o sin_registrar.
create or replace function public.seleccion_investigacion(
  p_perfil      uuid,
  p_categorias  uuid[] default null,
  p_desde       date   default null,
  p_hasta       date   default null,
  p_residencias text[] default null
)
returns table (caso_id uuid, tipo text, numero_correlativo int, categorias text[],
               sesiones_en_periodo int, tiene_diagnostico boolean)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  perform validar_filtros_investigacion(p_desde, p_hasta, p_residencias);
  return query
  with recursive elegidas(id) as (
    select ci.id from categorias_investigacion ci where ci.id = any (p_categorias)
    union
    select h.id from categorias_investigacion h join elegidas e on h.padre_id = e.id
  )
  select c.id, c.tipo, c.numero_correlativo,
         coalesce((select array_agg(distinct ci.codigo order by ci.codigo)
                     from caso_categorias cc join categorias_investigacion ci on ci.id = cc.categoria_id
                    where cc.caso_id = c.id), '{}'),
         (select count(*)::int from fichas_seguimiento s
           where s.caso_id = c.id
             and (p_desde is null or s.fecha >= p_desde) and (p_hasta is null or s.fecha <= p_hasta)),
         v.origen <> 'sin_datos'
    from casos c
    join pacientes p on p.id = c.paciente_id
    join v_fuente_clinica_vigente v on v.caso_id = c.id
   where c.id in (select casos_investigacion_autorizados(p_perfil))
     and (coalesce(cardinality(p_categorias), 0) = 0
          or exists (select 1 from caso_categorias cc where cc.caso_id = c.id and cc.categoria_id in (select id from elegidas)))
     and (p_residencias is null or coalesce(p.ciudad_residencia, 'sin_registrar') = any (p_residencias))
     and ((p_desde is null and p_hasta is null)
          or exists (select 1 from fichas_seguimiento s
                      where s.caso_id = c.id
                        and (p_desde is null or s.fecha >= p_desde) and (p_hasta is null or s.fecha <= p_hasta)))
   order by c.tipo, c.numero_correlativo;
end;
$$;

comment on function public.seleccion_investigacion(uuid, uuid[], date, date, text[]) is
  'FE-168: casos autorizados para el perfil que cumplen categorías (con subcategorías), período de sesiones y residencia.';

-- Todo el catálogo con sus conteos dentro de los casos autorizados y filtrados (sin sumar subcategorías).
-- Las etiquetas de sesión cuentan solo si la sesión está en el período.
create or replace function public.conteo_categorias(
  p_perfil      uuid,
  p_desde       date   default null,
  p_hasta       date   default null,
  p_residencias text[] default null
)
returns table (categoria_id uuid, codigo text, nombre text, padre_id uuid, activa boolean,
               casos int, etiquetas_caso int, etiquetas_diagnostico int, etiquetas_sesion int)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with alcance as (
    select s.caso_id from seleccion_investigacion(p_perfil, null, p_desde, p_hasta, p_residencias) s
  ), etiquetas as (
    select cc.categoria_id, cc.caso_id,
           case when cc.ficha_diagnostico_id is not null then 'diagnostico'
                when cc.ficha_seguimiento_id is not null then 'sesion'
                else 'caso' end as ambito
      from caso_categorias cc
      left join fichas_seguimiento s on s.id = cc.ficha_seguimiento_id
     where cc.caso_id in (select caso_id from alcance)
       and (cc.ficha_seguimiento_id is null
            or ((p_desde is null or s.fecha >= p_desde) and (p_hasta is null or s.fecha <= p_hasta)))
  )
  select ci.id, ci.codigo, ci.nombre, ci.padre_id, ci.activa,
         count(distinct e.caso_id)::int,
         (count(*) filter (where e.ambito = 'caso'))::int,
         (count(*) filter (where e.ambito = 'diagnostico'))::int,
         (count(*) filter (where e.ambito = 'sesion'))::int
    from categorias_investigacion ci
    left join etiquetas e on e.categoria_id = ci.id
   group by ci.id
   order by ci.codigo;
end;
$$;

comment on function public.conteo_categorias(uuid, date, date, text[]) is
  'FE-168: por categoría, casos y etiquetas (caso, diagnóstico, sesión) dentro del alcance autorizado y filtrado.';

-- ---------------------------------------------------------------------
-- 4. Paquete para Atlas.ti
-- ---------------------------------------------------------------------
alter table public.exportaciones
  add column revisado_por uuid references public.perfiles (id),
  add column revisado_en  timestamptz,
  add constraint ck_exportaciones_revision check ((revisado_por is null) = (revisado_en is null)),
  -- Un paquete de investigación reúne varios casos: el vínculo va en exportacion_documentos.
  add constraint ck_exportaciones_atlas_sin_caso check (tipo <> 'atlas_ti' or caso_id is null),
  -- El archivo del paquete se registra solo después de revisar los identificadores.
  add constraint ck_exportaciones_atlas_revisado check (tipo <> 'atlas_ti' or archivo_path is null or revisado_en is not null);

comment on column public.exportaciones.revisado_por is
  'FE-168: quién revisó el texto libre del paquete antes de descargarlo.';

-- INV-001 … INV-999, INV-1000 …
create or replace function public.id_exportacion_investigacion(orden int)
returns text
language sql
immutable
as $$ select 'INV-' || lpad(orden::text, greatest(3, length(orden::text)), '0') $$;

create table public.exportacion_documentos (
  id             uuid primary key default gen_random_uuid(),
  exportacion_id uuid not null references public.exportaciones (id) on delete cascade,
  orden          int  not null check (orden > 0),
  id_exportacion text generated always as (public.id_exportacion_investigacion(orden)) stored,
  archivo        text not null,
  caso_id        uuid not null references public.casos (id) on delete restrict,
  categorias     text[] not null default '{}',
  secciones      text[] not null,
  creado_en      timestamptz not null default now(),
  constraint uq_export_doc_orden   unique (exportacion_id, orden),
  constraint uq_export_doc_id      unique (exportacion_id, id_exportacion),
  constraint uq_export_doc_archivo unique (exportacion_id, archivo),
  constraint uq_export_doc_caso    unique (exportacion_id, caso_id),
  constraint ck_export_doc_archivo check (archivo in (id_exportacion || '.docx', id_exportacion || '.txt')),
  constraint ck_export_doc_secciones check (cardinality(secciones) > 0
    and secciones <@ array['diagnostico', 'seguimiento', 'tareas'])
);

create index idx_export_doc_caso on public.exportacion_documentos (caso_id);

comment on table public.exportacion_documentos is
  'FE-168: un documento del paquete por caso. id_exportacion y archivo salen en el manifiesto; caso_id queda solo en el sistema.';
comment on column public.exportacion_documentos.categorias is
  'Códigos al preparar: etiquetas del caso, de su diagnóstico (si se exporta) y de sus sesiones en el período (si se exporta seguimiento).';

-- Códigos de las etiquetas que entran en un documento, según secciones y período.
create or replace function public.categorias_documento_investigacion(
  p_caso uuid, p_secciones text[], p_desde date, p_hasta date)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct ci.codigo order by ci.codigo), '{}')
    from caso_categorias cc
    join categorias_investigacion ci on ci.id = cc.categoria_id
    left join fichas_seguimiento s on s.id = cc.ficha_seguimiento_id
   where cc.caso_id = p_caso
     and ((cc.ficha_diagnostico_id is null and cc.ficha_seguimiento_id is null)
          or (cc.ficha_diagnostico_id is not null and 'diagnostico' = any (p_secciones))
          or (cc.ficha_seguimiento_id is not null and 'seguimiento' = any (p_secciones)
              and (p_desde is null or s.fecha >= p_desde) and (p_hasta is null or s.fecha <= p_hasta)))
$$;

-- Un paquete ya preparado no cambia: solo se registra su revisión (una vez) y después su archivo.
create or replace function public.proteger_exportacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.tipo <> 'atlas_ti' then
    return new;
  end if;
  if (new.perfil_id, new.tipo, new.caso_id, new.parametros, new.creado_en)
     is distinct from (old.perfil_id, old.tipo, old.caso_id, old.parametros, old.creado_en) then
    raise exception 'Un paquete preparado no cambia: prepare otro' using errcode = 'check_violation';
  end if;
  if old.revisado_en is not null and (new.revisado_por, new.revisado_en) is distinct from (old.revisado_por, old.revisado_en) then
    raise exception 'El paquete ya fue revisado' using errcode = 'check_violation';
  end if;
  if old.archivo_path is not null and new.archivo_path is distinct from old.archivo_path then
    raise exception 'El archivo del paquete ya está registrado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_exportaciones_proteger before update on public.exportaciones
  for each row execute function public.proteger_exportacion();
create trigger trg_aud_exportaciones after insert or update or delete on public.exportaciones
  for each row execute function public.auditar_cambio();

-- Documentos: solo en paquetes atlas_ti sin revisar, de casos autorizados para quien prepara.
-- No se editan ni se quitan uno por uno (sí con todo el paquete).
create or replace function public.proteger_exportacion_documento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  e exportaciones%rowtype;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Un documento del paquete no cambia' using errcode = 'check_violation';
  end if;
  select * into e from exportaciones where id = coalesce(new.exportacion_id, old.exportacion_id);
  if tg_op = 'DELETE' then
    if found then
      raise exception 'Un documento no se quita del paquete: elimine el paquete completo' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if not found then
    return new;  -- la FK lo rechaza
  end if;
  if e.tipo <> 'atlas_ti' or e.revisado_en is not null then
    raise exception 'Solo se agregan documentos a un paquete atlas_ti sin revisar' using errcode = 'check_violation';
  end if;
  if new.caso_id not in (select casos_investigacion_autorizados(e.perfil_id)) then
    raise exception 'Caso no autorizado para quien prepara el paquete' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger trg_export_doc_proteger before insert or update or delete on public.exportacion_documentos
  for each row execute function public.proteger_exportacion_documento();
create trigger trg_aud_export_doc after insert or update or delete on public.exportacion_documentos
  for each row execute function public.auditar_cambio();

alter table public.exportacion_documentos enable row level security;

-- Prepara el paquete en una transacción con app.usuario_id (administración o terapeuta activa).
-- Casos repetidos se cuentan una vez; uno inexistente o no autorizado anula todo (P0002, como un 404).
-- Numera INV-001… en un orden que no sigue el número de carpeta.
create or replace function public.preparar_exportacion_investigacion(
  p_casos     uuid[],
  p_secciones text[] default array['diagnostico', 'seguimiento'],
  p_formato   text   default 'docx',
  p_desde     date   default null,
  p_hasta     date   default null,
  p_criterios jsonb  default '{}'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  usuario     uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  orden_sec   constant text[] := array['diagnostico', 'seguimiento', 'tareas'];
  v_secciones text[];
  v_casos     uuid[];
  v_id        uuid;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from perfiles where id = usuario and activo and rol in ('administrador', 'terapeuta')) then
    raise exception 'Sin permiso para exportar datos de investigación' using errcode = 'insufficient_privilege';
  end if;
  perform validar_filtros_investigacion(p_desde, p_hasta, null);
  if p_formato is null or p_formato not in ('docx', 'txt') then
    raise exception 'Formato no admitido: docx o txt' using errcode = 'invalid_parameter_value';
  end if;
  select array_agg(s order by array_position(orden_sec, s)) into v_secciones
    from (select distinct unnest(p_secciones) as s) x;
  if v_secciones is null or not (v_secciones <@ orden_sec) then
    raise exception 'Secciones admitidas: diagnostico, seguimiento, tareas' using errcode = 'invalid_parameter_value';
  end if;
  if 'tareas' = any (v_secciones) and not 'seguimiento' = any (v_secciones) then
    raise exception 'Las tareas se exportan con su sesión: incluya seguimiento' using errcode = 'invalid_parameter_value';
  end if;
  if p_criterios is null or jsonb_typeof(p_criterios) <> 'object' then
    raise exception 'Criterios inválidos' using errcode = 'invalid_parameter_value';
  end if;
  select array_agg(distinct x) into v_casos from unnest(p_casos) x where x is not null;
  if v_casos is null then
    raise exception 'Seleccione al menos un caso' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from unnest(v_casos) x where x not in (select casos_investigacion_autorizados(usuario))) then
    raise exception 'Uno o más casos no existen o no están autorizados' using errcode = 'no_data_found';
  end if;

  insert into exportaciones (perfil_id, tipo, parametros)
  values (usuario, 'atlas_ti', jsonb_build_object(
            'formatoVersion', 1,
            'formato', p_formato,
            'secciones', to_jsonb(v_secciones),
            'desde', p_desde,
            'hasta', p_hasta,
            'documentos', cardinality(v_casos),
            'criterios', p_criterios))
  returning id into v_id;

  insert into exportacion_documentos (exportacion_id, orden, archivo, caso_id, categorias, secciones)
  select v_id, y.n, id_exportacion_investigacion(y.n::int) || '.' || p_formato, y.caso,
         categorias_documento_investigacion(y.caso, v_secciones, p_desde, p_hasta), v_secciones
    from (select x as caso, row_number() over (order by x) as n from unnest(v_casos) x) y;

  return v_id;
end;
$$;

comment on function public.preparar_exportacion_investigacion(uuid[], text[], text, date, date, jsonb) is
  'FE-168: crea el paquete atlas_ti con un documento por caso autorizado. Devuelve el id de exportaciones.';

-- Paquete visible para el usuario actual: quien lo preparó o administración. Si no, P0002.
create or replace function public.exportacion_investigacion_accesible(p_exportacion uuid)
returns exportaciones
language plpgsql
stable
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  e exportaciones%rowtype;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  select * into e from exportaciones x
   where x.id = p_exportacion and x.tipo = 'atlas_ti'
     and exists (select 1 from perfiles u where u.id = usuario and u.activo
                    and (u.rol = 'administrador' or (u.rol = 'terapeuta' and u.id = x.perfil_id)));
  if not found then
    raise exception 'Paquete no encontrado' using errcode = 'no_data_found';
  end if;
  return e;
end;
$$;

-- Comprueba que cada documento siga correspondiendo a su caso: categorías iguales a las del manifiesto
-- (FEX01, DETAIL = JSON con los idExportacion) y caso aún autorizado para el usuario actual (P0002).
create or replace function public.verificar_paquete_investigacion(p_exportacion uuid, p_id_exportacion text default null)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  usuario   uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  e         exportaciones%rowtype;
  cambiados jsonb;
begin
  e := exportacion_investigacion_accesible(p_exportacion);
  if p_id_exportacion is not null
     and not exists (select 1 from exportacion_documentos d
                      where d.exportacion_id = e.id and d.id_exportacion = p_id_exportacion) then
    raise exception 'Documento no encontrado' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from exportacion_documentos d
              where d.exportacion_id = e.id
                and (p_id_exportacion is null or d.id_exportacion = p_id_exportacion)
                and d.caso_id not in (select casos_investigacion_autorizados(usuario))) then
    raise exception 'Documento no encontrado' using errcode = 'no_data_found';
  end if;
  select jsonb_agg(d.id_exportacion order by d.orden) into cambiados
    from exportacion_documentos d
   where d.exportacion_id = e.id
     and (p_id_exportacion is null or d.id_exportacion = p_id_exportacion)
     and d.categorias is distinct from categorias_documento_investigacion(
           d.caso_id, d.secciones, (e.parametros ->> 'desde')::date, (e.parametros ->> 'hasta')::date);
  if cambiados is not null then
    raise exception 'Las categorías cambiaron después de preparar el paquete: prepárelo de nuevo'
      using errcode = 'FEX01', detail = cambiados::text;
  end if;
end;
$$;

-- Manifiesto (formatoVersion 1 de FE-167) con el catálogo de las categorías usadas y sus categorías superiores.
-- Sin id del paquete, casos, carpetas ni personas.
create or replace function public.manifiesto_exportacion(p_exportacion uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  e exportaciones%rowtype;
begin
  e := exportacion_investigacion_accesible(p_exportacion);
  perform verificar_paquete_investigacion(p_exportacion);
  return jsonb_build_object(
    'formatoVersion', 1,
    'formato', e.parametros -> 'formato',
    'periodo', jsonb_build_object('desde', e.parametros -> 'desde', 'hasta', e.parametros -> 'hasta'),
    'catalogo', coalesce((
      with recursive usadas(id, padre_id) as (
        select ci.id, ci.padre_id from categorias_investigacion ci
         where ci.codigo in (select unnest(d.categorias) from exportacion_documentos d where d.exportacion_id = e.id)
        union
        select p.id, p.padre_id from categorias_investigacion p join usadas u on p.id = u.padre_id
      )
      select jsonb_agg(jsonb_build_object(
               'codigo', ci.codigo,
               'nombre', ci.nombre,
               'descripcion', ci.descripcion,
               'padre', pa.codigo) order by ci.codigo)
        from categorias_investigacion ci
        left join categorias_investigacion pa on pa.id = ci.padre_id
       where ci.id in (select id from usadas)), '[]'::jsonb),
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'idExportacion', d.id_exportacion,
               'archivo', d.archivo,
               'categorias', to_jsonb(d.categorias),
               'secciones', to_jsonb(d.secciones)) order by d.orden)
        from exportacion_documentos d
       where d.exportacion_id = e.id), '[]'::jsonb));
end;
$$;

comment on function public.manifiesto_exportacion(uuid) is
  'FE-168: manifiesto del paquete atlas_ti (formatoVersion 1): catálogo y un elemento por documento, sin identificar casos.';

-- Contenido permitido de un documento. Solo datos clínicos del caso de ese documento:
--   categorias   [{ codigo, nombre, ambito: caso | diagnostico | sesion, nroSesion, fragmento, nota }]
--   diagnostico  { origen, diagnosticoIngreso, hipotesisRelacional, comentariosClinicos }   (si se exporta)
--   seguimiento  [{ nroSesion, mes: AAAA-MM, evolucion, tareas? [{ descripcion, completada }] }] (si se exporta)
-- Fechas de sesión reducidas al mes. Los textos libres van tal cual: se revisan antes de descargar.
create or replace function public.datos_documento_investigacion(p_exportacion uuid, p_id_exportacion text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  e       exportaciones%rowtype;
  d       exportacion_documentos%rowtype;
  v_desde date;
  v_hasta date;
  v_datos jsonb;
begin
  e := exportacion_investigacion_accesible(p_exportacion);
  perform verificar_paquete_investigacion(p_exportacion, p_id_exportacion);
  select * into d from exportacion_documentos x where x.exportacion_id = e.id and x.id_exportacion = p_id_exportacion;
  v_desde := (e.parametros ->> 'desde')::date;
  v_hasta := (e.parametros ->> 'hasta')::date;

  v_datos := jsonb_build_object(
    'idExportacion', d.id_exportacion,
    'archivo', d.archivo,
    'secciones', to_jsonb(d.secciones),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', ci.codigo,
               'nombre', ci.nombre,
               'ambito', case when cc.ficha_diagnostico_id is not null then 'diagnostico'
                              when cc.ficha_seguimiento_id is not null then 'sesion' else 'caso' end,
               'nroSesion', s.nro_sesion,
               'fragmento', cc.fragmento,
               'nota', cc.nota) order by ci.codigo, s.fecha nulls first, s.nro_sesion nulls first)
        from caso_categorias cc
        join categorias_investigacion ci on ci.id = cc.categoria_id
        left join fichas_seguimiento s on s.id = cc.ficha_seguimiento_id
       where cc.caso_id = d.caso_id
         and ((cc.ficha_diagnostico_id is null and cc.ficha_seguimiento_id is null)
              or (cc.ficha_diagnostico_id is not null and 'diagnostico' = any (d.secciones))
              or (cc.ficha_seguimiento_id is not null and 'seguimiento' = any (d.secciones)
                  and (v_desde is null or s.fecha >= v_desde) and (v_hasta is null or s.fecha <= v_hasta)))),
      '[]'::jsonb));

  if 'diagnostico' = any (d.secciones) then
    v_datos := v_datos || jsonb_build_object('diagnostico', (
      select jsonb_build_object(
               'origen', v.origen,
               'diagnosticoIngreso', v.diagnostico_ingreso,
               'hipotesisRelacional', v.hipotesis_relacional,
               'comentariosClinicos', v.comentarios_clinicos)
        from v_fuente_clinica_vigente v where v.caso_id = d.caso_id));
  end if;

  if 'seguimiento' = any (d.secciones) then
    v_datos := v_datos || jsonb_build_object('seguimiento', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nroSesion', s.nro_sesion,
               'mes', to_char(s.fecha, 'YYYY-MM'),
               'evolucion', s.evolucion)
             || case when 'tareas' = any (d.secciones) then jsonb_build_object('tareas', coalesce((
                  select jsonb_agg(jsonb_build_object('descripcion', t.descripcion, 'completada', t.completada)
                                   order by t.creado_en, t.id)
                    from tareas_terapeuticas t
                   where t.sesion_id = s.id and t.caso_id = s.caso_id), '[]'::jsonb))
                else '{}'::jsonb end
             order by s.fecha, s.nro_sesion)
        from fichas_seguimiento s
       where s.caso_id = d.caso_id
         and (v_desde is null or s.fecha >= v_desde) and (v_hasta is null or s.fecha <= v_hasta)), '[]'::jsonb));
  end if;

  return v_datos;
end;
$$;

comment on function public.datos_documento_investigacion(uuid, text) is
  'FE-168: contenido permitido de un documento del paquete (categorías, diagnóstico vigente, sesiones con mes), sin identificar al paciente.';

-- Registra que se revisó el texto libre; antes comprueba la correspondencia de todo el paquete.
create or replace function public.marcar_revision_exportacion(p_exportacion uuid)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  e       exportaciones%rowtype;
  v_en    timestamptz;
begin
  e := exportacion_investigacion_accesible(p_exportacion);
  if e.revisado_en is not null then
    raise exception 'El paquete ya fue revisado' using errcode = 'check_violation';
  end if;
  perform verificar_paquete_investigacion(p_exportacion);
  update exportaciones set revisado_por = usuario, revisado_en = now()
   where id = e.id
  returning revisado_en into v_en;
  return v_en;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Permisos: solo el backend
-- ---------------------------------------------------------------------
revoke execute on function
  public.casos_investigacion_autorizados(uuid),
  public.seleccion_investigacion(uuid, uuid[], date, date, text[]),
  public.conteo_categorias(uuid, date, date, text[]),
  public.categorias_documento_investigacion(uuid, text[], date, date),
  public.preparar_exportacion_investigacion(uuid[], text[], text, date, date, jsonb),
  public.exportacion_investigacion_accesible(uuid),
  public.verificar_paquete_investigacion(uuid, text),
  public.manifiesto_exportacion(uuid),
  public.datos_documento_investigacion(uuid, text),
  public.marcar_revision_exportacion(uuid)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.categorias_investigacion, public.caso_categorias, public.exportaciones,
      public.exportacion_documentos from anon, authenticated;
    revoke execute on function
      public.casos_investigacion_autorizados(uuid),
      public.seleccion_investigacion(uuid, uuid[], date, date, text[]),
      public.conteo_categorias(uuid, date, date, text[]),
      public.categorias_documento_investigacion(uuid, text[], date, date),
      public.preparar_exportacion_investigacion(uuid[], text[], text, date, date, jsonb),
      public.exportacion_investigacion_accesible(uuid),
      public.verificar_paquete_investigacion(uuid, text),
      public.manifiesto_exportacion(uuid),
      public.datos_documento_investigacion(uuid, text),
      public.marcar_revision_exportacion(uuid)
      from anon, authenticated;
  end if;
end $$;

commit;

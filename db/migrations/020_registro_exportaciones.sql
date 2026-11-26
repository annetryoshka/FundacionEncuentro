-- FE-158: registro de exportaciones PDF y Word (propuesta de FE-156) sobre exportaciones (001).
--   exportaciones (pdf | word)      una por documento exportado de un caso: qué, quién, cuándo, con qué datos y su archivo.
--   fotografia_exportacion()        ficha o historial de un caso en un objeto; reutiliza fotografia_informe() (016).
--   datos_exportacion_actuales()    vista previa con los mismos permisos y datos que se registrarán.
--   preparar_exportacion_documento(), exportacion_documento_accesible(), datos_exportacion_documento(),
--   registrar_archivo_exportacion(), registrar_fallo_exportacion(), archivo_exportacion(), exportaciones_documentos_caso().
-- Un informe se exporta tal como se revisó (informe_versiones, 016): no se regenera. Ficha e historial se leen una sola
-- vez, al preparar, en una misma instantánea; el archivo se genera desde esa fotografía.
-- La ruta del archivo la fija la base (<caso_id>/<exportacion_id>.<ext>): no se registra un archivo bajo otro caso.
-- No cambia las reglas de atlas_ti (018). Solo agrega columnas y reglas.
begin;

-- ---------------------------------------------------------------------
-- 1. Columnas y reglas de las exportaciones de documentos
-- ---------------------------------------------------------------------
create or replace function public.ruta_archivo_exportacion(p_caso uuid, p_exportacion uuid, p_tipo text)
returns text
language sql
immutable
as $$
  select p_caso::text || '/' || p_exportacion::text || case p_tipo when 'pdf' then '.pdf' when 'word' then '.docx' end
$$;

alter table public.exportaciones
  add column documento          text check (documento in ('informe', 'ficha', 'historial')),
  add column informe_version_id uuid,
  add column datos_origen       jsonb,
  add column huella_origen      bytea generated always as (public.huella_fotografia(datos_origen)) stored,
  add column estado             text check (estado in ('preparada', 'generada', 'fallida')),
  add column archivo_sha256     bytea,
  add column archivo_bytes      bigint check (archivo_bytes > 0),
  add column generado_en        timestamptz,
  add column error              text check (btrim(error) <> '' and char_length(error) <= 1000),
  add column archivo_nombre     text generated always as (
    case tipo when 'pdf' then 'exportacion-' || id::text || '.pdf'
              when 'word' then 'exportacion-' || id::text || '.docx' end) stored,
  -- La versión exportada es del mismo caso (clave de 016).
  add constraint fk_exportaciones_informe_version foreign key (informe_version_id, caso_id)
    references public.informe_versiones (id, caso_id) on delete restrict,
  add constraint ck_exportaciones_atlas_sin_documento check (tipo <> 'atlas_ti' or (
    documento is null and informe_version_id is null and datos_origen is null and estado is null
    and archivo_sha256 is null and archivo_bytes is null and generado_en is null and error is null)),
  add constraint ck_exportaciones_documento check (tipo = 'atlas_ti' or (
    caso_id is not null and documento is not null and datos_origen is not null and estado is not null
    and (documento = 'informe') = (informe_version_id is not null)
    and revisado_por is null and revisado_en is null)),
  -- La fotografía es del caso y del documento registrados.
  add constraint ck_exportaciones_documento_caso check (datos_origen is null or (
    datos_origen #>> '{caso,id}' = caso_id::text and datos_origen ->> 'documento' = documento)),
  add constraint ck_exportaciones_estado check (case estado
    when 'preparada' then archivo_path is null and archivo_sha256 is null and archivo_bytes is null
                          and generado_en is null and error is null
    when 'generada'  then archivo_path is not null and octet_length(archivo_sha256) = 32 and archivo_bytes is not null
                          and generado_en is not null and error is null
    when 'fallida'   then archivo_path is null and archivo_sha256 is null and archivo_bytes is null
                          and generado_en is null and error is not null
    else true end),
  add constraint ck_exportaciones_ruta check (tipo = 'atlas_ti' or archivo_path is null
    or archivo_path = public.ruta_archivo_exportacion(caso_id, id, tipo));

create index idx_exportaciones_caso on public.exportaciones (caso_id, creado_en) where tipo in ('pdf', 'word');
create index idx_exportaciones_informe_version on public.exportaciones (informe_version_id)
  where informe_version_id is not null;

comment on column public.exportaciones.documento is
  'FE-158: informe (versión revisada), ficha o historial. Solo en pdf y word.';
comment on column public.exportaciones.datos_origen is
  'FE-158: datos exactos del documento, leídos al preparar. El archivo se genera desde aquí; no cambia.';
comment on column public.exportaciones.estado is
  'FE-158: preparada → generada (archivo registrado) o fallida (error del generador). Ambas son definitivas.';
comment on column public.exportaciones.archivo_path is
  'Ruta privada del archivo. En pdf y word: <caso_id>/<exportacion_id>.pdf|.docx (ruta_archivo_exportacion).';
comment on column public.exportaciones.archivo_nombre is
  'FE-158: nombre de descarga, sin datos personales.';
comment on column public.informes.formato is
  'Sin uso: cada exportación de un informe se registra en exportaciones (FE-158).';
comment on column public.informes.archivo_path is
  'Sin uso: cada exportación de un informe se registra en exportaciones (FE-158).';

-- ---------------------------------------------------------------------
-- 2. Fotografía de ficha e historial
-- ---------------------------------------------------------------------
-- Datos de un caso para una ficha o un historial. Solo lectura; no comprueba permisos.
--   identificacion  paciente, responsable y contexto judicial (el caso va siempre).
--   familia, diagnostico (fuente vigente), sesiones (todas, con tareas): como fotografia_informe().
--   genograma y pagos solo si se piden. Pagos: monto con dos decimales, en el orden de la conciliación.
create or replace function public.fotografia_exportacion(
  p_caso              uuid,
  p_documento         text,
  p_secciones         text[],
  p_incluir_genograma boolean default false,
  p_incluir_pagos     boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_base  jsonb;
  v_datos jsonb;
begin
  if p_documento is null or p_documento not in ('ficha', 'historial') then
    raise exception 'Documento admitido: ficha o historial' using errcode = 'invalid_parameter_value';
  end if;
  v_base := fotografia_informe(
    p_caso,
    case when 'sesiones' = any (p_secciones)
         then array(select s.id from fichas_seguimiento s where s.caso_id = p_caso) else '{}' end,
    'familia' = any (p_secciones),
    coalesce(p_incluir_genograma, false));

  v_datos := jsonb_build_object(
    'documento', p_documento,
    'caso', v_base -> 'caso',
    'seleccion', jsonb_build_object(
      'secciones', to_jsonb(p_secciones),
      'incluirGenograma', coalesce(p_incluir_genograma, false),
      'incluirPagos', coalesce(p_incluir_pagos, false)));
  if 'identificacion' = any (p_secciones) then
    v_datos := v_datos || jsonb_build_object(
      'paciente', v_base -> 'paciente', 'responsable', v_base -> 'responsable', 'judicial', v_base -> 'judicial');
  end if;
  if 'familia' = any (p_secciones) then
    v_datos := v_datos || jsonb_build_object('familia', v_base -> 'familia');
  end if;
  if 'diagnostico' = any (p_secciones) then
    v_datos := v_datos || jsonb_build_object('diagnostico', v_base -> 'diagnostico');
  end if;
  if 'sesiones' = any (p_secciones) then
    v_datos := v_datos || jsonb_build_object('sesiones', v_base -> 'sesiones');
  end if;
  if coalesce(p_incluir_genograma, false) then
    v_datos := v_datos || jsonb_build_object('genograma', v_base -> 'genograma');
  end if;
  if coalesce(p_incluir_pagos, false) then
    v_datos := v_datos || jsonb_build_object('pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id,
               'sesionId', g.sesion_id,
               'nroSesion', s.nro_sesion,
               'fecha', g.fecha,
               'monto', to_char(g.monto, 'FM99999990.00'),
               'moneda', g.moneda,
               'metodo', g.metodo,
               'referencia', g.referencia) order by g.fecha, s.nro_sesion, g.id)
        from pagos g
        join fichas_seguimiento s on s.id = g.sesion_id and s.caso_id = g.caso_id
       where g.caso_id = p_caso), '[]'::jsonb));
  end if;
  return v_datos;
end;
$$;

comment on function public.fotografia_exportacion(uuid, text, text[], boolean, boolean) is
  'FE-158: datos de un caso para exportar su ficha o historial, con las secciones pedidas. Sin control de permisos.';

-- ---------------------------------------------------------------------
-- 3. Parámetros, permisos y vista previa
-- ---------------------------------------------------------------------
-- Valida la solicitud de FE-156 y la deja en forma canónica (formatoVersion 1):
--   { documento, formato: pdf | docx, secciones, informeVersionId, incluirGenograma, incluirPagos }
-- Informe: solo informeVersionId (se exporta como se revisó). Ficha: identificacion, familia, diagnostico
-- (por defecto identificacion y diagnostico). Historial: además sesiones (por defecto todas); pagos solo aquí.
create or replace function public.normalizar_parametros_exportacion(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_doc        text;
  v_formato    text;
  v_secciones  text[];
  v_permitidas text[];
  v_version    uuid;
  v_genograma  boolean;
  v_pagos      boolean;
  v_clave      text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Parámetros de exportación inválidos' using errcode = 'invalid_parameter_value';
  end if;
  select k into v_clave from jsonb_object_keys(p) k
   where k not in ('formatoVersion', 'documento', 'formato', 'secciones', 'informeVersionId', 'incluirGenograma', 'incluirPagos')
   limit 1;
  if v_clave is not null then
    raise exception 'Parámetro no admitido: %', v_clave using errcode = 'invalid_parameter_value';
  end if;
  if p ? 'formatoVersion' and p -> 'formatoVersion' <> '1'::jsonb then
    raise exception 'formatoVersion admitido: 1' using errcode = 'invalid_parameter_value';
  end if;

  v_doc := p ->> 'documento';
  if v_doc is null or v_doc not in ('informe', 'ficha', 'historial') then
    raise exception 'Documento admitido: informe, ficha o historial' using errcode = 'invalid_parameter_value';
  end if;
  v_formato := p ->> 'formato';
  if v_formato is null or v_formato not in ('pdf', 'docx') then
    raise exception 'Formato admitido: pdf o docx' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(jsonb_typeof(p -> 'incluirGenograma'), 'boolean') <> 'boolean'
     or coalesce(jsonb_typeof(p -> 'incluirPagos'), 'boolean') <> 'boolean' then
    raise exception 'incluirGenograma e incluirPagos son verdadero o falso' using errcode = 'invalid_parameter_value';
  end if;
  v_genograma := coalesce((p ->> 'incluirGenograma')::boolean, false);
  v_pagos := coalesce((p ->> 'incluirPagos')::boolean, false);
  if coalesce(jsonb_typeof(p -> 'secciones'), 'null') not in ('array', 'null') then
    raise exception 'secciones es una lista' using errcode = 'invalid_parameter_value';
  end if;

  if v_doc = 'informe' then
    begin
      v_version := (p ->> 'informeVersionId')::uuid;
    exception when invalid_text_representation then
      raise exception 'informeVersionId inválido' using errcode = 'invalid_parameter_value';
    end;
    if v_version is null then
      raise exception 'Indique la versión revisada del informe' using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_array_length(coalesce(nullif(p -> 'secciones', 'null'::jsonb), '[]')) > 0 or v_genograma or v_pagos then
      raise exception 'Un informe se exporta tal como se revisó: sin secciones, genograma ni pagos'
        using errcode = 'invalid_parameter_value';
    end if;
    v_secciones := '{}';
  else
    if p ? 'informeVersionId' and p -> 'informeVersionId' <> 'null'::jsonb then
      raise exception 'informeVersionId solo corresponde a un informe' using errcode = 'invalid_parameter_value';
    end if;
    v_permitidas := case v_doc when 'ficha' then array['identificacion', 'familia', 'diagnostico']
                               else array['identificacion', 'familia', 'diagnostico', 'sesiones'] end;
    if coalesce(p -> 'secciones', 'null'::jsonb) = 'null'::jsonb then
      v_secciones := case v_doc when 'ficha' then array['identificacion', 'diagnostico'] else v_permitidas end;
    else
      select array_agg(s order by array_position(v_permitidas, s)) into v_secciones
        from (select distinct x as s from jsonb_array_elements_text(p -> 'secciones') x) y;
      if v_secciones is null then
        raise exception 'Seleccione al menos una sección' using errcode = 'invalid_parameter_value';
      end if;
      if not (v_secciones <@ v_permitidas) or array_position(v_secciones, null) is not null then
        raise exception 'Secciones admitidas en %: %', v_doc, array_to_string(v_permitidas, ', ')
          using errcode = 'invalid_parameter_value';
      end if;
    end if;
    if v_pagos and v_doc <> 'historial' then
      raise exception 'Los pagos solo se incluyen en el historial' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  return jsonb_build_object(
    'formatoVersion', 1,
    'documento', v_doc,
    'formato', v_formato,
    'secciones', to_jsonb(v_secciones),
    'informeVersionId', v_version,
    'incluirGenograma', v_genograma,
    'incluirPagos', v_pagos);
end;
$$;

-- Datos que tendría la exportación si se preparara ahora, con los permisos del usuario actual (app.usuario_id):
-- administración, cualquier caso activo; terapeuta, sus casos asignados; pagos, solo administración.
-- Sin usuario, marketing o cuenta inactiva → 42501; caso o versión inexistente o ajena → P0002 (como un 404).
create or replace function public.datos_exportacion_actuales(p_caso uuid, p_parametros jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  v_rol   text;
  v_param jsonb;
  v       informe_versiones%rowtype;
  i       informes%rowtype;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  select rol into v_rol from perfiles where id = usuario and activo and rol in ('administrador', 'terapeuta');
  if not found then
    raise exception 'Sin permiso para exportar documentos clínicos' using errcode = 'insufficient_privilege';
  end if;
  v_param := normalizar_parametros_exportacion(p_parametros);
  if p_caso is null or p_caso not in (select casos_investigacion_autorizados(usuario)) then
    raise exception 'Caso no encontrado' using errcode = 'no_data_found';
  end if;
  if (v_param ->> 'incluirPagos')::boolean and v_rol <> 'administrador' then
    raise exception 'Solo administración puede exportar datos de pagos' using errcode = 'insufficient_privilege';
  end if;

  if v_param ->> 'documento' <> 'informe' then
    return fotografia_exportacion(
      p_caso, v_param ->> 'documento',
      array(select jsonb_array_elements_text(v_param -> 'secciones')),
      (v_param ->> 'incluirGenograma')::boolean,
      (v_param ->> 'incluirPagos')::boolean);
  end if;

  select * into v from informe_versiones where id = (v_param ->> 'informeVersionId')::uuid and caso_id = p_caso;
  if not found then
    raise exception 'Versión del informe no encontrada' using errcode = 'no_data_found';
  end if;
  if v.estado <> 'revisado' then
    raise exception 'Solo se exporta una versión revisada del informe' using errcode = 'check_violation';
  end if;
  select * into i from informes where id = v.informe_id;
  return jsonb_build_object(
    'documento', 'informe',
    'caso', v.datos_origen -> 'caso',
    'informe', jsonb_build_object(
      'id', i.id,
      'tipo', i.tipo,
      'versionId', v.id,
      'nroVersion', v.nro_version,
      'versionPlantilla', v.version_plantilla,
      'revisadoPor', v.revisado_por,
      'revisadoEn', instante_utc(v.revisado_en),
      'huellaOrigen', encode(v.huella_origen, 'hex')),
    'secciones', v.secciones,
    'fotografia', v.datos_origen);
end;
$$;

comment on function public.datos_exportacion_actuales(uuid, jsonb) is
  'FE-158: vista previa de una exportación (mismos permisos y datos que preparar_exportacion_documento).';

-- ---------------------------------------------------------------------
-- 4. Registro
-- ---------------------------------------------------------------------
-- Alta: la base lee los datos (una sola instantánea) y pone autor, parámetros canónicos y estado.
-- Si se envía datos_origen (la vista previa mostrada), debe ser igual a los datos actuales.
create or replace function public.preparar_exportacion_clinica()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_param  jsonb;
  v_actual jsonb;
begin
  v_actual := datos_exportacion_actuales(new.caso_id, new.parametros);
  v_param := normalizar_parametros_exportacion(new.parametros);
  if (v_param ->> 'formato' = 'pdf') <> (new.tipo = 'pdf') then
    raise exception 'El tipo de exportación no corresponde al formato' using errcode = 'invalid_parameter_value';
  end if;
  if new.datos_origen is not null and new.datos_origen is distinct from v_actual then
    raise exception 'Los datos no coinciden con los actuales del caso: prepare la exportación de nuevo'
      using errcode = 'check_violation';
  end if;
  new.perfil_id := nullif(current_setting('app.usuario_id', true), '')::uuid;
  new.parametros := v_param;
  new.documento := v_param ->> 'documento';
  new.informe_version_id := (v_param ->> 'informeVersionId')::uuid;
  new.datos_origen := v_actual;
  new.estado := 'preparada';
  return new;
end;
$$;

-- Lo registrado no cambia ni se elimina. Solo una vez: preparada → generada (archivo) o fallida (error).
create or replace function public.proteger_exportacion_clinica()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Una exportación registrada no se elimina' using errcode = 'check_violation';
  end if;
  if (new.perfil_id, new.tipo, new.caso_id, new.documento, new.informe_version_id, new.parametros, new.datos_origen,
      new.creado_en, new.revisado_por, new.revisado_en)
     is distinct from (old.perfil_id, old.tipo, old.caso_id, old.documento, old.informe_version_id, old.parametros,
      old.datos_origen, old.creado_en, old.revisado_por, old.revisado_en) then
    raise exception 'Una exportación registrada no cambia: prepare otra' using errcode = 'check_violation';
  end if;
  if old.estado <> 'preparada' then
    raise exception 'La exportación ya está cerrada: prepare otra' using errcode = 'check_violation';
  end if;
  if new.estado = 'generada' then
    new.generado_en := now();
  end if;
  return new;
end;
$$;

create trigger trg_exportaciones_preparar_clinica before insert on public.exportaciones
  for each row when (new.tipo in ('pdf', 'word')) execute function public.preparar_exportacion_clinica();
create trigger trg_exportaciones_proteger_clinica before update or delete on public.exportaciones
  for each row when (old.tipo in ('pdf', 'word')) execute function public.proteger_exportacion_clinica();

-- Prepara la exportación en una transacción con app.usuario_id. p_datos: la vista previa mostrada (opcional).
create or replace function public.preparar_exportacion_documento(p_caso uuid, p_parametros jsonb, p_datos jsonb default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into exportaciones (perfil_id, tipo, caso_id, parametros, datos_origen)
  values (nullif(current_setting('app.usuario_id', true), '')::uuid,
          case when normalizar_parametros_exportacion(p_parametros) ->> 'formato' = 'pdf' then 'pdf' else 'word' end,
          p_caso, p_parametros, p_datos)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.preparar_exportacion_documento(uuid, jsonb, jsonb) is
  'FE-158: registra la exportación de un informe revisado, una ficha o un historial con sus datos. Devuelve el id.';

-- Exportación visible para el usuario actual: quien la preparó o administración, si el caso sigue autorizado
-- y, si incluye pagos, solo administración. Si no, P0002.
create or replace function public.exportacion_documento_accesible(p_exportacion uuid)
returns exportaciones
language plpgsql
stable
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  e       exportaciones%rowtype;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  select * into e from exportaciones x
   where x.id = p_exportacion and x.tipo in ('pdf', 'word')
     and x.caso_id in (select casos_investigacion_autorizados(usuario))
     and exists (select 1 from perfiles u where u.id = usuario and u.activo
                    and (u.rol = 'administrador'
                         or (u.rol = 'terapeuta' and u.id = x.perfil_id and not (x.parametros ->> 'incluirPagos')::boolean)));
  if not found then
    raise exception 'Exportación no encontrada' using errcode = 'no_data_found';
  end if;
  return e;
end;
$$;

-- Lo que necesita el generador (FE-159): datos registrados, formato, nombre y ruta donde guardar el archivo.
create or replace function public.datos_exportacion_documento(p_exportacion uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  e exportaciones%rowtype;
begin
  e := exportacion_documento_accesible(p_exportacion);
  return jsonb_build_object(
    'exportacionId', e.id,
    'documento', e.documento,
    'formato', e.parametros -> 'formato',
    'estado', e.estado,
    'archivoNombre', e.archivo_nombre,
    'archivoPath', ruta_archivo_exportacion(e.caso_id, e.id, e.tipo),
    'datos', e.datos_origen);
end;
$$;

-- Registra el archivo generado (sha256 en hexadecimal y tamaño). Solo desde preparada; un archivo vacío no se registra.
create or replace function public.registrar_archivo_exportacion(p_exportacion uuid, p_sha256 text, p_bytes bigint)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  e    exportaciones%rowtype;
  v_en timestamptz;
begin
  e := exportacion_documento_accesible(p_exportacion);
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 inválido' using errcode = 'invalid_parameter_value';
  end if;
  if p_bytes is null or p_bytes <= 0 then
    raise exception 'Un archivo vacío no se registra como exportado' using errcode = 'invalid_parameter_value';
  end if;
  update exportaciones
     set estado = 'generada', archivo_path = ruta_archivo_exportacion(caso_id, id, tipo),
         archivo_sha256 = decode(p_sha256, 'hex'), archivo_bytes = p_bytes
   where id = e.id
  returning generado_en into v_en;
  return v_en;
end;
$$;

-- Registra que el generador falló. La exportación queda como antecedente; para reintentar se prepara otra.
create or replace function public.registrar_fallo_exportacion(p_exportacion uuid, p_error text)
returns void
language plpgsql
set search_path = public
as $$
declare
  e exportaciones%rowtype;
begin
  e := exportacion_documento_accesible(p_exportacion);
  update exportaciones
     set estado = 'fallida', error = left(coalesce(nullif(btrim(p_error), ''), 'Error del generador'), 1000)
   where id = e.id;
end;
$$;

-- Descarga: solo un archivo registrado, con los mismos permisos (55000 si aún no hay archivo).
create or replace function public.archivo_exportacion(p_exportacion uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  e exportaciones%rowtype;
begin
  e := exportacion_documento_accesible(p_exportacion);
  if e.estado <> 'generada' then
    raise exception 'El archivo de la exportación no está disponible' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return jsonb_build_object(
    'archivoPath', e.archivo_path,
    'archivoNombre', e.archivo_nombre,
    'tipoContenido', case e.tipo when 'pdf' then 'application/pdf'
                     else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' end,
    'bytes', e.archivo_bytes,
    'sha256', encode(e.archivo_sha256, 'hex'));
end;
$$;

-- Trazabilidad por caso: administración ve todas las exportaciones del caso; terapeuta, las suyas.
create or replace function public.exportaciones_documentos_caso(p_caso uuid)
returns table (exportacion_id uuid, documento text, formato text, informe_version_id uuid, nro_version int,
               secciones text[], incluir_genograma boolean, incluir_pagos boolean, perfil_id uuid,
               perfil_nombre text, creado_en timestamptz, estado text, generado_en timestamptz, archivo_nombre text)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  v_rol   text;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  select rol into v_rol from perfiles where id = usuario and activo and rol in ('administrador', 'terapeuta');
  if not found then
    raise exception 'Sin permiso para ver exportaciones' using errcode = 'insufficient_privilege';
  end if;
  if p_caso is null or p_caso not in (select casos_investigacion_autorizados(usuario)) then
    raise exception 'Caso no encontrado' using errcode = 'no_data_found';
  end if;
  return query
  select e.id, e.documento, e.parametros ->> 'formato', e.informe_version_id, v.nro_version,
         array(select jsonb_array_elements_text(e.parametros -> 'secciones')),
         (e.parametros ->> 'incluirGenograma')::boolean, (e.parametros ->> 'incluirPagos')::boolean,
         e.perfil_id, pf.nombre_completo, e.creado_en, e.estado, e.generado_en, e.archivo_nombre
    from exportaciones e
    join perfiles pf on pf.id = e.perfil_id
    left join informe_versiones v on v.id = e.informe_version_id
   where e.caso_id = p_caso and e.tipo in ('pdf', 'word')
     and (v_rol = 'administrador' or e.perfil_id = usuario)
   order by e.creado_en, e.id;
end;
$$;

comment on function public.exportaciones_documentos_caso(uuid) is
  'FE-158: exportaciones de documentos de un caso (quién, cuándo, qué versión y secciones, estado).';

-- ---------------------------------------------------------------------
-- 5. Permisos: solo el backend
-- ---------------------------------------------------------------------
revoke execute on function
  public.ruta_archivo_exportacion(uuid, uuid, text),
  public.fotografia_exportacion(uuid, text, text[], boolean, boolean),
  public.normalizar_parametros_exportacion(jsonb),
  public.datos_exportacion_actuales(uuid, jsonb),
  public.preparar_exportacion_documento(uuid, jsonb, jsonb),
  public.exportacion_documento_accesible(uuid),
  public.datos_exportacion_documento(uuid),
  public.registrar_archivo_exportacion(uuid, text, bigint),
  public.registrar_fallo_exportacion(uuid, text),
  public.archivo_exportacion(uuid),
  public.exportaciones_documentos_caso(uuid)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.exportaciones from anon, authenticated;
    revoke execute on function
      public.ruta_archivo_exportacion(uuid, uuid, text),
      public.fotografia_exportacion(uuid, text, text[], boolean, boolean),
      public.normalizar_parametros_exportacion(jsonb),
      public.datos_exportacion_actuales(uuid, jsonb),
      public.preparar_exportacion_documento(uuid, jsonb, jsonb),
      public.exportacion_documento_accesible(uuid),
      public.datos_exportacion_documento(uuid),
      public.registrar_archivo_exportacion(uuid, text, bigint),
      public.registrar_fallo_exportacion(uuid, text),
      public.archivo_exportacion(uuid),
      public.exportaciones_documentos_caso(uuid)
      from anon, authenticated;
  end if;
end $$;

commit;

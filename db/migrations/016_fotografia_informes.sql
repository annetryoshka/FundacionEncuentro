-- FE-152: informes con la fotografía de los datos usados (plantillas de FE-151).
--   informes                  cabecera por caso y tipo (existía en 001 sin uso).
--   informe_versiones         cada generación: fotografía (datos_origen), texto y estado.
--   informe_version_sesiones  sesiones citadas, siempre del mismo caso.
--   fotografia_informe()      arma la fotografía desde un solo caso.
-- La fotografía se comprueba contra los datos actuales al guardarla: no se aceptan datos de otro
-- caso ni un diagnóstico desactualizado. Una versión revisada no cambia; si el expediente cambia,
-- se genera otra versión y la anterior se conserva.
-- No modifica datos existentes.
begin;

-- ---------------------------------------------------------------------
-- Claves compuestas para exigir el mismo caso
-- ---------------------------------------------------------------------
alter table public.informes
  add constraint uq_informes_id_caso unique (id, caso_id);

alter table public.fichas_diagnostico
  add constraint uq_fichas_diagnostico_id_caso unique (id, caso_id);

comment on table public.informes is
  'FE-152: informe de un caso (judicial o intervencion_sistemica). Su contenido está en informe_versiones.';
comment on column public.informes.formato is 'Reservado para la exportación (FE-158).';
comment on column public.informes.archivo_path is 'Reservado para la exportación (FE-158).';

-- ---------------------------------------------------------------------
-- Fotografía
-- ---------------------------------------------------------------------
-- Instante en UTC con formato fijo: la fotografía no depende de la zona horaria de la sesión.
create or replace function public.instante_utc(t timestamptz)
returns text
language sql
immutable
set search_path = public
as $$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

-- Datos del caso que usa un informe, en un único objeto. Solo lectura.
-- Sesiones: las indicadas, sin repetir y en orden de fecha y número; todas deben ser del caso.
-- Diagnóstico: fuente vigente de FE-125 (ficha, alta o sin_datos).
-- Familia y genograma solo si se piden; null = no incluido.
create or replace function public.fotografia_informe(
  p_caso_id           uuid,
  p_sesiones          uuid[]  default '{}',
  p_incluir_familia   boolean default false,
  p_incluir_genograma boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_base      jsonb;
  v_sesiones  uuid[];
  v_ajenas    int;
  v_familia   jsonb;
  v_genograma jsonb;
begin
  select jsonb_build_object(
           'caso', jsonb_build_object(
             'id', c.id,
             'tipo', c.tipo,
             'numeroCorrelativo', c.numero_correlativo,
             'estado', c.estado,
             'clasificacion', c.clasificacion,
             'fechaIngreso', c.fecha_ingreso),
           'paciente', jsonb_build_object(
             'id', p.id,
             'nombreCompleto', p.nombre_completo,
             'fechaNacimiento', p.fecha_nacimiento,
             'edadAlIngreso', p.edad_al_ingreso),
           'responsable', (select jsonb_build_object('id', pf.id, 'nombreCompleto', pf.nombre_completo)
                             from asignaciones_caso a join perfiles pf on pf.id = a.perfil_id
                            where a.caso_id = c.id),
           'diagnostico', jsonb_build_object(
             'origen', v.origen,
             'diagnosticoIngreso', v.diagnostico_ingreso,
             'hipotesisRelacional', v.hipotesis_relacional,
             'comentariosClinicos', v.comentarios_clinicos,
             'fichaId', v.ficha_id,
             'fichaFecha', v.ficha_fecha,
             'fichaActualizadaEn', instante_utc(v.ficha_actualizada_en)),
           'judicial', (select jsonb_build_object(
                                 'juzgado', j.juzgado,
                                 'nroExpediente', j.nro_expediente,
                                 'fechaDerivacion', j.fecha_derivacion,
                                 'observaciones', j.observaciones)
                          from contexto_judicial j where j.caso_id = c.id))
    into v_base
    from casos c
    join pacientes p on p.id = c.paciente_id
    join v_fuente_clinica_vigente v on v.caso_id = c.id
   where c.id = p_caso_id;

  if v_base is null then
    raise exception 'Caso no encontrado' using errcode = 'no_data_found';
  end if;

  -- Sesiones pedidas: sin repetir y en orden estable.
  select coalesce(array_agg(s.id order by s.fecha, s.nro_sesion), '{}'), count(*) filter (where s.caso_id <> p_caso_id)
    into v_sesiones, v_ajenas
    from fichas_seguimiento s
   where s.id = any (coalesce(p_sesiones, '{}'));

  if v_ajenas > 0 or cardinality(v_sesiones) <> (select count(distinct x) from unnest(coalesce(p_sesiones, '{}')) x) then
    raise exception 'Una o más sesiones no pertenecen al caso' using errcode = 'check_violation';
  end if;

  if p_incluir_familia then
    select case when ff.id is null then jsonb_build_object('registrada', false)
           else jsonb_build_object(
             'registrada', true,
             'version', ff.version,
             'integrantes', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', f.id,
                        'parentesco', f.parentesco,
                        'parentescoDetalle', f.parentesco_detalle,
                        'nombreCompleto', f.nombre_completo,
                        'fechaNacimiento', f.fecha_nacimiento,
                        'edadReferida', f.edad_referida,
                        'fechaReferencia', f.fecha_referencia,
                        'ocupacion', f.ocupacion,
                        'lugarTrabajoEstudio', f.lugar_trabajo_estudio,
                        'conviveConPaciente', f.convive_con_paciente,
                        'observaciones', f.observaciones) order by f.orden_registro)
                 from familiares f
                where f.caso_id = ff.caso_id and f.deleted_at is null), '[]'::jsonb))
           end
      into v_familia
      from (select p_caso_id as caso_id) x
      left join fichas_familiares ff on ff.caso_id = x.caso_id;
  end if;

  if p_incluir_genograma then
    -- El archivo del genograma llega con la migración 012 (FE-130).
    if to_regclass('public.genograma_archivos') is null then
      raise exception 'El genograma requiere la migración 012' using errcode = 'feature_not_supported';
    end if;
    select coalesce((
             select jsonb_build_object(
                      'vigente', true,
                      'clave', ga.clave,
                      'nombre', ga.nombre,
                      'tipo', ga.tipo,
                      'activadoEn', instante_utc(ga.activado_en),
                      'sha256', encode(ga.sha256, 'hex'))
               from genogramas g
               join genograma_archivos ga on ga.clave = g.archivo_clave and ga.caso_id = g.caso_id
              where g.caso_id = p_caso_id),
           jsonb_build_object('vigente', false))
      into v_genograma;
  end if;

  return v_base || jsonb_build_object(
    'seleccion', jsonb_build_object(
      'sesionesIds', to_jsonb(v_sesiones),
      'incluirFamilia', coalesce(p_incluir_familia, false),
      'incluirGenograma', coalesce(p_incluir_genograma, false)),
    'sesiones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'nroSesion', s.nro_sesion,
               'fecha', s.fecha,
               'evolucion', s.evolucion,
               'responsableId', s.responsable_id,
               'tareas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', t.id,
                          'descripcion', t.descripcion,
                          'fechaAsignada', t.fecha_asignada,
                          'fechaLimite', t.fecha_limite,
                          'completada', t.completada) order by t.creado_en, t.id)
                   from tareas_terapeuticas t
                  where t.sesion_id = s.id and t.caso_id = s.caso_id), '[]'::jsonb))
             order by s.fecha, s.nro_sesion)
        from fichas_seguimiento s
       where s.id = any (v_sesiones) and s.caso_id = p_caso_id), '[]'::jsonb),
    'familia', v_familia,
    'genograma', v_genograma);
end;
$$;

comment on function public.fotografia_informe(uuid, uuid[], boolean, boolean) is
  'FE-152: datos de un caso para un informe (identificación, diagnóstico vigente, judicial, sesiones con tareas, familia y genograma opcionales).';

-- Huella de una fotografía, para saber si los datos cambiaron.
create or replace function public.huella_fotografia(datos jsonb)
returns bytea
language sql
immutable
set search_path = public
as $$ select sha256(convert_to(datos::text, 'UTF8')) $$;

-- ---------------------------------------------------------------------
-- Versiones
-- ---------------------------------------------------------------------
create table public.informe_versiones (
  id                   uuid primary key default gen_random_uuid(),
  informe_id           uuid not null,
  caso_id              uuid not null,
  nro_version          int  not null check (nro_version > 0),
  estado               text not null default 'borrador' check (estado in ('borrador', 'revisado')),
  version_plantilla    text not null
    check (btrim(version_plantilla) <> '' and char_length(version_plantilla) <= 50),
  datos_origen         jsonb not null,
  huella_origen        bytea generated always as (public.huella_fotografia(datos_origen)) stored,
  -- Referencias tomadas de la fotografía; no se escriben aparte.
  ficha_diagnostico_id uuid generated always as ((datos_origen #>> '{diagnostico,fichaId}')::uuid) stored,
  genograma_clave      text generated always as (datos_origen #>> '{genograma,clave}') stored,
  secciones            jsonb not null default '[]',
  creado_por           uuid references public.perfiles (id),
  creado_en            timestamptz not null default now(),
  actualizado_por      uuid references public.perfiles (id),
  actualizado_en       timestamptz not null default now(),
  revisado_por         uuid references public.perfiles (id),
  revisado_en          timestamptz,

  constraint fk_informe_versiones_informe foreign key (informe_id, caso_id)
    references public.informes (id, caso_id) on delete restrict,
  constraint fk_informe_versiones_ficha foreign key (ficha_diagnostico_id, caso_id)
    references public.fichas_diagnostico (id, caso_id) on delete restrict,
  constraint uq_informe_versiones_nro unique (informe_id, nro_version),
  constraint uq_informe_versiones_id_caso unique (id, caso_id),
  constraint ck_informe_versiones_origen_caso check (datos_origen #>> '{caso,id}' = caso_id::text),
  -- Misma regla de clave que genograma_archivos (012): <caso_id>/<uuid>.
  constraint ck_informe_versiones_genograma check (
    genograma_clave is null or genograma_clave ~ ('^' || caso_id::text || '/[0-9a-f-]{36}$')),
  constraint ck_informe_versiones_secciones check (jsonb_typeof(secciones) = 'array'),
  constraint ck_informe_versiones_revision check (
    (estado = 'revisado') = (revisado_en is not null and revisado_por is not null))
);

comment on table public.informe_versiones is
  'FE-152: cada generación de un informe. datos_origen es la fotografía de fotografia_informe(); no cambia.';
comment on column public.informe_versiones.secciones is
  'Texto del informe: [{ "titulo": ..., "contenido": ... }]. Editable solo en borrador.';
comment on column public.informe_versiones.huella_origen is
  'sha256 de datos_origen. Igual a huella_fotografia(fotografia_informe(...)) mientras los datos no cambien.';

-- Un solo borrador abierto por informe.
create unique index uq_informe_versiones_borrador on public.informe_versiones (informe_id)
  where estado = 'borrador';
create index idx_informe_versiones_caso on public.informe_versiones (caso_id, creado_en);

create table public.informe_version_sesiones (
  version_id uuid not null,
  caso_id    uuid not null,
  sesion_id  uuid not null,
  orden      int  not null check (orden > 0),
  primary key (version_id, sesion_id),
  constraint uq_informe_version_sesiones_orden unique (version_id, orden),
  constraint fk_ivs_version foreign key (version_id, caso_id)
    references public.informe_versiones (id, caso_id) on delete cascade,
  constraint fk_ivs_sesion foreign key (sesion_id, caso_id)
    references public.fichas_seguimiento (id, caso_id) on delete restrict
);

comment on table public.informe_version_sesiones is
  'FE-152: sesiones citadas por una versión, en el orden de la fotografía. Se llena sola al crear la versión.';

create index idx_informe_version_sesiones_sesion on public.informe_version_sesiones (sesion_id);

-- ---------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------
-- El caso y el tipo de un informe no cambian; el autor sale de app.usuario_id.
create or replace function public.proteger_informe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.generado_por := coalesce(nullif(current_setting('app.usuario_id', true), '')::uuid, new.generado_por);
  elsif new.caso_id <> old.caso_id or new.tipo <> old.tipo or new.generado_por is distinct from old.generado_por then
    raise exception 'El caso, el tipo y el autor de un informe no se pueden modificar' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_informes_proteger before insert or update on public.informes
  for each row execute function public.proteger_informe();

-- Alta: siempre borrador, número siguiente del informe y fotografía igual a los datos actuales.
create or replace function public.preparar_informe_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actual jsonb;
begin
  if new.estado <> 'borrador' or new.revisado_por is not null or new.revisado_en is not null then
    raise exception 'Una versión nueva empieza como borrador' using errcode = 'check_violation';
  end if;

  -- Bloquea el informe: dos altas simultáneas no repiten número.
  perform 1 from informes where id = new.informe_id for no key update;
  select coalesce(max(nro_version), 0) + 1 into new.nro_version
    from informe_versiones where informe_id = new.informe_id;

  begin
    v_actual := fotografia_informe(
      new.caso_id,
      array(select jsonb_array_elements_text(coalesce(new.datos_origen #> '{seleccion,sesionesIds}', '[]'))::uuid),
      coalesce((new.datos_origen #>> '{seleccion,incluirFamilia}')::boolean, false),
      coalesce((new.datos_origen #>> '{seleccion,incluirGenograma}')::boolean, false));
  exception when invalid_text_representation or check_violation then
    raise exception 'La fotografía no corresponde a datos del caso' using errcode = 'check_violation';
  end;
  if v_actual is distinct from new.datos_origen then
    raise exception 'La fotografía no coincide con los datos actuales del caso' using errcode = 'check_violation';
  end if;

  new.creado_por := coalesce(nullif(current_setting('app.usuario_id', true), '')::uuid, new.creado_por);
  return new;
end;
$$;

-- Edición: la fotografía y la identidad no cambian; el texto solo en borrador; revisar es definitivo.
create or replace function public.proteger_informe_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'revisado' then
      raise exception 'Una versión revisada no se puede eliminar' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.estado = 'revisado' then
    raise exception 'Una versión revisada no se puede modificar' using errcode = 'check_violation';
  end if;
  if new.informe_id <> old.informe_id or new.caso_id <> old.caso_id or new.nro_version <> old.nro_version
     or new.version_plantilla <> old.version_plantilla or new.datos_origen <> old.datos_origen
     or new.creado_por is distinct from old.creado_por or new.creado_en <> old.creado_en then
    raise exception 'La fotografía de una versión no se puede modificar' using errcode = 'check_violation';
  end if;
  if new.estado = 'revisado' then
    new.revisado_por := nullif(current_setting('app.usuario_id', true), '')::uuid;
    new.revisado_en := now();
  else
    new.revisado_por := null;
    new.revisado_en := null;
  end if;
  return new;
end;
$$;

-- Copia las sesiones de la fotografía a informe_version_sesiones.
create or replace function public.registrar_sesiones_informe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into informe_version_sesiones (version_id, caso_id, sesion_id, orden)
  select new.id, new.caso_id, s.id::uuid, s.orden
    from jsonb_array_elements_text(new.datos_origen #> '{seleccion,sesionesIds}') with ordinality as s (id, orden);
  return null;
end;
$$;

-- Las sesiones citadas no se editan ni se quitan mientras exista la versión.
create or replace function public.proteger_sesiones_informe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' or exists (select 1 from informe_versiones where id = old.version_id) then
    raise exception 'Las sesiones de una versión no se pueden modificar' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger trg_iv_preparar before insert on public.informe_versiones
  for each row execute function public.preparar_informe_version();
create trigger trg_iv_proteger before update or delete on public.informe_versiones
  for each row execute function public.proteger_informe_version();
create trigger trg_iv_actualizado_por before insert or update on public.informe_versiones
  for each row execute function public.registrar_actualizado_por();
create trigger trg_iv_upd before update on public.informe_versiones
  for each row execute function public.set_actualizado_en();
create trigger trg_iv_sesiones after insert on public.informe_versiones
  for each row execute function public.registrar_sesiones_informe();
create trigger trg_aud_informe_versiones after insert or update or delete on public.informe_versiones
  for each row execute function public.auditar_cambio();

create trigger trg_ivs_proteger before update or delete on public.informe_version_sesiones
  for each row execute function public.proteger_sesiones_informe();

-- true si los datos del caso siguen iguales a la fotografía de la versión.
create or replace function public.informe_version_al_dia(p_version_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select huella_fotografia(fotografia_informe(
           v.caso_id,
           array(select jsonb_array_elements_text(v.datos_origen #> '{seleccion,sesionesIds}')::uuid),
           (v.datos_origen #>> '{seleccion,incluirFamilia}')::boolean,
           (v.datos_origen #>> '{seleccion,incluirGenograma}')::boolean)) = v.huella_origen
    from informe_versiones v
   where v.id = p_version_id;
$$;

alter table public.informe_versiones enable row level security;
alter table public.informe_version_sesiones enable row level security;

commit;

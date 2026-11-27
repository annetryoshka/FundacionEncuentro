-- FE-126: evaluación inicial propia y diagnóstico opcional (decisión de FE-123).
-- Solo amplía lecturas; no copia, renombra ni modifica fichas existentes.
-- Las fotografías anteriores sin evaluación conservan su estructura y su huella.
-- Las nuevas fotografías incluyen la evaluación cuando existe; informes revisados
-- y archivos exportados previamente permanecen inmutables.
begin;

create or replace view public.v_fuente_clinica_vigente
with (security_invoker = true) as
select c.id as caso_id,
       case when f.id is not null then 'ficha'
            when coalesce(c.diagnostico_ingreso, c.hipotesis_relacional, c.comentarios_clinicos) is not null then 'alta'
            else 'sin_datos' end as origen,
       case when f.id is not null then f.contenido ->> 'diagnosticoIngreso' else c.diagnostico_ingreso end
         as diagnostico_ingreso,
       case when f.id is not null then f.contenido ->> 'hipotesisRelacional' else c.hipotesis_relacional end
         as hipotesis_relacional,
       case when f.id is not null then f.contenido ->> 'comentariosClinicos' else c.comentarios_clinicos end
         as comentarios_clinicos,
       f.id              as ficha_id,
       f.fecha           as ficha_fecha,
       f.actualizado_por as ficha_actualizada_por,
       f.actualizado_en  as ficha_actualizada_en,
       c.diagnostico_ingreso  as alta_diagnostico_ingreso,
       c.hipotesis_relacional as alta_hipotesis_relacional,
       c.comentarios_clinicos as alta_comentarios_clinicos,
       f.contenido ->> 'evaluacionInicial' as evaluacion_inicial
  from public.casos c
  join public.pacientes p on p.id = c.paciente_id
  left join public.fichas_diagnostico f on f.caso_id = c.id
 where c.deleted_at is null
   and p.deleted_at is null;

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
             'fichaActualizadaEn', instante_utc(v.ficha_actualizada_en)) ||
             case when v.evaluacion_inicial is not null
                  then jsonb_build_object('evaluacionInicial', v.evaluacion_inicial)
                  else '{}'::jsonb end,
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
               'comentariosClinicos', v.comentarios_clinicos) ||
             case when v.evaluacion_inicial is not null
                  then jsonb_build_object('evaluacionInicial', v.evaluacion_inicial)
                  else '{}'::jsonb end
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

comment on view public.v_fuente_clinica_vigente is
  'FE-126: fuente vigente con evaluación inicial independiente; valores del alta conservados, sin rellenar nulos de una ficha.';

commit;

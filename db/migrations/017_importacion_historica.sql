-- FE-163: lotes de importación histórica (FE-9, RF-13/RF-14; mapeo de FE-162).
-- Flujo: la API guarda cada fila tal como se leyó → clasificar_importacion() valida y busca
-- coincidencias → administración decide → confirmar_importacion() aplica todo el lote o nada.
-- La importación solo inserta pacientes y casos: nunca modifica, fusiona ni borra registros existentes.
begin;

-- ---------------------------------------------------------------------
-- 1. Cabecera del lote (tabla de 001, sin uso hasta ahora)
-- ---------------------------------------------------------------------
alter table public.importaciones
  add column estado              text not null default 'en_revision',
  add column version             int  not null default 1,
  add column version_transaccion xid8 not null default pg_current_xact_id(),
  add column formato             text,
  add column archivo_sha256      text,
  add column origen              text,
  add column confirmada_en       timestamptz,
  add column confirmada_por      uuid references public.perfiles (id),
  add column actualizado_en      timestamptz not null default now(),
  add column acepta_avance_contador boolean not null default false,
  add constraint ck_importaciones_estado check (estado in ('en_revision', 'confirmada', 'descartada')),
  add constraint ck_importaciones_version check (version > 0),
  add constraint ck_importaciones_formato check (formato in ('csv', 'xlsx')),
  add constraint ck_importaciones_sha256 check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint ck_importaciones_origen check (char_length(origen) <= 200),
  add constraint ck_importaciones_confirmada
    check ((estado = 'confirmada') = (confirmada_en is not null and confirmada_por is not null));

comment on column public.importaciones.estado is
  'FE-163: en_revision → confirmada o descartada. Los dos últimos son definitivos.';
comment on column public.importaciones.version is
  'FE-163: sube una vez por transacción que cambia filas o decisiones. confirmar_importacion la compara.';
comment on column public.importaciones.acepta_avance_contador is
  'FE-163: al confirmar, administración aceptó que el lote haga saltar el contador de carpetas.';
comment on column public.importaciones.origen is
  'FE-163: procedencia declarada del archivo (Excel antiguo, transcripción de carpetas o tarjetas).';
comment on column public.importaciones.errores is
  'Columna de 001 sin uso: los errores se guardan por fila en importacion_filas.';

create index idx_importaciones_sha256 on public.importaciones (archivo_sha256);

create trigger trg_importaciones_upd before update on public.importaciones
  for each row execute function public.set_actualizado_en();

-- ---------------------------------------------------------------------
-- 2. Filas del lote
-- ---------------------------------------------------------------------
create table public.importacion_filas (
  id                  uuid primary key default gen_random_uuid(),
  importacion_id      uuid not null references public.importaciones (id) on delete restrict,
  numero_fila         int  not null check (numero_fila > 0),
  referencia_origen   text,
  -- Valores tal como se leyeron del archivo (texto), con las claves de la plantilla.
  datos               jsonb not null check (jsonb_typeof(datos) = 'object'),
  huella              text generated always as (md5(datos::text)) stored,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente', 'valida_nueva', 'error', 'posible_duplicado', 'duplicado_en_lote')),
  errores             jsonb not null default '[]' check (jsonb_typeof(errores) = 'array'),
  coincidencias       jsonb not null default '[]' check (jsonb_typeof(coincidencias) = 'array'),
  advertencias        jsonb not null default '[]' check (jsonb_typeof(advertencias) = 'array'),
  decision            text check (decision in ('crear', 'vincular', 'excluir')),
  -- Destino de "vincular": un caso existente, un paciente existente u otra fila del lote.
  paciente_destino_id uuid references public.pacientes (id),
  caso_destino_id     uuid references public.casos (id),
  fila_destino        int,
  decidido_por        uuid references public.perfiles (id),
  decidido_en         timestamptz,
  resultado           text check (resultado in ('creada', 'vinculada', 'excluida')),
  paciente_id         uuid references public.pacientes (id),
  caso_id             uuid references public.casos (id),
  constraint uq_importacion_fila unique (importacion_id, numero_fila),
  constraint ck_importacion_fila_destino check (
    case when decision = 'vincular'
         then num_nonnulls(paciente_destino_id, caso_destino_id, fila_destino) = 1
         else num_nonnulls(paciente_destino_id, caso_destino_id, fila_destino) = 0 end),
  constraint ck_importacion_fila_destino_propia check (fila_destino is distinct from numero_fila)
);

comment on table public.importacion_filas is
  'FE-163: filas de un lote de importación, con su validación, coincidencias, decisión y resultado.';
comment on column public.importacion_filas.huella is
  'md5 de los datos leídos: detecta la misma fila ya importada en otro lote.';
comment on column public.importacion_filas.decision is
  'crear: paciente y caso nuevos. vincular: caso existente (sin escribir nada), paciente existente o paciente '
  'creado por otra fila (caso nuevo). excluir: no se importa.';

create index idx_importacion_filas_referencia on public.importacion_filas (referencia_origen);
create index idx_importacion_filas_huella on public.importacion_filas (huella);
create index idx_importacion_filas_paciente on public.importacion_filas (paciente_id);
create index idx_importacion_filas_caso on public.importacion_filas (caso_id);

-- Un lote confirmado o descartado ya no cambia: conserva procedencia, decisiones y resultado.
create or replace function public.proteger_importacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'importaciones' then
    if old.estado <> 'en_revision' then
      raise exception 'La importación ya está %', old.estado using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' then return new; end if;
    return old;
  end if;
  if exists (select 1 from importaciones
              where id = coalesce(new.importacion_id, old.importacion_id) and estado <> 'en_revision') then
    raise exception 'La importación ya no está en revisión' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger trg_importaciones_proteger before update or delete on public.importaciones
  for each row execute function public.proteger_importacion();
create trigger trg_importacion_filas_proteger before insert or update or delete on public.importacion_filas
  for each row execute function public.proteger_importacion();

-- Cualquier cambio en las filas sube la versión del lote una vez por transacción.
create or replace function public.subir_version_importacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update importaciones
     set version = version + 1, version_transaccion = pg_current_xact_id()
   where id = coalesce(new.importacion_id, old.importacion_id)
     and version_transaccion <> pg_current_xact_id();
  return null;
end;
$$;

create trigger trg_importacion_filas_version after insert or update or delete on public.importacion_filas
  for each row execute function public.subir_version_importacion();

-- Autor y momento de la última decisión (la vista previa propone "crear" en filas válidas).
create or replace function public.registrar_decision_importacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.decision is distinct from old.decision then
    new.decidido_por := case when new.decision is null then null
                             else nullif(current_setting('app.usuario_id', true), '')::uuid end;
    new.decidido_en := case when new.decision is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger trg_importacion_filas_decision before insert or update of decision on public.importacion_filas
  for each row execute function public.registrar_decision_importacion();

create trigger trg_aud_importaciones after insert or update or delete on public.importaciones
  for each row execute function public.auditar_cambio();
create trigger trg_aud_importacion_filas after insert or update or delete on public.importacion_filas
  for each row execute function public.auditar_cambio();

-- ---------------------------------------------------------------------
-- 3. Plantilla y validación por fila
-- ---------------------------------------------------------------------
-- Columnas de la plantilla, en orden (db/importacion/plantilla-importacion-historica.csv).
create or replace function public.importacion_columnas()
returns text[]
language sql
immutable
as $$
  select array['referenciaOrigen', 'nombreCompleto', 'fechaNacimiento', 'edadAlIngreso', 'telefono',
               'tipo', 'numeroCorrelativo', 'fechaIngreso', 'clasificacion', 'ciudadResidencia',
               'otraLocalidad', 'diagnosticoIngreso', 'hipotesisRelacional', 'comentariosClinicos',
               'estado', 'juzgado', 'nroExpediente', 'fechaDerivacion']
$$;

-- Texto recortado; cadena vacía = sin dato.
create or replace function public.importacion_texto(d jsonb, clave text)
returns text
language sql
immutable
as $$ select nullif(btrim(d ->> clave), '') $$;

-- AAAA-MM-DD de un día que existe; si no, NULL (to_date aceptaría 2026-02-30).
create or replace function public.importacion_fecha(valor text)
returns date
language plpgsql
immutable
as $$
begin
  if valor !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return make_date(substr(valor, 1, 4)::int, substr(valor, 6, 2)::int, substr(valor, 9, 2)::int);
exception when others then
  return null;
end;
$$;

-- Errores de una fila como [{campo, mensaje}]. Mismas reglas que el alta manual (FE-32/33, FE-14, FE-135).
create or replace function public.validar_fila_importacion(d jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  e        jsonb := '[]';
  clave    text;
  nombre   text := importacion_texto(d, 'nombreCompleto');
  tipo     text := importacion_texto(d, 'tipo');
  numero   text := importacion_texto(d, 'numeroCorrelativo');
  edad     text := importacion_texto(d, 'edadAlIngreso');
  ciudad   text := importacion_texto(d, 'ciudadResidencia');
  otra     text := importacion_texto(d, 'otraLocalidad');
  t_ingreso text := importacion_texto(d, 'fechaIngreso');
  t_nac    text := importacion_texto(d, 'fechaNacimiento');
  t_deriv  text := importacion_texto(d, 'fechaDerivacion');
  f_ingreso date := importacion_fecha(t_ingreso);
  f_nac    date := importacion_fecha(t_nac);
  f_deriv  date := importacion_fecha(t_deriv);
begin
  for clave in select jsonb_object_keys(d) loop
    if not clave = any (importacion_columnas()) then
      e := e || jsonb_build_object('campo', clave, 'mensaje', 'Columna desconocida');
    elsif jsonb_typeof(d -> clave) not in ('string', 'null') then
      e := e || jsonb_build_object('campo', clave, 'mensaje', 'Debe ser texto');
    end if;
  end loop;

  if nombre is null then
    e := e || jsonb_build_object('campo', 'nombreCompleto', 'mensaje', 'Falta el nombre del paciente');
  end if;
  if tipo is null then
    e := e || jsonb_build_object('campo', 'tipo', 'mensaje', 'Falta el origen del caso');
  elsif tipo not in ('voluntario', 'derivado') then
    e := e || jsonb_build_object('campo', 'tipo', 'mensaje', 'El origen debe ser voluntario o derivado');
  end if;
  if numero is not null and (numero !~ '^\d{1,9}$' or numero::int = 0) then
    e := e || jsonb_build_object('campo', 'numeroCorrelativo', 'mensaje', 'El número de carpeta debe ser un entero positivo');
  end if;

  if t_ingreso is null then
    e := e || jsonb_build_object('campo', 'fechaIngreso', 'mensaje', 'Falta la fecha de ingreso');
  elsif f_ingreso is null then
    e := e || jsonb_build_object('campo', 'fechaIngreso', 'mensaje', 'Fecha inválida, use AAAA-MM-DD');
  elsif f_ingreso < date '1990-01-01' or f_ingreso > current_date then
    e := e || jsonb_build_object('campo', 'fechaIngreso', 'mensaje', 'La fecha de ingreso debe estar entre 1990-01-01 y hoy');
  end if;
  if t_nac is not null and f_nac is null then
    e := e || jsonb_build_object('campo', 'fechaNacimiento', 'mensaje', 'Fecha inválida, use AAAA-MM-DD');
  elsif f_nac < date '1900-01-01' or f_nac > coalesce(f_ingreso, current_date) then
    e := e || jsonb_build_object('campo', 'fechaNacimiento', 'mensaje', 'La fecha de nacimiento no puede ser posterior al ingreso');
  end if;
  if edad is not null and (edad !~ '^\d{1,3}$' or edad::int > 120) then
    e := e || jsonb_build_object('campo', 'edadAlIngreso', 'mensaje', 'La edad debe ser un entero entre 0 y 120');
  end if;

  if importacion_texto(d, 'clasificacion') not in ('social', 'privado') then
    e := e || jsonb_build_object('campo', 'clasificacion', 'mensaje', 'La clasificación debe ser social o privado');
  end if;
  if importacion_texto(d, 'estado') not in ('iniciado', 'en_proceso', 'concluido') then
    e := e || jsonb_build_object('campo', 'estado', 'mensaje', 'El estado debe ser iniciado, en_proceso o concluido');
  end if;

  if ciudad not in ('la_paz', 'el_alto', 'otra') then
    e := e || jsonb_build_object('campo', 'ciudadResidencia', 'mensaje', 'La ciudad debe ser la_paz, el_alto u otra');
  elsif ciudad = 'otra' and otra is null then
    e := e || jsonb_build_object('campo', 'otraLocalidad', 'mensaje', 'Indique la localidad');
  elsif ciudad is distinct from 'otra' and otra is not null then
    e := e || jsonb_build_object('campo', 'otraLocalidad', 'mensaje', 'Solo se indica con ciudad otra');
  end if;
  if char_length(otra) > 100 then
    e := e || jsonb_build_object('campo', 'otraLocalidad', 'mensaje', 'Máximo 100 caracteres');
  end if;

  if tipo = 'voluntario' and num_nonnulls(importacion_texto(d, 'juzgado'),
       importacion_texto(d, 'nroExpediente'), t_deriv) > 0 then
    e := e || jsonb_build_object('campo', 'juzgado', 'mensaje', 'Un caso voluntario no lleva contexto judicial');
  end if;
  if t_deriv is not null and f_deriv is null then
    e := e || jsonb_build_object('campo', 'fechaDerivacion', 'mensaje', 'Fecha inválida, use AAAA-MM-DD');
  elsif f_deriv > current_date then
    e := e || jsonb_build_object('campo', 'fechaDerivacion', 'mensaje', 'La fecha de derivación no puede ser futura');
  end if;
  return e;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Clasificación: errores, coincidencias y advertencias de cada fila
-- ---------------------------------------------------------------------
-- Coincidencias (ninguna fusiona ni borra nada):
--   carpeta    mismo origen y número que un caso existente (también eliminado: el número sigue ocupado)
--   ya_importada misma fila (mismos datos) importada en un lote confirmado
--   referencia misma referencia de origen con otros datos en un lote confirmado
--   nombre     paciente con nombre parecido (similitud > 0.6, como el alta manual)
--   fila       otra fila del lote con el mismo origen y número, o con nombre parecido
-- Devuelve los números de fila cuya clasificación cambió.
create or replace function public.clasificar_importacion(p_importacion uuid)
returns setof int
language plpgsql
set search_path = public
as $$
declare
  f        record;
  v_err    jsonb;
  v_coin   jsonb;
  v_adv    jsonb;
  v_estado text;
  v_nombre text;
  v_tipo   text;
  v_numero int;
  v_nac    date;
  v_ultimo int;
begin
  for f in select * from importacion_filas where importacion_id = p_importacion order by numero_fila loop
    v_err := validar_fila_importacion(f.datos);
    v_adv := '[]';
    v_nombre := importacion_texto(f.datos, 'nombreCompleto');
    v_tipo := importacion_texto(f.datos, 'tipo');
    v_numero := case when importacion_texto(f.datos, 'numeroCorrelativo') ~ '^\d{1,9}$'
                     then importacion_texto(f.datos, 'numeroCorrelativo')::int end;
    v_nac := importacion_fecha(importacion_texto(f.datos, 'fechaNacimiento'));

    select coalesce(jsonb_agg(x.c - 'orden' order by x.c ->> 'tipo', x.c ->> 'orden'), '[]') into v_coin from (
      select jsonb_build_object('tipo', 'carpeta', 'orden', lpad(ca.numero_correlativo::text, 10, '0'),
               'casoId', ca.id, 'pacienteId', p.id, 'nombreCompleto', p.nombre_completo,
               'tipoCaso', ca.tipo, 'numero', ca.numero_correlativo, 'eliminado', ca.deleted_at is not null) as c
        from casos ca join pacientes p on p.id = ca.paciente_id
       where ca.tipo = v_tipo and ca.numero_correlativo = v_numero
      union all
      select jsonb_build_object('tipo', case when o.huella = f.huella then 'ya_importada' else 'referencia' end,
               'orden', o.importacion_id::text || lpad(o.numero_fila::text, 10, '0'),
               'importacionId', o.importacion_id, 'numeroFila', o.numero_fila,
               'pacienteId', o.paciente_id, 'casoId', o.caso_id)
        from importacion_filas o join importaciones i on i.id = o.importacion_id
       where i.estado = 'confirmada' and o.resultado in ('creada', 'vinculada')
         and (o.huella = f.huella or o.referencia_origen = f.referencia_origen)
      union all
      (select jsonb_build_object('tipo', 'nombre', 'orden', to_char(1 - s.similitud, '0.0000') || s.id::text,
                'pacienteId', s.id, 'nombreCompleto', s.nombre_completo,
                'similitud', round(s.similitud::numeric, 2),
                'mismaFechaNacimiento', coalesce(s.fecha_nacimiento = v_nac, false))
         from (select p.id, p.nombre_completo, p.fecha_nacimiento,
                      extensions.similarity(p.nombre_completo, v_nombre) as similitud
                 from pacientes p
                where v_nombre is not null and p.deleted_at is null
                  and extensions.similarity(p.nombre_completo, v_nombre) > 0.6) s
        order by s.similitud desc, s.id
        limit 5)
      union all
      select jsonb_build_object('tipo', 'fila', 'orden', lpad(o.numero_fila::text, 10, '0'),
               'numeroFila', o.numero_fila,
               'mismoNumero', coalesce(importacion_texto(o.datos, 'tipo') = v_tipo
                              and importacion_texto(o.datos, 'numeroCorrelativo') ~ '^\d{1,9}$'
                              and importacion_texto(o.datos, 'numeroCorrelativo')::int = v_numero, false))
        from importacion_filas o
       where o.importacion_id = p_importacion and o.numero_fila <> f.numero_fila
         and ((v_numero is not null and importacion_texto(o.datos, 'tipo') = v_tipo
               and importacion_texto(o.datos, 'numeroCorrelativo') ~ '^\d{1,9}$'
               and importacion_texto(o.datos, 'numeroCorrelativo')::int = v_numero)
              or extensions.similarity(importacion_texto(o.datos, 'nombreCompleto'), v_nombre) > 0.6)
    ) x;

    if v_numero is not null and v_tipo in ('voluntario', 'derivado') then
      select ultimo_numero into v_ultimo from contadores_caso where tipo = v_tipo;
      if v_numero > v_ultimo then
        v_adv := v_adv || jsonb_build_object('tipo', 'contador', 'mensaje',
          format('El último número %s es %s: el contador pasará a %s', v_tipo, v_ultimo, v_numero));
      end if;
    end if;

    v_estado := case
      when jsonb_array_length(v_err) > 0 then 'error'
      when exists (select 1 from jsonb_array_elements(v_coin) c where c ->> 'tipo' <> 'fila') then 'posible_duplicado'
      when jsonb_array_length(v_coin) > 0 then 'duplicado_en_lote'
      else 'valida_nueva' end;

    -- Si cambian el estado o las coincidencias, la decisión anterior ya no vale y se vuelve a pedir.
    update importacion_filas
       set estado = v_estado, errores = v_err, coincidencias = v_coin, advertencias = v_adv,
           decision = case when (estado, coincidencias) is not distinct from (v_estado, v_coin) then decision
                           when v_estado = 'valida_nueva' then 'crear' end,
           paciente_destino_id = case when (estado, coincidencias) is not distinct from (v_estado, v_coin)
                                      then paciente_destino_id end,
           caso_destino_id = case when (estado, coincidencias) is not distinct from (v_estado, v_coin)
                                  then caso_destino_id end,
           fila_destino = case when (estado, coincidencias) is not distinct from (v_estado, v_coin)
                               then fila_destino end
     where id = f.id
       and (estado, errores, coincidencias, advertencias) is distinct from (v_estado, v_err, v_coin, v_adv);
    if found then return next f.numero_fila; end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Resumen y confirmación transaccional
-- ---------------------------------------------------------------------
create or replace function public.resumen_importacion(p_importacion uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'importacionId', i.id, 'estado', i.estado, 'version', i.version,
    'confirmadaEn', i.confirmada_en, 'confirmadaPor', i.confirmada_por,
    'creadas', count(*) filter (where f.resultado = 'creada'),
    'vinculadas', count(*) filter (where f.resultado = 'vinculada'),
    'excluidas', count(*) filter (where f.resultado = 'excluida'),
    'filas', coalesce(jsonb_agg(jsonb_build_object(
               'numeroFila', f.numero_fila, 'referenciaOrigen', f.referencia_origen, 'resultado', f.resultado,
               'pacienteId', f.paciente_id, 'casoId', f.caso_id, 'tipo', c.tipo, 'numeroCorrelativo', c.numero_correlativo)
             order by f.numero_fila) filter (where f.id is not null), '[]'))
    from importaciones i
    left join importacion_filas f on f.importacion_id = i.id
    left join casos c on c.id = f.caso_id
   where i.id = p_importacion
   group by i.id
$$;

-- Aplica las decisiones del lote en una sola transacción (la del backend, con app.usuario_id).
-- - Lote ya confirmado: devuelve su resumen sin escribir nada (reintento seguro).
-- - Versión distinta de la revisada: error FEI01.
-- - Si al volver a clasificar cambió alguna fila: guarda la nueva clasificación y devuelve
--   {"estado": "revisar", "filas": [...]} sin importar nada.
-- - Filas sin decisión válida: error FEI02 con el detalle en DETAIL (JSON).
-- - Números que harían saltar el contador sin p_acepta_avance: error FEI04 (DETAIL: JSON con el salto por tipo).
-- - Cualquier fallo al insertar revierte el lote completo: no quedan filas importadas a medias.
create or replace function public.confirmar_importacion(p_importacion uuid, p_version int, p_acepta_avance boolean default false)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  lote       importaciones;
  usuario    uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
  cambiadas  int[];
  pendientes jsonb;
  saltos     jsonb;
  f          record;
  v_paciente uuid;
  v_caso     uuid;
  d          jsonb;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  select * into lote from importaciones where id = p_importacion for update;
  if not found then
    raise exception 'Importación no encontrada' using errcode = 'no_data_found';
  end if;
  if lote.estado = 'confirmada' then
    return resumen_importacion(p_importacion);
  end if;
  if lote.estado = 'descartada' then
    raise exception 'La importación fue descartada' using errcode = 'FEI03';
  end if;
  if lote.version <> p_version then
    raise exception 'La importación cambió desde la vista previa (versión %, revisada %)', lote.version, p_version
      using errcode = 'FEI01';
  end if;

  select array_agg(n) into cambiadas from clasificar_importacion(p_importacion) n;
  if cambiadas is not null then
    return jsonb_build_object('importacionId', p_importacion, 'estado', 'revisar', 'filas', to_jsonb(cambiadas),
      'version', (select version from importaciones where id = p_importacion));
  end if;

  -- Decisiones que no se pueden aplicar. crea_caso: la fila abre un caso nuevo (crear o vincular a un paciente).
  with filas as (
    select r.*, r.decision = 'crear' or (r.decision = 'vincular' and r.caso_destino_id is null) as crea_caso,
           case when importacion_texto(r.datos, 'numeroCorrelativo') ~ '^\d{1,9}$'
                then importacion_texto(r.datos, 'numeroCorrelativo')::int end as numero
      from importacion_filas r
     where r.importacion_id = p_importacion
  ), motivos as (
    select r.numero_fila, case
        when r.decision is null then 'Falta la decisión'
        when r.estado = 'error' and r.decision <> 'excluir' then 'Corrija o excluya la fila con errores'
        when r.crea_caso and exists (select 1 from jsonb_array_elements(r.coincidencias) c where c ->> 'tipo' = 'carpeta')
          then 'El número ya existe: vincule al caso existente o excluya'
        when r.crea_caso and exists (select 1 from jsonb_array_elements(r.coincidencias) c where c ->> 'tipo' = 'ya_importada')
          then 'La fila ya fue importada: vincule al caso existente o excluya'
        when r.crea_caso and r.numero is not null and exists (
               select 1 from filas o
                where o.numero_fila <> r.numero_fila and o.crea_caso and o.numero = r.numero
                  and importacion_texto(o.datos, 'tipo') = importacion_texto(r.datos, 'tipo'))
          then 'Otra fila del lote usa el mismo número'
        when r.paciente_destino_id is not null and not exists (
               select 1 from pacientes p where p.id = r.paciente_destino_id and p.deleted_at is null)
          then 'Paciente de destino inexistente'
        when r.caso_destino_id is not null and not exists (
               select 1 from casos ca where ca.id = r.caso_destino_id and ca.deleted_at is null)
          then 'Caso de destino inexistente'
        when r.fila_destino is not null and not exists (
               select 1 from filas o where o.numero_fila = r.fila_destino and o.decision = 'crear')
          then 'La fila de destino debe crearse en este lote'
      end as motivo
      from filas r
  )
  select jsonb_agg(jsonb_build_object('numeroFila', m.numero_fila, 'motivo', m.motivo) order by m.numero_fila)
    into pendientes
    from motivos m
   where m.motivo is not null;
  if pendientes is not null then
    raise exception 'Hay filas sin resolver' using errcode = 'FEI02', detail = pendientes::text;
  end if;
  if not exists (select 1 from importacion_filas where importacion_id = p_importacion and decision <> 'excluir') then
    raise exception 'No hay filas para importar' using errcode = 'FEI02', detail = '[]';
  end if;

  -- Salto del contador: números propios que dejarían huecos (p. ej. de 10 a 900001) requieren aceptar el lote.
  -- Los números consecutivos al último no cuentan como salto.
  if not p_acepta_avance then
    select jsonb_agg(jsonb_build_object('tipo', s.tipo, 'ultimoActual', k.ultimo_numero, 'nuevoUltimo', s.maximo)
                     order by s.tipo)
      into saltos
      from (select importacion_texto(r.datos, 'tipo') as tipo, max(n.numero) as maximo, count(*) as cantidad
              from importacion_filas r
              cross join lateral (select case when importacion_texto(r.datos, 'numeroCorrelativo') ~ '^\d{1,9}$'
                                              then importacion_texto(r.datos, 'numeroCorrelativo')::int end as numero) n
              join contadores_caso k0 on k0.tipo = importacion_texto(r.datos, 'tipo')
             where r.importacion_id = p_importacion
               and (r.decision = 'crear' or (r.decision = 'vincular' and r.caso_destino_id is null))
               and n.numero > k0.ultimo_numero
             group by 1) s
      join contadores_caso k on k.tipo = s.tipo
     where s.maximo > k.ultimo_numero + s.cantidad;
    if saltos is not null then
      raise exception 'El contador de carpetas avanzará: acepte el salto o revise los números'
        using errcode = 'FEI04', detail = saltos::text;
    end if;
  end if;

  -- Primero las filas que crean (pueden ser destino de otras), luego vínculos y exclusiones.
  for f in select * from importacion_filas where importacion_id = p_importacion
            order by case decision when 'crear' then 0 when 'vincular' then 1 else 2 end, numero_fila loop
    d := f.datos;
    v_paciente := null;
    v_caso := null;
    if f.decision = 'excluir' then
      update importacion_filas set resultado = 'excluida' where id = f.id;
      continue;
    end if;
    if f.decision = 'vincular' and f.caso_destino_id is not null then
      -- La carpeta ya existe: la fila queda como antecedente de origen, sin tocar el caso.
      select ca.paciente_id, ca.id into v_paciente, v_caso from casos ca where ca.id = f.caso_destino_id;
      update importacion_filas set resultado = 'vinculada', paciente_id = v_paciente, caso_id = v_caso where id = f.id;
      continue;
    end if;

    if f.decision = 'crear' then
      insert into pacientes (nombre_completo, fecha_nacimiento, edad_al_ingreso, telefono,
                             ciudad_residencia, otra_localidad, creado_por)
      values (importacion_texto(d, 'nombreCompleto'),
              importacion_fecha(importacion_texto(d, 'fechaNacimiento')),
              coalesce(importacion_texto(d, 'edadAlIngreso')::int,
                       date_part('year', age(importacion_fecha(importacion_texto(d, 'fechaIngreso')),
                                             importacion_fecha(importacion_texto(d, 'fechaNacimiento'))))::int),
              importacion_texto(d, 'telefono'),
              importacion_texto(d, 'ciudadResidencia'),
              importacion_texto(d, 'otraLocalidad'),
              usuario)
      returning id into v_paciente;
    elsif f.paciente_destino_id is not null then
      v_paciente := f.paciente_destino_id;
    else
      select o.paciente_id into v_paciente from importacion_filas o
       where o.importacion_id = p_importacion and o.numero_fila = f.fila_destino;
    end if;

    insert into casos (paciente_id, tipo, estado, fecha_ingreso, clasificacion,
                       diagnostico_ingreso, hipotesis_relacional, comentarios_clinicos,
                       creado_por, numero_correlativo)
    values (v_paciente,
            importacion_texto(d, 'tipo'),
            coalesce(importacion_texto(d, 'estado'), 'iniciado'),
            importacion_fecha(importacion_texto(d, 'fechaIngreso')),
            importacion_texto(d, 'clasificacion'),
            importacion_texto(d, 'diagnosticoIngreso'),
            importacion_texto(d, 'hipotesisRelacional'),
            importacion_texto(d, 'comentariosClinicos'),
            usuario,
            importacion_texto(d, 'numeroCorrelativo')::int)
    returning id into v_caso;

    if num_nonnulls(importacion_texto(d, 'juzgado'), importacion_texto(d, 'nroExpediente'),
                    importacion_texto(d, 'fechaDerivacion')) > 0 then
      insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion)
      values (v_caso, importacion_texto(d, 'juzgado'), importacion_texto(d, 'nroExpediente'),
              importacion_fecha(importacion_texto(d, 'fechaDerivacion')));
    end if;

    update importacion_filas
       set resultado = case when f.decision = 'crear' then 'creada' else 'vinculada' end,
           paciente_id = v_paciente, caso_id = v_caso
     where id = f.id;
  end loop;

  update importaciones
     set estado = 'confirmada', confirmada_en = now(), confirmada_por = usuario,
         acepta_avance_contador = p_acepta_avance,
         filas_total = (select count(*) from importacion_filas where importacion_id = p_importacion),
         filas_ok = (select count(*) from importacion_filas where importacion_id = p_importacion
                        and resultado in ('creada', 'vinculada')),
         filas_error = (select count(*) from importacion_filas where importacion_id = p_importacion
                           and estado = 'error')
   where id = p_importacion;
  return resumen_importacion(p_importacion);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Permisos: solo el backend (que exige rol administrador)
-- ---------------------------------------------------------------------
alter table public.importacion_filas enable row level security;

revoke execute on function public.clasificar_importacion(uuid), public.confirmar_importacion(uuid, int, boolean),
  public.resumen_importacion(uuid), public.validar_fila_importacion(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.importaciones, public.importacion_filas from anon, authenticated;
    revoke execute on function public.clasificar_importacion(uuid), public.confirmar_importacion(uuid, int, boolean),
      public.resumen_importacion(uuid), public.validar_fila_importacion(jsonb) from anon, authenticated;
  end if;
end $$;

commit;

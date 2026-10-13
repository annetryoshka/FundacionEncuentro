
create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- Auditoría automática: guarda valor anterior y nuevo de cada cambio.
-- El backend debe ejecutar, dentro de cada transacción:
--   select set_config('app.usuario_id', '<uuid del perfil>', true);
create or replace function public.auditar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;

  insert into public.auditoria
    (usuario_id, accion, tabla, registro_id, datos_anteriores, datos_nuevos)
  values
    (nullif(current_setting('app.usuario_id', true), '')::uuid,
     tg_op, tg_table_name, v_id, v_old, v_new);

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Perfiles (usuarios del sistema)
--    Se enlaza con Supabase Auth
-- ---------------------------------------------------------------------
create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete restrict,
  nombre_completo text not null,
  rol             text not null
                  check (rol in ('administrador', 'terapeuta', 'marketing')),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Pacientes
-- ---------------------------------------------------------------------
create table public.pacientes (
  id               uuid primary key default gen_random_uuid(),
  nombre_completo  text not null,
  fecha_nacimiento date,
  edad_al_ingreso  int check (edad_al_ingreso is null or edad_al_ingreso >= 0),
  telefono         text,
  creado_por       uuid references public.perfiles (id),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  deleted_at       timestamptz            -- borrado lógico
);

create index idx_pacientes_nombre_trgm
  on public.pacientes using gin (nombre_completo extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 4. Casos y numeración correlativa
--    Dos secuencias independientes: derivado y voluntario.
-- ---------------------------------------------------------------------
create table public.contadores_caso (
  tipo          text primary key check (tipo in ('derivado', 'voluntario')),
  ultimo_numero int not null default 0
);

insert into public.contadores_caso (tipo) values ('derivado'), ('voluntario');

create table public.casos (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes (id) on delete restrict,
  tipo                text not null check (tipo in ('derivado', 'voluntario')),
  numero_correlativo  int  not null,
  estado              text not null default 'iniciado'
                      check (estado in ('iniciado', 'en_proceso', 'concluido')),
  fecha_ingreso       date not null default current_date,
  diagnostico_ingreso text,
  hipotesis_relacional text,
  comentarios_clinicos text,
  creado_por          uuid references public.perfiles (id),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint uq_caso_numero unique (tipo, numero_correlativo)
);

create index idx_casos_paciente on public.casos (paciente_id);
create index idx_casos_estado   on public.casos (estado);
create index idx_casos_tipo     on public.casos (tipo);

-- Asigna el correlativo automáticamente. Si se importa un caso antiguo con
-- número propio, se respeta y el contador se ajusta para no repetir.
create or replace function public.asignar_numero_caso()
returns trigger
language plpgsql
as $$
begin
  if new.numero_correlativo is null then
    update public.contadores_caso
       set ultimo_numero = ultimo_numero + 1
     where tipo = new.tipo
    returning ultimo_numero into new.numero_correlativo;
  else
    update public.contadores_caso
       set ultimo_numero = greatest(ultimo_numero, new.numero_correlativo)
     where tipo = new.tipo;
  end if;
  return new;
end;
$$;

create trigger trg_casos_numero
  before insert on public.casos
  for each row execute function public.asignar_numero_caso();

-- ---------------------------------------------------------------------
-- 5. Asignación de casos a terapeutas (autorización por caso)
-- ---------------------------------------------------------------------
create table public.asignaciones_caso (
  caso_id      uuid not null references public.casos (id) on delete cascade,
  perfil_id    uuid not null references public.perfiles (id) on delete cascade,
  asignado_por uuid references public.perfiles (id),
  asignado_en  timestamptz not null default now(),
  primary key (caso_id, perfil_id)
);

create index idx_asignaciones_perfil on public.asignaciones_caso (perfil_id);

-- ---------------------------------------------------------------------
-- 6. Información clínica del caso
-- ---------------------------------------------------------------------
create table public.contexto_judicial (
  id               uuid primary key default gen_random_uuid(),
  caso_id          uuid not null unique references public.casos (id) on delete restrict,
  juzgado          text,
  nro_expediente   text,
  fecha_derivacion date,
  observaciones    text
);

create table public.consentimientos (
  id             uuid primary key default gen_random_uuid(),
  caso_id        uuid not null references public.casos (id) on delete restrict,
  tipo           text,
  fecha          date not null default current_date,
  archivo_path   text,
  registrado_por uuid references public.perfiles (id)
);

create index idx_consentimientos_caso on public.consentimientos (caso_id);

create table public.fichas_diagnostico (
  id             uuid primary key default gen_random_uuid(),
  caso_id        uuid not null references public.casos (id) on delete restrict,
  fecha          date not null default current_date,
  contenido      jsonb not null default '{}',
  creado_por     uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index idx_fichas_dx_caso on public.fichas_diagnostico (caso_id);

create table public.fichas_seguimiento (
  id             uuid primary key default gen_random_uuid(),
  caso_id        uuid not null references public.casos (id) on delete restrict,
  nro_sesion     int  not null check (nro_sesion > 0),
  fecha          date not null default current_date,
  contenido      jsonb not null default '{}',
  creado_por     uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint uq_seguimiento_sesion unique (caso_id, nro_sesion)
);

create index idx_fichas_seg_caso on public.fichas_seguimiento (caso_id);

create table public.genogramas (
  id             uuid primary key default gen_random_uuid(),
  caso_id        uuid not null unique references public.casos (id) on delete restrict,
  datos          jsonb not null default '{}',
  actualizado_por uuid references public.perfiles (id),
  actualizado_en timestamptz not null default now()
);

create table public.tareas_terapeuticas (
  id             uuid primary key default gen_random_uuid(),
  caso_id        uuid not null references public.casos (id) on delete restrict,
  descripcion    text not null,
  fecha_asignada date not null default current_date,
  fecha_limite   date,
  completada     boolean not null default false,
  perfil_id      uuid references public.perfiles (id),   -- quién la asignó
  constraint ck_tarea_fechas check (fecha_limite is null or fecha_limite >= fecha_asignada)
);

create index idx_tareas_caso on public.tareas_terapeuticas (caso_id);

-- ---------------------------------------------------------------------
-- 7. Pagos y contabilidad (sin facturación)
-- ---------------------------------------------------------------------
create table public.pagos (
  id               uuid primary key default gen_random_uuid(),
  caso_id          uuid not null references public.casos (id) on delete restrict,
  fecha            date not null default current_date,
  monto            numeric(10,2) not null check (monto > 0),
  moneda           text not null default 'BOB' check (moneda in ('BOB', 'USD')),
  metodo           text not null check (metodo in ('qr', 'transferencia', 'efectivo')),
  concepto         text,
  comprobante_path text,
  registrado_por   uuid references public.perfiles (id),
  creado_en        timestamptz not null default now()
);

create index idx_pagos_caso  on public.pagos (caso_id);
create index idx_pagos_fecha on public.pagos (fecha);

create table public.movimientos_contables (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null default current_date,
  tipo           text not null check (tipo in ('ingreso', 'egreso')),
  monto          numeric(10,2) not null check (monto > 0),
  descripcion    text,
  categoria      text,
  pago_id        uuid references public.pagos (id) on delete restrict,
  registrado_por uuid references public.perfiles (id),
  creado_en      timestamptz not null default now()
);

create index idx_mov_fecha on public.movimientos_contables (fecha);

-- ---------------------------------------------------------------------
-- 8. Informes, exportaciones e importaciones
-- ---------------------------------------------------------------------
create table public.informes (
  id           uuid primary key default gen_random_uuid(),
  caso_id      uuid not null references public.casos (id) on delete restrict,
  tipo         text not null check (tipo in ('judicial', 'intervencion_sistemica')),
  formato      text check (formato in ('pdf', 'docx')),
  archivo_path text,
  generado_por uuid references public.perfiles (id),
  creado_en    timestamptz not null default now()
);

create index idx_informes_caso on public.informes (caso_id);

create table public.exportaciones (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfiles (id),
  tipo         text not null check (tipo in ('atlas_ti', 'pdf', 'word')),
  caso_id      uuid references public.casos (id) on delete restrict,
  parametros   jsonb not null default '{}',
  archivo_path text,
  creado_en    timestamptz not null default now()
);

create index idx_exportaciones_perfil on public.exportaciones (perfil_id);

create table public.importaciones (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references public.perfiles (id),
  archivo_nombre text,
  filas_total    int not null default 0,
  filas_ok       int not null default 0,
  filas_error    int not null default 0,
  errores        jsonb not null default '[]',
  creado_en      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. Investigación cualitativa (categorías para Atlas.ti)
-- ---------------------------------------------------------------------
create table public.categorias_investigacion (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  padre_id    uuid references public.categorias_investigacion (id) on delete set null,
  color       text,
  creado_por  uuid references public.perfiles (id),
  creado_en   timestamptz not null default now(),
  constraint uq_categoria_nombre unique nulls not distinct (padre_id, nombre)
);

create table public.caso_categorias (
  id                   uuid primary key default gen_random_uuid(),
  caso_id              uuid not null references public.casos (id) on delete restrict,
  categoria_id         uuid not null references public.categorias_investigacion (id) on delete cascade,
  ficha_diagnostico_id uuid references public.fichas_diagnostico (id) on delete cascade,
  ficha_seguimiento_id uuid references public.fichas_seguimiento (id) on delete cascade,
  fragmento            text,
  nota                 text,
  etiquetado_por       uuid references public.perfiles (id),
  creado_en            timestamptz not null default now(),
  constraint ck_una_ficha check (num_nonnulls(ficha_diagnostico_id, ficha_seguimiento_id) <= 1)
);

create index idx_caso_cat_caso      on public.caso_categorias (caso_id);
create index idx_caso_cat_categoria on public.caso_categorias (categoria_id);

-- ---------------------------------------------------------------------
-- 10. Foro interno
-- ---------------------------------------------------------------------
create table public.publicaciones_foro (
  id        uuid primary key default gen_random_uuid(),
  titulo    text not null,
  contenido text not null,
  autor_id  uuid not null references public.perfiles (id),
  creado_en timestamptz not null default now()
);

create table public.comentarios_foro (
  id            uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones_foro (id) on delete cascade,
  autor_id      uuid not null references public.perfiles (id),
  contenido     text not null,
  creado_en     timestamptz not null default now()
);

create index idx_comentarios_pub on public.comentarios_foro (publicacion_id);

-- ---------------------------------------------------------------------
-- 11. Auditoría
-- ---------------------------------------------------------------------
create table public.auditoria (
  id               bigint generated always as identity primary key,
  usuario_id       uuid references public.perfiles (id) on delete set null,
  accion           text not null,
  tabla            text not null,
  registro_id      uuid,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  ip               inet,
  creado_en        timestamptz not null default now()
);

create index idx_auditoria_tabla_registro on public.auditoria (tabla, registro_id);
create index idx_auditoria_usuario        on public.auditoria (usuario_id);
create index idx_auditoria_fecha          on public.auditoria (creado_en);

-- ---------------------------------------------------------------------
-- 12. Triggers: actualizado_en
-- ---------------------------------------------------------------------
create trigger trg_perfiles_upd   before update on public.perfiles
  for each row execute function public.set_actualizado_en();
create trigger trg_pacientes_upd  before update on public.pacientes
  for each row execute function public.set_actualizado_en();
create trigger trg_casos_upd      before update on public.casos
  for each row execute function public.set_actualizado_en();
create trigger trg_fdx_upd        before update on public.fichas_diagnostico
  for each row execute function public.set_actualizado_en();
create trigger trg_fseg_upd       before update on public.fichas_seguimiento
  for each row execute function public.set_actualizado_en();
create trigger trg_genograma_upd  before update on public.genogramas
  for each row execute function public.set_actualizado_en();

-- ---------------------------------------------------------------------
-- 13. Triggers: auditoría de tablas sensibles
-- ---------------------------------------------------------------------
create trigger trg_aud_perfiles   after insert or update or delete on public.perfiles
  for each row execute function public.auditar_cambio();
create trigger trg_aud_pacientes  after insert or update or delete on public.pacientes
  for each row execute function public.auditar_cambio();
create trigger trg_aud_casos      after insert or update or delete on public.casos
  for each row execute function public.auditar_cambio();
create trigger trg_aud_asign      after insert or update or delete on public.asignaciones_caso
  for each row execute function public.auditar_cambio();
create trigger trg_aud_judicial   after insert or update or delete on public.contexto_judicial
  for each row execute function public.auditar_cambio();
create trigger trg_aud_consent    after insert or update or delete on public.consentimientos
  for each row execute function public.auditar_cambio();
create trigger trg_aud_fdx        after insert or update or delete on public.fichas_diagnostico
  for each row execute function public.auditar_cambio();
create trigger trg_aud_fseg       after insert or update or delete on public.fichas_seguimiento
  for each row execute function public.auditar_cambio();
create trigger trg_aud_pagos      after insert or update or delete on public.pagos
  for each row execute function public.auditar_cambio();
create trigger trg_aud_mov        after insert or update or delete on public.movimientos_contables
  for each row execute function public.auditar_cambio();
create trigger trg_aud_informes   after insert or update or delete on public.informes
  for each row execute function public.auditar_cambio();

-- ---------------------------------------------------------------------
-- 14. Vistas (security_invoker = respetan RLS; excluyen borrados lógicos)
-- ---------------------------------------------------------------------
create view public.v_posibles_duplicados
with (security_invoker = true) as
select a.id as paciente_a,
       b.id as paciente_b,
       a.nombre_completo as nombre_a,
       b.nombre_completo as nombre_b,
       extensions.similarity(a.nombre_completo, b.nombre_completo) as similitud
from public.pacientes a
join public.pacientes b on a.id < b.id
where a.deleted_at is null
  and b.deleted_at is null
  and extensions.similarity(a.nombre_completo, b.nombre_completo) > 0.6;

create view public.v_dashboard_casos
with (security_invoker = true) as
select tipo, estado, count(*) as total
from public.casos
where deleted_at is null
group by tipo, estado;

create view public.v_casos_por_mes
with (security_invoker = true) as
select date_trunc('month', fecha_ingreso)::date as mes, tipo, count(*) as total
from public.casos
where deleted_at is null
group by 1, 2;

create view public.v_ingresos_por_mes
with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
       metodo,
       count(*) as cantidad_pagos,
       sum(monto) as total
from public.pagos
group by 1, 2;


do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;


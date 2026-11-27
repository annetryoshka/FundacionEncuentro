-- FE-173: gastos de funcionamiento de la Fundación (contrato FE-172, HU5).
-- Reutiliza movimientos_contables con tipo = 'egreso'. Un gasto se corrige o se anula; no se elimina.
-- Solo administración registra, corrige, anula y consulta gastos. Los ingresos (tipo = 'ingreso') no cambian.
begin;

-- numeric(10,2) redondea un tercer decimal sin avisar: se cambia a numeric con un check (como pagos en 010).
-- La fecha la envía la API en hora de Bolivia: current_date usa UTC en Supabase.
alter table public.movimientos_contables
  alter column monto type numeric,
  alter column fecha drop default,
  add column actualizado_en   timestamptz not null default now(),
  add column actualizado_por  uuid references public.perfiles (id),
  add column anulado_en       timestamptz,
  add column anulado_por      uuid references public.perfiles (id),
  add column motivo_anulacion text,
  add constraint ck_mov_monto_centavos check (monto = round(monto, 2) and monto <= 99999999.99),
  add constraint ck_gasto_fecha check (tipo <> 'egreso' or fecha >= date '2000-01-01'),
  add constraint ck_gasto_categoria check (
    tipo <> 'egreso' or (categoria is not null and categoria in ('internet', 'electricidad', 'alquiler', 'otros'))),
  add constraint ck_gasto_sin_pago check (tipo <> 'egreso' or pago_id is null),
  add constraint ck_gasto_descripcion check (
    tipo <> 'egreso' or descripcion is null or (btrim(descripcion) <> '' and char_length(descripcion) <= 200)),
  add constraint ck_gasto_otros check (tipo <> 'egreso' or categoria <> 'otros' or descripcion is not null),
  add constraint ck_mov_anulacion check (
    (anulado_en is null) = (anulado_por is null)
    and (motivo_anulacion is null
         or (anulado_en is not null and btrim(motivo_anulacion) <> '' and char_length(motivo_anulacion) <= 200)));

comment on column public.movimientos_contables.categoria is
  'Gastos (egreso): internet, electricidad, alquiler u otros (otros exige descripción).';
comment on column public.movimientos_contables.anulado_en is
  'Gasto anulado: se conserva y deja de sumar. Lo pone anular_gasto().';

create index idx_gastos_fecha on public.movimientos_contables (fecha) where tipo = 'egreso';

-- Administración activa (app.usuario_id). Sin usuario, otro rol o cuenta inactiva → 42501.
create or replace function public.verificar_admin_gastos()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
begin
  if usuario is null then
    raise exception 'Falta app.usuario_id' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from perfiles where id = usuario and activo and rol = 'administrador') then
    raise exception 'Solo administración gestiona los gastos' using errcode = 'insufficient_privilege';
  end if;
  return usuario;
end;
$$;

-- Permisos, autoría, fecha no futura, monto exacto y gasto anulado inmutable.
create or replace function public.controlar_gasto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  usuario uuid;
  hoy     date := (now() at time zone 'America/La_Paz')::date;
begin
  if tg_op = 'DELETE' then
    if old.tipo = 'egreso' then
      raise exception 'Un gasto no se elimina: se anula' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.tipo is distinct from old.tipo then
    raise exception 'El tipo del movimiento no cambia' using errcode = 'check_violation';
  end if;
  if new.tipo is distinct from 'egreso' then
    return new;
  end if;

  usuario := verificar_admin_gastos();
  if new.monto <> round(new.monto, 2) then
    raise exception 'El monto admite hasta dos decimales' using errcode = 'check_violation';
  end if;
  new.monto := round(new.monto, 2);

  if tg_op = 'INSERT' then
    if new.fecha > hoy then
      raise exception 'La fecha del gasto no puede ser futura' using errcode = 'check_violation';
    end if;
    new.registrado_por := usuario;
    new.creado_en := now();
    new.anulado_en := null;
    new.anulado_por := null;
    new.motivo_anulacion := null;
  else
    if old.anulado_en is not null then
      raise exception 'Un gasto anulado no se modifica' using errcode = 'check_violation';
    end if;
    new.registrado_por := old.registrado_por;
    new.creado_en := old.creado_en;
    if new.anulado_en is not null then
      if (new.categoria, new.fecha, new.monto, new.descripcion)
         is distinct from (old.categoria, old.fecha, old.monto, old.descripcion) then
        raise exception 'Anular no cambia los datos del gasto' using errcode = 'check_violation';
      end if;
      new.anulado_en := now();
      new.anulado_por := usuario;
    elsif new.fecha is distinct from old.fecha and new.fecha > hoy then
      raise exception 'La fecha del gasto no puede ser futura' using errcode = 'check_violation';
    end if;
  end if;
  new.actualizado_por := usuario;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_controlar_gasto
  before insert or update or delete on public.movimientos_contables
  for each row execute function public.controlar_gasto();

-- 'AAAA-MM' → primer día del mes; null → mes actual en Bolivia. Otro formato → 22023.
create or replace function public.inicio_mes_gastos(p_mes text)
returns date
language plpgsql
stable
as $$
begin
  if p_mes is null then
    return date_trunc('month', now() at time zone 'America/La_Paz')::date;
  end if;
  if p_mes !~ '^(20[0-9]{2})-(0[1-9]|1[0-2])$' then
    raise exception 'Mes inválido: use AAAA-MM' using errcode = 'invalid_parameter_value';
  end if;
  return (p_mes || '-01')::date;
end;
$$;

-- Forma del gasto para la API (claves camelCase, monto como texto decimal).
create or replace function public.gasto_json(g public.movimientos_contables)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', g.id,
    'fecha', g.fecha,
    'categoria', g.categoria,
    'descripcion', g.descripcion,
    'monto', round(g.monto, 2)::text,
    'anulado', g.anulado_en is not null,
    'anuladoEn', g.anulado_en,
    'anuladoPor', g.anulado_por,
    'motivoAnulacion', g.motivo_anulacion,
    'registradoPor', g.registrado_por,
    'creadoEn', g.creado_en,
    'actualizadoPor', g.actualizado_por,
    'actualizadoEn', g.actualizado_en);
$$;

-- Consulta mensual: lista (también anulados, marcados), total del mes y totales por categoría.
-- Los totales suman solo gastos vigentes; las cuatro categorías siempre aparecen.
create or replace function public.consultar_gastos_mes(p_mes text default null)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  inicio date;
  fin    date;
begin
  perform verificar_admin_gastos();
  inicio := inicio_mes_gastos(p_mes);
  fin := (inicio + interval '1 month')::date;
  return (
    with del_mes as (
      select m as fila, m.id, m.fecha, m.creado_en, m.categoria, m.monto, m.anulado_en
        from movimientos_contables m
       where m.tipo = 'egreso' and m.fecha >= inicio and m.fecha < fin
    ), vigentes as (
      select d.* from del_mes d where d.anulado_en is null
    )
    select jsonb_build_object(
      'mes', to_char(inicio, 'YYYY-MM'),
      'gastos', coalesce((select jsonb_agg(gasto_json(d.fila) order by d.fecha, d.creado_en, d.id) from del_mes d), '[]'::jsonb),
      'totalMes', (select round(coalesce(sum(v.monto), 0), 2)::text from vigentes v),
      'cantidadVigentes', (select count(*) from vigentes),
      'cantidadAnulados', (select count(*) from del_mes d where d.anulado_en is not null),
      'totalesPorCategoria', (
        select jsonb_agg(jsonb_build_object(
                 'categoria', c.categoria,
                 'cantidad', (select count(*) from vigentes v where v.categoria = c.categoria),
                 'total', (select round(coalesce(sum(v.monto), 0), 2)::text from vigentes v where v.categoria = c.categoria))
               order by c.orden)
          from unnest(array['internet', 'electricidad', 'alquiler', 'otros']) with ordinality as c(categoria, orden))));
end;
$$;

-- Anula un gasto vigente. Repetirlo devuelve el mismo gasto sin volver a escribir. Inexistente o no es gasto → P0002.
create or replace function public.anular_gasto(p_gasto uuid, p_motivo text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  g movimientos_contables%rowtype;
begin
  perform verificar_admin_gastos();
  select * into g from movimientos_contables where id = p_gasto and tipo = 'egreso' for update;
  if not found then
    raise exception 'Gasto no encontrado' using errcode = 'no_data_found';
  end if;
  if g.anulado_en is null then
    update movimientos_contables
       set anulado_en = now(), motivo_anulacion = nullif(btrim(p_motivo), '')
     where id = p_gasto
     returning * into g;
  end if;
  return gasto_json(g);
end;
$$;

-- Solo el backend accede: nada directo desde la API de Supabase.
revoke execute on function
  public.verificar_admin_gastos(),
  public.inicio_mes_gastos(text),
  public.gasto_json(public.movimientos_contables),
  public.consultar_gastos_mes(text),
  public.anular_gasto(uuid, text)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.movimientos_contables from anon, authenticated;
    revoke execute on function
      public.verificar_admin_gastos(),
      public.inicio_mes_gastos(text),
      public.gasto_json(public.movimientos_contables),
      public.consultar_gastos_mes(text),
      public.anular_gasto(uuid, text)
      from anon, authenticated;
  end if;
end $$;

commit;

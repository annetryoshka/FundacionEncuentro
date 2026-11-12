-- FE-89: cada pago pertenece a una sesión del mismo caso, un pago por sesión,
-- y el monto se rechaza si trae más de dos decimales en lugar de redondearse.
begin;

-- numeric(10,2) redondea 75.555 a 75.56 sin avisar. Se cambia a numeric con un check.
-- La vista depende de la columna: se borra y se vuelve a crear igual.
drop view public.v_ingresos_por_mes;

alter table public.pagos
  alter column monto type numeric,
  alter column fecha drop default,            -- la fecha de pago la envía la API
  add column sesion_id  uuid not null,
  add column referencia text,
  add constraint ck_pagos_monto_centavos check (monto = round(monto, 2) and monto < 100000000),
  add constraint fk_pagos_sesion foreign key (sesion_id, caso_id)
    references public.fichas_seguimiento (id, caso_id) on delete restrict,
  -- Un pago por sesión: repetir la misma solicitud no duplica el cobro.
  add constraint uq_pagos_sesion unique (sesion_id);

comment on column public.pagos.fecha is 'Fecha de pago. Es la que usa la conciliación.';
comment on column public.pagos.referencia is 'Referencia opcional del QR o la transferencia.';

create view public.v_ingresos_por_mes
with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
       metodo,
       count(*) as cantidad_pagos,
       sum(monto) as total
from public.pagos
group by 1, 2;

commit;

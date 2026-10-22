-- FE-37: una sola terapeuta responsable por caso.

CREATE UNIQUE INDEX IF NOT EXISTS uq_asignaciones_caso_responsable
ON public.asignaciones_caso (caso_id);
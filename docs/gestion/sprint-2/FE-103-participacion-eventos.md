# FE-103 — Participación en eventos del sprint

Tarea padre: FE-58 · Responsable: Jorge Calizaya (Frontend Dev) · Estimación: 4 h-persona

| Evento | Horas | Fecha | Asistió | Acuerdos / acciones |
| --- | --- | --- | --- | --- |
| Planificación | 1.0 | 2026-10-26 | Sí | Sprint 2 planificado. Subtareas de frontend: FE-47, 62, 67, 72, 77, 82, 87 y 92. |
| Coordinación diaria (acumulado, 2 semanas) | 2.0 | Durante el sprint | Sí, sobre todo por el grupo de WhatsApp | Avances, bloqueos y pedidos de contrato comunicados por mensaje. |
| Review | 0.5 | 2026-11-11 (programada) | Por confirmar tras el evento | |
| Retrospectiva | 0.5 | 2026-11-11 (programada) | Por confirmar tras el evento | |
| **Total** | **4.0** | | | |

Fechas de los eventos tomadas del registro de Gemina (FE-106). Las filas de review y retrospectiva
se actualizan a "Sí" cuando ocurran.

## Disponibilidad

12 h por semana (supuesto de FE-58). Cambios de disponibilidad: ninguno informado.

## Avance del rol al corte (2026-11-10)

| Subtarea | HU | Estado | Depende de |
| --- | --- | --- | --- |
| FE-47 Controles y filtros | FE-14 | Terminada. PR `feature/FE-47-filtros-y-controles` (commit `3791325`), evidencia en `docs/pruebas/FE-47-filtros-y-controles.md` | FE-48 (listo) |
| FE-62 Origen y consentimiento | FE-50 | Puede avanzar en modo simulado | API FE-63 (en curso) |
| FE-67 Formulario de diagnóstico | FE-13 | Puede avanzar en modo simulado | API FE-68 (en curso) |
| FE-72 Sesiones | FE-55 | Bloqueada | API FE-73 (por hacer) |
| FE-77 Tareas | FE-56 | Bloqueada | FE-72 y API FE-78 (por hacer) |
| FE-82 Historial | FE-57 | Bloqueada | API FE-83 (por hacer) y las demás HU |
| FE-87 Pagos | FE-7 | Bloqueada | API FE-88 (por hacer) |
| FE-92 Dashboard | FE-6 | Bloqueada | API FE-93 (por hacer) |

Las migraciones de BD de estas HU (005–011, FE-60 a FE-94) ya están en ramas, pero todavía no
hay endpoints, así que ninguna interfaz nueva se puede integrar con el backend real.

## Acuerdos y acciones

| # | Evento | Acuerdo / acción | Responsable | Estado |
| --- | --- | --- | --- | --- |
| 1 | Daily | Revisar y fusionar el PR de FE-47 antes de la review | Equipo (revisor del PR) | Abierta |
| 2 | Daily | Aplicar `db/migrations/004_clasificacion_casos.sql` en Supabase; sin ella el listado de carpetas falla | Alejandro (BD) | Abierta |
| 3 | Daily | Compartir los contratos de API de FE-63 (constancia) y FE-68 (diagnóstico) para integrar FE-62 y FE-67 | Adriana (backend) | Abierta |
| 4 | Daily | Avanzar FE-62 y FE-67 en modo simulado mientras llegan los contratos | Jorge | Abierta |
| 5 | Review y retro | Registrar acuerdos y acciones el 2026-11-11 | Jorge | Pendiente |

Bloqueos del sprint: ver FE-98 (registro de Gemina). Estas 4 h son horas-persona y no incluyen
implementación de HU.

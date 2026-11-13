# FE-103 — Participación en eventos del sprint

Tarea padre: FE-58 · Responsable: Jorge Calizaya (Frontend Dev) · Estimación: 4 h-persona

| Evento | Horas | Fecha | Asistió | Acuerdos / acciones |
| --- | --- | --- | --- | --- |
| Planificación | 1.0 | 2026-10-26 | Sí | Sprint 2 planificado. Subtareas de frontend: FE-47, 62, 67, 72, 77, 82, 87 y 92. |
| Coordinación diaria (acumulado, 2 semanas) | 2.0 | Durante el sprint | Sí, sobre todo por el grupo de WhatsApp | Avances, bloqueos y pedidos de contrato comunicados por mensaje. |
| Review | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía |
| Retrospectiva | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía |
| **Total** | **4.0** | | | |

Fecha de la planificación tomada del registro de Gemina (FE-106). Según Andrea (2026-11-13), la review y la
retrospectiva siguen pendientes y su fecha se coordinará con el grupo; estas filas se actualizan cuando ocurran.

## Disponibilidad

12 h por semana (supuesto de FE-58). Cambios de disponibilidad: ninguno informado.

## Avance del rol al corte (2026-11-13)

| Subtarea | HU | Estado | Evidencia |
| --- | --- | --- | --- |
| FE-47 Controles y filtros | FE-14 | Terminada | PR #25 · `docs/pruebas/FE-47-filtros-y-controles.md` |
| FE-62 Origen y consentimiento | FE-50 | Terminada, incluye el contexto judicial (corrección de QA, commit `bbc4e5a`) | Rama `feature/FE-72-FE-92-expediente-front` · `docs/pruebas/sprint-2-expediente-frontend.md` |
| FE-67 Formulario de diagnóstico | FE-13 | Terminada | Misma rama y evidencia |
| FE-72 Sesiones | FE-55 | Terminada | Misma rama y evidencia |
| FE-77 Tareas | FE-56 | Terminada | Misma rama y evidencia |
| FE-82 Historial | FE-57 | Terminada | Misma rama y evidencia |
| FE-87 Pagos | FE-7 | Terminada | Misma rama y evidencia |
| FE-92 Dashboard | FE-6 | Terminada | Misma rama y evidencia |

Las interfaces de FE-62 a FE-92 se integraron el 2026-11-12 con los endpoints de los PR #26–#33 del backend y se
verificaron contra el backend real; el 2026-11-13 se conectó el contexto judicial de FE-62 con la corrección 8c77aa3
de FE-63 (58/58 comprobaciones; Vitest 156/156).

## Acuerdos y acciones

| # | Evento | Acuerdo / acción | Responsable | Estado |
| --- | --- | --- | --- | --- |
| 1 | Daily | Revisar y fusionar el PR de FE-47 (#25) | Equipo (revisor del PR) | Abierta |
| 2 | Daily | Aplicar en Supabase las migraciones 004 en adelante; sin la 004 el listado de carpetas falla | Alejandro (BD) | Abierta |
| 3 | Daily | Compartir los contratos de API de FE-63 y FE-68 para integrar FE-62 y FE-67 | Adriana (backend) | Cumplida: APIs entregadas en los PR #26–#33 |
| 4 | Daily | Avanzar FE-62 y FE-67 en modo simulado mientras llegan los contratos | Jorge | Cumplida: se integraron directamente con la API real |
| 5 | Review y retro | Registrar acuerdos y acciones de la review y la retrospectiva | Jorge | Pendiente: fecha por confirmar con el grupo |
| 6 | Daily | Endpoint para registrar el contexto judicial (juzgado, expediente, fecha de derivación) que pide FE-61 | Adriana (backend) | Cumplida: PR #26, commit 8c77aa3; conectado en el front (PR #35) |
| 7 | Daily | Fusionar en orden #25, #24, #26–#33 y el PR del expediente; acordar la numeración de migraciones 005–008 entre BD y backend | Equipo | Abierta |

Bloqueos del sprint: ver FE-98 (registro de Gemina). Estas 4 h son horas-persona y no incluyen
implementación de HU.

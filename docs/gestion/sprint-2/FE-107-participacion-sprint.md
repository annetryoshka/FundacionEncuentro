# FE-107 — Participación en planificación, coordinación y revisión del sprint

Tarea padre: FE-58 · Responsable: Emilia Crespo (QA Tester y Backend Dev) · Estimación: 4 h-persona

| Evento | Horas | Fecha | Asistió | Acuerdos / acciones |
| --- | --- | --- | --- | --- |
| Planificación | 1.0 | 2026-10-26 | Sí | Sprint 2 planificado. Subtareas de QA asignadas: FE-49, 65, 70, 75, 80, 85, 90 y 95. |
| Coordinación diaria (acumulado, 2 semanas) | 2.0 | Durante el sprint | Sí, por el grupo de WhatsApp y seguimiento en Jira | Avances y bloqueos comunicados por mensaje; pruebas reportadas a Adriana y Alejandro. |
| Review | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| Retrospectiva | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| **Total** | **4.0** | | | |

Fecha de la planificación tomada del registro de Gemina (FE-106). Según Andrea (2026-11-13), la review y la
retrospectiva siguen pendientes y su fecha se coordinará con el grupo; estas filas se actualizan cuando ocurran.

## Disponibilidad

12 h por semana (supuesto de FE-58). Cambios de disponibilidad: ninguno informado.

## Avance del rol al corte (2026-11-13)

| Subtarea | HU | Estado | Evidencia |
| --- | --- | --- | --- |
| FE-49 Verificación clasificación y filtros | FE-14 | Terminada | `docs/pruebas/FE-49-verificacion-clasificacion-filtros.md` (rama `feature/FE-49-verificacion-clasificacion`) |
| FE-65 Verificación constancia de consentimiento | FE-50 | Terminada | `docs/pruebas/FE-65-verificacion-constancia.md` (rama `feature/FE-63-constancia-consentimiento`) |
| FE-70 Verificación diagnóstico | FE-13 | Terminada | `docs/pruebas/FE-70-verificacion-diagnostico.md` (rama `feature/FE-68-api-diagnostico`) |
| FE-75 Verificación sesiones | FE-55 | Terminada | `docs/pruebas/FE-75-verificacion-sesiones.md` (rama `feature/FE-73-api-sesiones-seguimiento`) |
| FE-80 Verificación tareas terapéuticas | FE-56 | Terminada | `docs/pruebas/FE-80-verificacion-tareas.md` (rama `feature/FE-78-api-tareas-terapeuticas`) |
| FE-85 Verificación historial clínico | FE-57 | Terminada (FE-85-D1 corregido en `ebb39a8`; 8/8 en base nueva) | `docs/pruebas/FE-85-verificacion-historial.md` (rama `feature/FE-83-api-historial-clinico`) |
| FE-90 Verificación pagos | FE-7 | Terminada | `docs/pruebas/FE-90-verificacion-pagos.md` (rama `feature/FE-88-api-pagos-sesiones`) |
| FE-95 Verificación indicadores | FE-6 | Terminada (FE-95-D1 corregido en `7e2c490`; 11/11 en base nueva) | `docs/pruebas/FE-95-verificacion-indicadores.md` (rama `feature/FE-93-api-indicadores`) |

Las 8 suites de QA se ejecutaron contra el backend real con PostgreSQL local y datos ficticios de cada especificación.
Todas las HU del Sprint 2 tienen evidencia de prueba positiva/negativa y de permisos.

| Defecto | Severidad | Descripción | Estado |
| --- | --- | --- | --- |
| FE-65-D1 | Media | La consulta de la constancia devolvía la fecha de consentimiento con hora y zona | Corregido (`8c77aa3`) y reverificado: 9/9 |
| FE-85-D1 | Alta | El historial respondía 500: a FE-83 le faltaba la migración 005 (`constancias_atencion`) | Corregido (`ebb39a8`) y reverificado contra base nueva: 8/8 |
| FE-95-D1 | Baja | El total de pagos sin movimientos llegaba como `"0"` en vez de `"0.00"` | Corregido (`7e2c490`) y reverificado contra base nueva: 11/11 |

No quedan defectos abiertos de QA en el sprint.

## Acuerdos y acciones

| # | Evento | Acuerdo / acción | Responsable | Estado |
| --- | --- | --- | --- | --- |
| 1 | Planificación | Emilia cubre QA de las 8 HU del sprint | Emilia | Cumplida: las 8 evidencias están en sus ramas |
| 2 | Daily | Coordinar con Adriana el contrato de cada API antes de escribir la suite | Emilia con Adriana | Cumplida en cada HU |
| 3 | Daily | Reportar defectos y `todo` con severidad, pasos y corrección sugerida en el documento de evidencia | Emilia | Cumplida: FE-65-D1, FE-85-D1 y FE-95-D1 documentados |
| 4 | Daily | Aplicar en Supabase las migraciones 004 en adelante (bloqueo #2 de FE-98) | Alejandro (BD) | Abierta |
| 5 | Daily | Corregir FE-95-D1 con `round(pagos_recibidos, 2)::text` en `indicadores.service.ts` | Adriana (backend) | Cumplida (`7e2c490`), reverificada por Emilia |
| 7 | Daily | Incorporar solo la migración 005 en FE-83 (FE-85-D1) y repetir la suite contra una base nueva | Adriana / Emilia | Cumplida (`ebb39a8`), 8/8 |
| 8 | Daily | Integrar primero la cadena de BD (FE-60 → FE-84) y después actualizar #26 y #32; verificado en local sin conflictos | Alejandro / Adriana | Abierta |
| 9 | Daily | Las verificaciones de QA se integran en la rama de la HU y no en ramas aparte contra `main` | Emilia | Cumplida: PR #45, #46, #48 y #31 redirigidos |
| 6 | Review y retro | Registrar acuerdos y acciones de la review y la retrospectiva | Emilia | Pendiente: fecha por confirmar con el grupo |

Bloqueos del sprint: ver [FE-98](FE-98-registro-bloqueos.md). Estas 4 h son horas-persona y no incluyen
implementación de HU ni tiempo de ejecución de las suites.

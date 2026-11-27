# FE-207 — Participación de Jorge en los eventos del Sprint 3

Tarea padre: coordinar, integrar y aceptar la entrega funcional del Sprint 3 · Responsable: Jorge Calizaya (frontend y QA) · Estimación: 4 h-persona

Este registro separa lo **planificado** de lo **realizado**. Las filas pendientes se completan con la fecha real cuando ocurre cada evento.

| Evento | Horas planificadas | Fecha | Asistió | Acuerdos / acciones |
| --- | --- | --- | --- | --- |
| Planificación | 1.0 | Por completar (fecha real) | Por completar | Subtareas de frontend del Sprint 3: FE-127, 132, 138, 144, 149, 154, 160, 165, 170, 175, 187, 190 y 199. |
| Coordinación (acumulado del sprint) | 2.0 | Durante el sprint | Sí, por el grupo y en los PR | Ver «Coordinación registrada». |
| Review | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| Retrospectiva | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| **Total** | **4.0** | | | |

La review y la retrospectiva siguen pendientes: Andrea pidió dejarlas como «pendientes, fecha por confirmar» hasta coordinarlas con el grupo.

## Coordinación registrada

| Fecha | Con quién | Tema | Resultado |
| --- | --- | --- | --- |
| 2026-11-26 | Adriana | Integración del front con las API del Sprint 3: falta un listado de informes, los recursos de difusión públicos marcados `@Public`, CORS sin `exposedHeaders: ['Content-Disposition']` y una huella de investigación que cambió una vez. | Comunicado; ver `docs/pruebas/sprint-3-frontend.md` §4. |
| 2026-11-26 | Andrea y Alejandro | El CSV de ejemplo de FE-162 tiene 14 columnas y la plantilla de la migración 017, 18. | Comunicado. |
| 2026-11-26 | Gemina | Ramas FE-137 y FE-186 sin PR; se integraron en el PR #89. | PR #89 fusionado en main. |
| 2026-11-27 | Emilia | El PR #95 (API de artículos, FE-184) es necesario para FE-187 y choca con main en `backend/src/app.module.ts` (GastosModule). | Comunicado; FE-187 queda listo a la espera de ese merge. |

## Avance del rol al corte (2026-11-27)

| Subtarea | Estado | Evidencia |
| --- | --- | --- |
| FE-127, 132, 138, 144, 149, 154, 160, 165 y 170 | Terminadas | PR #89 · `docs/pruebas/sprint-3-frontend.md` |
| FE-175 Gastos del mes | Terminada | `docs/pruebas/sprint-3-frontend.md` §5 |
| FE-190 Constancia y pagos | Terminada con las tres reglas ratificadas (FE-188); las cinco restantes pasan a FE-211 (Sprint 4) | Misma evidencia |
| FE-187 Artículos de investigación | Terminada en el front; depende del PR #95 | Misma evidencia |
| FE-199 Componentes de apoyo | Terminada: residencia, tarjetas públicas e investigaciones de Gemina integradas | Misma evidencia |
| FE-207 Participación | Abierta hasta la review y la retrospectiva | Este documento |

## Disponibilidad

Sin cambios de disponibilidad informados.

Estas horas se cuentan solo en esta subtarea y no se suman de nuevo en la tarea padre.

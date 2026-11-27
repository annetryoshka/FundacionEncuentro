# FE-204 — Índice de evidencias del voluntariado

Tarea padre: FE-119 · Responsable: Gemina Ponce · Estimación: 2 h-persona

Repositorio (público): https://github.com/annetryoshka/FundacionEncuentro · Jira: proyecto FE

Los enlaces apuntan a `main` y los commits se pueden abrir como `https://github.com/annetryoshka/FundacionEncuentro/commit/<hash>`. Cada fila usa solo documentos y commits que existen en el repositorio al 2026-11-23. Las horas ejecutadas por persona **no** están aquí: las confirma cada integrante para su informe.

## Cómo se relaciona con los informes

| Informe | Período | Plazo | Estado |
| --- | --- | --- | --- |
| Informe 1 (Sprint 1) | 2026-10-06 a 2026-10-22 | Miércoles 2026-11-25 | Sin documento en el repositorio |
| Informe 2 (Sprint 2) | Desde 2026-10-26 | Objetivo viernes 2026-11-27; máximo sábado 2026-11-28 (hora de La Paz) | Borrador de contenido en [Informe_Avance_Sprint_2_borrador.md](informes/Informe_Avance_Sprint_2_borrador.md) |
| Informe 3 (Sprint 3) | Por fijar | Día de cierre del Sprint 3 | Pendiente |

## Sprint 1 (6 al 22 de octubre de 2026)

| Tema | Evidencia | Referencia |
| --- | --- | --- |
| API NestJS y conexión a Supabase | PR #3 | commit `e1bbb00` |
| Autenticación y cierre de sesión | PR #4 y #5 | commits `26d7afa`, `392ad13` |
| Base del frontend, login y sesión | PR #6 | commit `336d647` |
| Usuarios y permisos por rol | PR #7, #12 | commits `546ce0b`, `7f2dafe` |
| Registro integral de paciente y carpeta | PR #8 | commit `ad7db0b` |
| Carpetas existentes con numeración; edición de paciente | PR #10 | commits `08b786d`, `b918227` |
| Autorización clínica y asignación exclusiva de terapeutas | PR #13 | commit `a959f4b` |
| Actualización de datos del paciente | PR #16 y #17 | commits `191bb72`, `61bd318` |
| Datos de demostración y documentación Swagger | PR #14 y #15 | commits `1102d1e`, `2a5ba31` |
| Verificaciones | [FE-27](../pruebas/FE-27-verificacion-cierre.md), [FE-30](../pruebas/FE-30-verificacion-cuentas-roles.md), [FE-38](../pruebas/FE-38-asignacion-restricciones.md), [FE-41](../pruebas/FE-41-busqueda-permisos.md), [FE-46 demostración integrada](../pruebas/FE-46-demostracion-integrada.md) | |

## Sprint 2 (desde el 26 de octubre de 2026)

| Tema | Evidencia | Referencia |
| --- | --- | --- |
| Planificación y gestión | [FE-98](../gestion/sprint-2/FE-98-registro-bloqueos.md), [FE-99](../gestion/sprint-2/FE-99-integraciones-y-entrega.md), [FE-100](../gestion/sprint-2/FE-100-tablero-y-reporte.md), [FE-101](../gestion/sprint-2/FE-101-review-y-cierre.md), [FE-106](../gestion/sprint-2/FE-106-participacion-eventos.md), [FE-107](../gestion/sprint-2/FE-107-participacion-sprint.md) | merges `20f688c`, `a3a46de`, `d0b9d58`, `59c91ae`, `c57ba94`, `1002f73` |
| Especificaciones de las 8 HU | `docs/srs/sprint-2/` ([FE-59](../srs/sprint-2/FE-59-clasificacion-y-filtros.md), [FE-61](../srs/sprint-2/FE-61-contexto-y-constancia.md), [FE-66](../srs/sprint-2/FE-66-ficha-de-diagnostico.md), [FE-71](../srs/sprint-2/FE-71-ficha-y-recorrido-de-sesion.md), [FE-76](../srs/sprint-2/FE-76-tareas-terapeuticas.md), [FE-81](../srs/sprint-2/FE-81-secciones-y-permisos-del-historial.md), [FE-86](../srs/sprint-2/FE-86-reglas-de-pago-por-sesion.md), [FE-91](../srs/sprint-2/FE-91-indicadores-y-conciliacion.md)) | |
| Guion y datos de aceptación | [FE-96](../pruebas/FE-96-aceptacion-sprint-2.md), [datos ficticios](../pruebas/FE-96-datos-ficticios.json) | commit `4c50218` |
| FE-14 Clasificación y filtros | Backend: PR #18, commit `41510fe`; verificación [FE-49](../pruebas/FE-49-verificacion-clasificacion-filtros.md), 14 pruebas aprobadas | merge `a3bc05c` |
| FE-50 Constancia de consentimiento | Verificación [FE-65](../pruebas/FE-65-verificacion-constancia.md) | merge `8ac78a3` |
| FE-13 Ficha de diagnóstico | Verificación [FE-70](../pruebas/FE-70-verificacion-diagnostico.md), 8 pruebas aprobadas | merge `3b1706f` |
| FE-55 Sesiones y seguimiento | Verificación [FE-75](../pruebas/FE-75-verificacion-sesiones.md), 10 pruebas aprobadas | merge `13451a1` |
| FE-56 Tareas terapéuticas | Verificación [FE-80](../pruebas/FE-80-verificacion-tareas.md), 11 pruebas aprobadas | merge `4fa403a` |
| FE-57 Historial clínico | Verificación [FE-85](../pruebas/FE-85-verificacion-historial.md), 8 de 8 tras el fix | merge `0776b51` |
| FE-7 Pagos por sesión | Verificación [FE-90](../pruebas/FE-90-verificacion-pagos.md), 12 pruebas aprobadas | merge `258e9fd` |
| FE-6 Indicadores | Verificación [FE-95](../pruebas/FE-95-verificacion-indicadores.md), 11 de 11 tras el fix | merges `44763be`, `313373d` |
| Interfaz del expediente clínico | [sprint-2-expediente-frontend.md](../pruebas/sprint-2-expediente-frontend.md) | merge `d8ea18f` |
| Reporte de pruebas | [Reporte_Pruebas_FundacionEncuentro.docx](../pruebas/Reporte_Pruebas_FundacionEncuentro.docx) | commit `37ed16b` |

## Sprint 3

| Tema | Evidencia | Estado |
| --- | --- | --- |
| Gestión | [bloqueos-e-integracion.md](../gestion/sprint-3/bloqueos-e-integracion.md), [avance-y-capacidad.md](../gestion/sprint-3/avance-y-capacidad.md), [participacion-gemina.md](../gestion/sprint-3/participacion-gemina.md) | Creados el 2026-11-23 |
| Historias de usuario y pruebas | Por agregar al integrarse | Pendiente |

## Constancias de entrega

| Informe | Fecha y hora de entrega | Canal | Destinatario | Constancia |
| --- | --- | --- | --- | --- |
| 1 | | | | Pendiente |
| 2 | | | | Pendiente |
| 3 | | | | Pendiente |

## Comprobación de acceso

- [x] El repositorio figura como público en GitHub.
- [ ] Confirmar con el destinatario que puede abrir los enlaces y el canal institucional.
- [ ] Revisar los enlaces de este índice antes de cada entrega.

## Actualización del Sprint 3 (corte 2026-11-26, `main` en `c806c34`)

| Tema | Evidencia |
| --- | --- |
| Acta técnica de aceptación por HU | [aceptacion-integrada.md](../pruebas/sprint-3/aceptacion-integrada.md): señala faltantes en gastos, artículos públicos y genograma en exportaciones |
| Integración | [integracion-2026-11-26.md](../pruebas/sprint-3/integracion-2026-11-26.md) |
| Ficha familiar y evaluación inicial | [ficha-familiar.md](../pruebas/sprint-3/ficha-familiar.md), [FE-124](../pruebas/sprint-3/FE-124-resumen-familiar.md), [evaluacion-inicial.md](../pruebas/sprint-3/evaluacion-inicial.md) |
| Portal institucional | [FE-146](../pruebas/sprint-3/FE-146-portal-institucional.md), [registro de autorización](../contenido/difusion/registro-autorizacion.md) |
| Cierre de sesión | [FE-194](../pruebas/sprint-3/FE-194-aceptacion-logout.md), [logout con Supabase](../pruebas/sprint-3/logout-supabase.md) |
| Datos y recuperación | [FE-197](../pruebas/FE-197-migracion-recuperacion.md) y verificaciones `FE-125`, `FE-130`, `FE-135`, `FE-142`, `FE-152`, `FE-158`, `FE-163`, `FE-168` en `docs/pruebas/` |
| Interfaz del Sprint 3 | [sprint-3-frontend.md](../pruebas/sprint-3-frontend.md) |

La aceptación técnica no equivale a una validación de la Fundación.

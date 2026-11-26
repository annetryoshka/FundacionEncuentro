# FE-99 — Integraciones y control de entrega

Tarea padre: FE-58 · Responsable: Gemina Ponce · Estimación: 4 h-persona

## Hitos de integración

| Hito | Ámbito | Contenido | Días | Rama destino |
| --- | --- | --- | --- | --- |
| H1 | Clínico | FE-14 clasificación, FE-50 consentimiento, FE-13 diagnóstico, FE-55 sesiones | 2–5 | `main` |
| H2 | Clínico + administrativo | FE-56 tareas, FE-57 historial, FE-7 pagos, FE-6 dashboard | 6–9 | `main` |

Fechas reales: _por confirmar_ (FE-58 no fija fechas de inicio ni cierre).

## Versión en el entorno de demo

| Campo | Valor |
| --- | --- |
| Versión de referencia (`main`) | `37ed16b` — documento de pruebas (2026-11-22) |
| Fecha del corte | 2026-11-23 (el corte anterior fue el 2026-11-09, sobre `4c50218`) |
| Migraciones en el repositorio (`db/migrations`) | 001 a 011: esquema base, asignación única, búsqueda con unaccent, clasificación, constancia de atención, diagnóstico único por caso, identidad y clasificación, sesiones (008), tareas por sesión (009), pagos por sesión (010) e indicadores operativos (011) |
| Código del Sprint 2 integrado | Las 8 HU con su verificación de QA y la interfaz del expediente clínico (merges del 2026-11-13) |
| Base de datos de la demo | PostgreSQL con datos **ficticios** (muestra en `docs/pruebas/FE-96-datos-ficticios.json`) |
| Commit desplegado en el entorno de demo | **Por confirmar**: no consta en el repositorio qué commit está desplegado. |

Verificación: comparar `git log -1 --format=%h origin/main` con el despliegue de demo antes del corte H1 y del H2, y anotar el resultado en la fila anterior.

## Estado de los hitos (corte 2026-11-23)

| Hito | HU | Estado en `main` |
| --- | --- | --- |
| H1 | FE-14 | Backend integrado (FE-48, 2026-11-06) y verificado (FE-49, merge `a3bc05c`). |
| H1 | FE-50, FE-13, FE-55 | Integradas el 2026-11-13 y verificadas (FE-65, FE-70, FE-75). |
| H2 | FE-56, FE-57, FE-7, FE-6 | Integradas el 2026-11-13 y verificadas (FE-80, FE-85, FE-90, FE-95). |
| H2 | Interfaz del expediente clínico | Integrada (merge `d8ea18f`). |

Las 8 verificaciones de QA se ejecutaron con PostgreSQL local y datos ficticios, no con el entorno real de Supabase. Falta registrar la aceptación integral de Andrea (FE-101).

Las fechas de los hitos quedan por fijar con el equipo; FE-58 no define fechas.

## Lista de comprobación previa a cada integración

- [ ] La rama pasa las pruebas del backend y el frontend compila.
- [ ] Incluye pruebas positivas, negativas y de permisos directos de API.
- [ ] Contrato (`docs/api/contrato-frontend-backend.md`) actualizado.
- [ ] Migración SQL versionada en `db/`.
- [ ] PR revisado. Si hay cambios de backend por corrección de QA, **Adriana** los revisa y se repiten las pruebas afectadas.

## Incidencias de entrega

| # | Incidencia | Responsable de corrección | Estado |
| --- | --- | --- | --- |
| 1 | No consta qué commit está desplegado en la demo. | Gemina (verificar) y Alejandro (BD/entorno) | Abierta |
| 2 | El guion de aceptación pide identificar el commit probado y las migraciones (FE-97). | Emilia (QA) | Parcial: cada verificación indica su commit; falta el registro de la aceptación integral. |
| 3 | Aplicar en Supabase las migraciones 004 a 011. | Alejandro (BD) | Abierta según FE-107 al 2026-11-13 |

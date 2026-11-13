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
| Versión de referencia (`main`) | `4c50218` — docs(FE-96) |
| Fecha del corte | 2026-11-09 |
| Migraciones en el repositorio (`db/migrations`) | 001 esquema base, 002 asignación única por caso, 003 búsqueda con unaccent, 004 clasificación de casos |
| Código del Sprint 2 integrado | Solo el backend de clasificación y actualización de casos (FE-48, PR #18, 2026-11-06) |
| Base de datos de la demo | PostgreSQL con datos **ficticios** (muestra en `docs/pruebas/FE-96-datos-ficticios.json`) |
| Commit desplegado en el entorno de demo | **Por confirmar**: no consta en el repositorio qué commit está desplegado. |

Verificación: comparar `git log -1 --format=%h origin/main` con el despliegue de demo antes del corte H1 y del H2, y anotar el resultado en la fila anterior.

## Estado de los hitos (corte 2026-11-09)

| Hito | HU | Estado en `main` |
| --- | --- | --- |
| H1 | FE-14 | Backend integrado (FE-48). Falta la pantalla de clasificación y filtros. |
| H1 | FE-50, FE-13, FE-55 | Con especificación (FE-61, FE-66, FE-71), sin código integrado. |
| H2 | FE-56, FE-57, FE-7, FE-6 | Con especificación (FE-76, FE-81, FE-86, FE-91), sin código integrado. |

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
| 2 | El guion de aceptación pide identificar el commit probado y las migraciones (FE-97). | Emilia (QA) | Abierta hasta la ejecución de pruebas |

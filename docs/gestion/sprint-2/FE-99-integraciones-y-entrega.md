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
| Commit de `main` desplegado | _completar_ |
| Fecha de verificación | _completar_ |
| Migraciones aplicadas (`db/`) | 001, 002, 003 y las del Sprint 2 |
| Base de datos | PostgreSQL con datos **ficticios** |

Verificación: comparar `git log -1 --format=%h origin/main` con el despliegue de demo.

## Lista de comprobación previa a cada integración

- [ ] La rama pasa las pruebas del backend y el frontend compila.
- [ ] Incluye pruebas positivas, negativas y de permisos directos de API.
- [ ] Contrato (`docs/api/contrato-frontend-backend.md`) actualizado.
- [ ] Migración SQL versionada en `db/`.
- [ ] PR revisado. Si hay cambios de backend por corrección de QA, **Adriana** los revisa y se repiten las pruebas afectadas.

## Incidencias de entrega

| # | Incidencia | Responsable de corrección | Estado |
| --- | --- | --- | --- |
| 1 | | | |

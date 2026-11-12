# FE-70 — Probar ficha, edición y acceso clínico

Historia FE-13 · Implementación FE-68 (API) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama `feature/FE-70-verificacion-diagnostico`, base `origin/main` en `4c50218` con
`origin/feature/FE-68-api-diagnostico` incorporada (`50f3093`). Se verifica el backend de la
ficha de diagnóstico (`GET` y `PUT /api/carpetas/:id/diagnostico`) contra los ejemplos de
[FE-66](../srs/sprint-2/FE-66-ficha-de-diagnostico.md). La interfaz depende de FE-67, que
sigue en curso; su prueba queda para cuando se integre.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/ficha-diagnostico-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU `es-BO`,
todas las migraciones (001–004 y 006) y datos ficticios. Solo se simula la respuesta de
Supabase Auth (`test/helpers/casos.mjs`). La suite crea una base aleatoria `fe70_run_*` y
la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/ficha-diagnostico-api-postgres.test.mjs
```

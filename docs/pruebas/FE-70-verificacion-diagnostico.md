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

## Matriz de cobertura (ejemplos de FE-66)

| Criterio FE-66 | Prueba | Resultado |
| --- | --- | --- |
| Distinguir ficha ausente de error de carga | `una carpeta sin ficha responde 200 con diagnostico null` | Pasa |
| Crear con fecha válida y opcionales vacíos; recargar y obtener la misma | `la terapeuta asignada crea la ficha…` | Pasa |
| Editar conserva ID y autoría de creación; registra la actualización | `editar conserva id y autoría de creación…` | Pasa |
| Versión anterior conservada | Misma prueba, sobre `auditoria` | Pasa |
| Evaluación de solo espacios rechazada | `datos inválidos responden 400…` | Pasa |
| Fecha imposible rechazada (`2026-02-30`, `12/10/2026`, vacía, ausente) | `datos inválidos responden 400…` | Pasa |
| Acceso directo por una cuenta ajena | `una cuenta ajena no puede leer ni escribir la ficha` (404 / 403 / 401) | Pasa |
| Adicional: textos recortados; opcional de solo espacios queda vacío | `los textos se guardan sin espacios sobrantes…` | Pasa |
| Adicional: el cliente no puede enviar `creadoPor` | `datos inválidos responden 400…` | Pasa |
| Adicional: carpeta inexistente o eliminada → 404 | `carpetas inexistentes o eliminadas…` | Pasa |
| Adicional: reasignar retira el acceso a la ficha | `al reasignar el caso…` | Pasa |
| Cancelar una edición conserva los datos previos | — (interfaz, FE-67) | Pendiente |

## Resultados

- Suite FE-70: **8 aprobadas, 0 fallidas**.

## Hallazgos

1. **Los campos no coinciden con FE-66.** La especificación pide *Evaluación inicial* obligatoria
   y *Diagnóstico de ingreso* opcional. La API exige `diagnosticoIngreso` y no tiene un campo
   de evaluación inicial; además agrega `comentariosClinicos`. Confirmar con la PO (Andrea)
   cuál es el modelo correcto antes de que FE-67 construya el formulario.
2. **Administración también puede editar la ficha clínica** (`@Roles('administrador', 'terapeuta')`).
   FE-66 no lo indica; confirmar con la PO que es lo esperado.

## Pendiente

- Prueba de interfaz (crear, editar, cancelar, mensaje de ficha ausente) cuando se integre FE-67.

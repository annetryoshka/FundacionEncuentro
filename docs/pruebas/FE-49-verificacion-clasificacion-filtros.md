# FE-49 — Probar cambios, filtros y permisos de clasificación

Historia FE-14 · Implementación FE-48 (PR #18) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama `feature/FE-49-verificacion-clasificacion`, base `origin/main` en `4c50218`.
Se verifica el backend de clasificación, estado y filtros contra los ejemplos de
aceptación de [FE-59](../srs/sprint-2/FE-59-clasificacion-y-filtros.md). La interfaz
(controles y filtros) depende de FE-47, que sigue pendiente; su prueba queda para
cuando se integre.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/clasificacion-filtros-postgres.test.mjs`, el ajuste de una aserción de
`backend/test/listado-carpetas-postgres.test.mjs` (ver hallazgo 1) y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU
`es-BO`, todas las migraciones (001–004) y datos ficticios. Solo se simula la
respuesta de Supabase Auth (`test/helpers/casos.mjs`). La suite crea una base
aleatoria `fe49_run_*` y la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/clasificacion-filtros-postgres.test.mjs
```

> El clúster de PostgreSQL debe usar un locale con mayúsculas/minúsculas Unicode
> (ICU o `es_*`/`en_*`). Con `--locale=C`, `lower('Í')` no cambia y fallan las
> búsquedas con tildes de FE-40/FE-38: es un falso negativo del entorno.

## Matriz de cobertura (datos A–D de FE-59)

| Criterio FE-59 | Prueba | Resultado |
| --- | --- | --- |
| Administración busca 101 → A y B con su origen | `administración busca 101 sin filtros…` | Pasa |
| T1 busca 101 → solo A, total excluye B | `T1 busca 101 y solo ve A…` | Pasa |
| Social + Iniciado, tamaño 1 → D pág. 1, A pág. 2, total 2 | `Social + Iniciado con tamaño 1…` | Pasa |
| T1 Privado + En proceso → vacío, total 0 | `T1 filtra Privado + En proceso…` | Pasa |
| «Todos» incluye sin clasificar | `«Todos» (sin parámetro) incluye…` | Pasa |
| Filtros y búsqueda se aplican juntos | `búsqueda y filtros se aplican juntos…` | Pasa |
| Cambiar solo clasificación de A y recargar conserva el resto | `administración cambia solo la clasificación de A…` | Pasa |
| Backend registra autor y fecha de cada escritura | Mismas pruebas, sobre `auditoria` y `actualizadoPor` | Pasa |
| Guardados de estado y clasificación independientes | `la terapeuta asignada cambia estado…` | Pasa |
| `clasificacion=judicial` / `estado=en_conclusion` → 400 sin cambios | `valores inválidos responden 400…` y `filtros con valores fuera del catálogo…` | Pasa |
| T1 actualiza B → 404; marketing clasifica A → 403 | `T1 no puede actualizar B (404)…` (incluye 401 sin token) | Pasa |
| Adicional: inexistente o eliminada → 404 | `carpetas inexistentes o eliminadas…` | Pasa |
| Adicional: reasignar retira permiso de escritura | `reasignar retira a la terapeuta anterior…` | Pasa |

## Resultados

- Suite FE-49: **14 aprobadas, 0 fallidas**.
- Integración backend completa (`node --test test/*.test.mjs`): 157 aprobadas, 0 fallidas, 9 omitidas (requieren su propio opt-in).
- Unitarias backend (`vitest run src`): 47 aprobadas.

## Hallazgos

1. **Regresión de prueba introducida por FE-48.** FE-48 agregó `clasificacion` a cada fila de
   `GET /api/carpetas`, pero la prueba de FE-40 `admin ve vigentes, sin responsable y solo
   campos de resumen` seguía exigiendo las claves anteriores y fallaba en `main`. El campo
   es parte del contrato de FE-59, así que se actualizó la aserción (no el código).
2. **No se puede volver a «Sin clasificar».** `PATCH /api/carpetas/:id/clasificacion` rechaza
   `null` con 400. Coincide con el DTO actual; si la fundación necesita revertir una
   clasificación, debe decidirlo la PO (Andrea).
3. **La terapeuta asignada también puede clasificar** (`@Roles('administrador', 'terapeuta')`).
   FE-59 solo da ejemplos de administración clasificando; confirmar con la PO que es lo esperado.

## Pendiente

- Prueba de interfaz (selectores, vuelta a página 1 al filtrar, mensajes de cada guardado) cuando se integre FE-47.
- Recorrido manual con Supabase real en QA autorizado.

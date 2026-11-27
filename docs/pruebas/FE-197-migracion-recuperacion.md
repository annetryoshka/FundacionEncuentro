# FE-197 · Migración de datos existentes y recuperación de adjuntos

**Responsable:** Alejandro Bobarin · **Fecha:** 2026-11-26 · **Base:** `main` `963025d` (ensayo) → `dbfef78` (rebase)
**Guía resultante:** `docs/operacion/sprint-3/actualizacion-y-recuperacion.md` · **Script:** `backend/scripts/ensayo-actualizacion.mjs`

## Entorno

- Windows 11, Docker Desktop, contenedor desechable `postgres:17` (17.11), el mismo mayor que Supabase.
- Roles `anon` y `authenticated` creados con los permisos por defecto de Supabase, para detectar exposición.
- Migraciones: 012 con el `revoke` de anon/authenticated, igual a la aplicada en Supabase y a la de `main` (`08779ac`);
  019 = `d4b0eea` (PR #64, FE-169, fuera de `main`); 020 = la de `main` (`77462a8`, sha256 `1c182c7ca947…`).
- Datos ficticios. La segunda corrida usa una copia restaurada del respaldo de la base compartida del 2026-11-26 16:35
  (anterior a la 012); solo se registran conteos, no contenido.

## Criterios

| Criterio (Jira) | Resultado |
|---|---|
| Actualizar una base con datos ficticios previos | ✅ Base Sprint 2 (001–011, 263 filas en 14 tablas) → 012…020 sin errores; ninguna fila previa cambió |
| Actualizar una copia de la base real | ✅ 628 filas (001–018 sin 012) → 012, 019, 020 sin errores; ninguna fila previa cambió. 020 también se aplica sin 019 (el orden de unión de #64 y FE-158 no importa) |
| Respaldo y restauración de la BD | ✅ Restaurada idéntica: mismas huellas por tabla y mismo catálogo (tablas, vistas, índices, restricciones, triggers, funciones) |
| Archivos de genograma recuperables | ✅ 5/5 con el mismo sha256 (PDF 250 KB, PNG 1,5 MB, JPEG de 10 MiB = máximo, PNG 40 KB, uno sin activar); vigente correcto por caso; genogramas previos (`datos`) conservados |
| Reglas activas tras restaurar | ✅ El archivo activado sigue sin poder modificarse (`23514`); RLS activo en las 31 tablas |
| Reversión | ✅ Restaurar el respaldo previo a 012 deja la base idéntica a la de partida (huellas y catálogo) |
| Orden, reversión y tiempos documentados | ✅ Guía de operación y sección en `db/migrations/README.md` |

## Tiempos observados (PostgreSQL local)

| Paso | Datos ficticios | Copia real |
|---|---|---|
| 012 | 8 ms | 9 ms |
| 013 / 014 / 015 / 016 | 5 / 9 / 9 / 53 ms | ya aplicadas |
| 017 / 018 | 53 / 59 ms | ya aplicadas |
| 019 | 2 ms | 2–3 ms |
| 020 | 54 ms | 53–58 ms |
| Respaldo con genogramas (14,3 MB) | 1,1 s | 1,1 s |
| Restauración completa | 1,5 s (pre-data 0,3 · data 0,5 · post-data 0,6) | 1,3 s |
| Reversión (restaurar respaldo previo) | 0,9 s (101 KB) | 1,0 s (265 KB) |

Contra Supabase hay que sumar la latencia de red; el volumen actual es pequeño.

## Controles del ensayo (comprobados con mutaciones)

| Mutación agregada como migración 099 | Detectada |
|---|---|
| Tabla nueva sin RLS con una fila | ✅ `sinRls` y `anon.conFilas` |
| Vista sin `security_invoker` sobre `casos` | ✅ `anon.conFilas` y `vistasSinInvoker` (la vista saltaba RLS) |
| `update` de un centavo en un pago existente | ✅ `filasPreviasCambiadas: pagos, auditoria` |

## Hallazgos

1. **012 nunca se había aplicado en Supabase** hasta hoy (2026-11-26): una comprobación anterior buscó `genogramas`,
   que es de la 001. Regla: comprobar con un objeto que crea la migración. Aplicada con respaldo y prueba en seco.
2. **El archivo 012 no tenía el `revoke`** aplicado en Supabase. Resuelto: `f9f4447` en la rama del PR #54 y la 012 en `main` (#67), idénticas.
3. **Imágenes de difusión fuera del respaldo.** `recursos_difusion.ruta` apunta al bucket `difusion-publica`, que no
   existe en Supabase; FE-143 (`af477f4`) registra la ruta que recibe, pero nada sube el archivo. Hoy no hay imágenes.
   Hay que definir dónde se guardan (Storage o la base) y, si es Storage, respaldar el bucket aparte.
   **Resuelto con la 024:** las imágenes se guardan en la base (`imagenes_publicas`) y entran en el respaldo.
4. **Cuentas fuera del respaldo.** `auth.users` no está en el respaldo de `public`: sirve para el mismo proyecto,
   no para recrear Supabase desde cero.
5. **Permisos por defecto.** Supabase da `select` a `anon` en toda tabla nueva; la protección efectiva es RLS sin
   políticas y `security_invoker=true` en las 6 vistas (verificado en Supabase: `anon` obtiene 0 filas en todas).
6. **BOM.** Un `.sql` guardado con BOM falla con error de sintaxis; el ensayo lo quita.

## Pendiente

- Aplicar en Supabase la 020 (ya en `main`) y la 019 cuando se una el PR #64, con el procedimiento de la guía.
- ~~Definir el almacenamiento de las imágenes de difusión (hallazgo 3).~~ Resuelto con la 024.

# Actualización de la base y recuperación (FE-197)

Guía para aplicar migraciones en Supabase, respaldar, restaurar y revertir. Probada sobre PostgreSQL 17 local
con datos ficticios y con una copia restaurada de la base compartida (evidencia: `docs/pruebas/FE-197-migracion-recuperacion.md`).

## Orden de las migraciones

Se aplican en orden numérico, una vez cada una. No hay tabla de control: para saber si una migración está aplicada,
buscar un objeto que **ella crea** (no uno que solo modifica).

| Migración | Estado (2026-11-26) | Objeto para comprobarla |
|---|---|---|
| 001–011 | Supabase | `indicadores_operativos(date, date)` (011) |
| 012 genograma (FE-130) | Supabase y `main` (#67) | tabla `genograma_archivos` |
| 013–018 | Supabase | `exportacion_documentos` (018) |
| 019 revisión de investigación (FE-169) | Pendiente: rama de PR #64 | columna `exportaciones.huella_revision_investigacion` |
| 020 registro de exportaciones (FE-158) | En `main` (#66); falta aplicarla en Supabase. Se aplica con o sin la 019 | función `ruta_archivo_exportacion` |

## Antes de aplicar una migración en Supabase

1. **Respaldo** del esquema `public` (PowerShell, con Docker; la URL sale de `backend/.env` y no se imprime):

   ```powershell
   docker run --rm -e U="<DATABASE_URL>" -v "C:\respaldos:/out" postgres:17 `
     sh -c 'pg_dump "$U" --schema=public -Fc --no-owner --no-privileges -f /out/fundacion-public-AAAAMMDD-HHMM.dump'
   ```

   Supabase usa PostgreSQL 17: usar `pg_dump` 17. Guardar el archivo fuera del repositorio.
2. **Ensayo local** con `backend/scripts/ensayo-actualizacion.mjs` (ver abajo), partiendo de ese respaldo.
3. **Prueba en seco** en Supabase: la migración sin su `commit`, dentro de `begin … rollback`, con las comprobaciones.
4. **Aplicar** en una sola transacción y repetir las comprobaciones:
   - RLS activo en todas las tablas de `public`.
   - `anon` y `authenticated` no obtienen filas de ninguna tabla ni vista (`set local role anon` en una transacción de solo lectura).
   - Vistas nuevas con `security_invoker=true`.
   - Mismo número de filas en las tablas existentes.
   - `GET /api/health` responde.

Supabase da `select` a `anon` y `authenticated` sobre toda tabla nueva de `public`. Lo que impide el acceso es RLS
(sin políticas) y `security_invoker` en las vistas. 012, 017 y 018 agregan además un `revoke` explícito; 015 y 016 no,
y eso es aceptable mientras RLS siga activo y sin políticas en sus tablas.

## Restaurar un respaldo

En una base vacía (ensayo, QA o recuperación), en tres pasos:

```sql
-- Preparación (en Supabase ya existen auth.users y extensions).
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
drop schema public cascade;  -- el respaldo crea public
```

```powershell
pg_restore -d <destino> --no-owner --no-privileges --exit-on-error --section=pre-data  <archivo.dump>
pg_restore -d <destino> --no-owner --no-privileges --exit-on-error --section=data      <archivo.dump>
# Solo fuera de Supabase: auth.users mínimo para las FK de perfiles.
#   insert into auth.users (id) select id from public.perfiles on conflict do nothing;
pg_restore -d <destino> --no-owner --no-privileges --exit-on-error --section=post-data <archivo.dump>
```

Después, en Supabase, volver a dar los permisos del esquema `public` a `anon`, `authenticated` y `service_role`
(los quita `drop schema`), y repetir las comprobaciones del paso 4. La restauración se probó en PostgreSQL local
(el ensayo reproduce esos permisos), no sobre un proyecto Supabase: en Supabase, `drop schema public cascade`
borra todos los datos y solo se usa para una recuperación decidida por el equipo.

- Los triggers y FK se crean en `post-data`: la carga de datos no dispara auditoría ni reglas, y al final quedan activas.
- La columna generada `genograma_archivos.sha256` se recalcula al cargar: sirve para comprobar los archivos.

## Revertir una migración

Restaurar el respaldo tomado justo antes de aplicarla (sección anterior). No hay scripts de reversión por migración.
Todo lo escrito después del respaldo se pierde: avisar al equipo y detener la API mientras se restaura.

## Qué cubre el respaldo

| Dato | Dónde está | ¿En el respaldo de `public`? |
|---|---|---|
| Tablas clínicas, administrativas, auditoría | `public` | Sí |
| Archivos de genograma (012) | `genograma_archivos.contenido` (bytea) | Sí, con su sha256 |
| Cuentas (correo, contraseña) | `auth.users` de Supabase | **No**. En el mismo proyecto no se tocan; para un proyecto nuevo hay que migrar Auth aparte |
| Imágenes del portal (024) | `imagenes_publicas.contenido` (bytea) | Sí, con su sha256 |
| `consentimientos.archivo_path`, `pagos.comprobante_path`, `informes.archivo_path`, `exportaciones.archivo_path` | Rutas (sin archivos guardados hoy) | Solo la ruta |

## Ensayo automático

```powershell
docker run -d --name fe197-pg -e POSTGRES_PASSWORD=<clave> -p 55197:5432 postgres:17
cd backend
$env:FE_PG_ADMIN_URL = 'postgres://postgres:<clave>@localhost:55197/postgres'
$env:FE_PG_CONTENEDOR = 'fe197-pg'
# Datos ficticios del Sprint 2 (001–011) y todas las migraciones siguientes:
node scripts/ensayo-actualizacion.mjs --base 011 [--extra ruta\019_x.sql] --salida informe.json
# Desde un respaldo real, aplicando solo las migraciones nuevas:
node scripts/ensayo-actualizacion.mjs --desde-respaldo C:\respaldos\x.dump --aplicar '019,020' --extra ... --salida informe.json
```

En PowerShell, `--aplicar` va entre comillas (sin ellas `012,019` se convierte en números). Solo acepta PostgreSQL
local, crea `anon`/`authenticated` con los permisos por defecto de Supabase y borra sus bases al terminar.
Por migración informa tiempo, filas previas modificadas, tablas sin RLS y exposición a `anon`. Luego sube
archivos de genograma, respalda, restaura y compara (filas, catálogo, sha256) y prueba la reversión.
Si el archivo `.sql` tiene BOM (lo agrega `Set-Content -Encoding utf8` de PowerShell 5), PostgreSQL lo rechaza
como error de sintaxis; el ensayo lo quita. Guardar las migraciones en UTF-8 sin BOM.

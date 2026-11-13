   # Base de datos

   PostgreSQL en Supabase. Los scripts se ejecutan en orden numérico.

   | Script | Contenido |
   |---|---|
   | `migrations/001_esquema_base.sql` | Esquema base: pacientes, casos, fichas, pagos, auditoría y RLS |
   | `migrations/002_asignacion_unica_por_caso.sql` | Una responsable actual por caso |
   | `migrations/003_busqueda_carpetas_unaccent.sql` | Extensión unaccent en extensions para búsqueda FE-40 sin tildes |
   | `migrations/004_clasificacion_casos.sql` | Clasificación social/privado del caso (FE-14) |
   | `migrations/005_constancia_atencion.sql` | FE-63: procedencia y constancia (pendiente / registrado / no aplica), una por caso |
   | `migrations/006_diagnostico_unico_por_caso.sql` | FE-68: una ficha de diagnóstico por caso y quién la actualizó |
   | `migrations/007_identidad_y_clasificacion_casos.sql` | FE-60: el origen y el número del caso no cambian; índice de clasificación |
   | `migrations/008_00_funcion_autor_sesiones.sql` | FE-73: función que llena `actualizado_por` desde `app.usuario_id` |
   | `migrations/008_sesiones.sql` | FE-74: sesión = `fichas_seguimiento` con evolución, responsable y número automático |
   | `migrations/009_tareas_por_sesion.sql` | FE-79: cada tarea pertenece a una sesión del mismo caso; quién cambió el cumplimiento |
   | `migrations/010_pagos_por_sesion.sql` | FE-89: un pago por sesión del mismo caso; monto sin redondeo silencioso |

   ## Modelo del Sprint 2

   ```
   casos 1 ─ 0..1 contexto_judicial      (datos judiciales del alta)
         1 ─ 0..1 constancias_atencion   (procedencia y constancia)
         1 ─ 0..1 fichas_diagnostico     (campos en contenido jsonb)
         1 ─ n    fichas_seguimiento     (= sesiones; nro_sesion único en el caso)
                    1 ─ n tareas_terapeuticas
                    1 ─ 0..1 pagos
   ```

   - Tareas y pagos guardan `caso_id` y `sesion_id`. La FK compuesta `(sesion_id, caso_id)` impide asociar una sesión de otro caso.
   - Constancia (FE-63) y diagnóstico (FE-68) guardan `actualizado_por` desde la API; en sesiones lo llena un trigger desde `app.usuario_id`. Todo cambio queda además en `auditoria`.
   - Errores que la API debe traducir: `23514` (check) y `23502` (falta un dato) → 400, `23505` (duplicado) → 409, `23503` (sesión de otro caso o inexistente) → 400 o 404.

   Las fechas de sesión y pago no tienen valor por defecto: las envía la API en fecha de Bolivia. `current_date` en Supabase usa UTC.

   ## Pruebas de las migraciones con PostgreSQL local

   Cada archivo `backend/test/*-postgres.test.mjs` del Sprint 2 crea una base desechable, aplica todas las migraciones, carga datos ficticios y la borra al terminar. Nunca usa Supabase.

   ```powershell
   docker run -d --name fe-qa-pg -e POSTGRES_PASSWORD=qa -p 55432:5432 postgres:17
   cd backend
   $env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:qa@localhost:55432/postgres'
   node --test test/tipo-estado-postgres.test.mjs   # o test/*-postgres.test.mjs
   ```

   | Subtarea | Prueba |
   |---|---|
   | FE-60 | `tipo-estado-postgres.test.mjs` |
   | FE-64 | `contexto-constancia-postgres.test.mjs` |
   | FE-69 | `ficha-diagnostico-postgres.test.mjs` |
   | FE-74 | `sesiones-postgres.test.mjs` |
   | FE-79 | `tareas-postgres.test.mjs` |
   | FE-89 | `pagos-integridad-postgres.test.mjs` |

   `npm run datos:demo` también carga los datos de demostración del Sprint 2.

   ## Cómo ejecutarlo
   1. Supabase → SQL Editor → New query
   2. Pegar el contenido del script y ejecutar con Run
   3. Revisar Advisors → Security Advisor

   ## Reglas
   - Un cambio de esquema = un script nuevo (002, 003...). No se edita uno ya ejecutado.
   - Nunca se desactiva RLS en las tablas.

## Reproducción en un entorno QA aislado (FE-23)

La migración 001 es de instalación inicial, no un script idempotente: se aplica
una vez sobre una base nueva. Reproducir significa aplicarla en otro entorno
vacío equivalente, no volver a ejecutarla sobre tablas existentes. Nunca usar
`DROP` o `TRUNCATE` para forzar su ejecución en una base compartida.

Requisitos: PostgreSQL 15 o posterior (por las vistas `security_invoker` y
`UNIQUE NULLS NOT DISTINCT`), Supabase Auth ya instalado con `auth.users`, esquema
`extensions` disponible y permisos para instalar `pg_trgm`. Un PostgreSQL vacío
sin Auth no es equivalente a Supabase. La 001 no crea usuarios de Auth ni almacena
contraseñas en `perfiles`.

En un proyecto Supabase de QA nuevo, comprobar antes el destino y aplicar los
archivos en orden numérico. Para evitar instalaciones parciales, usar una
transacción con parada ante el primer error. Con `psql` instalado, desde la raíz:

```powershell
# FE23_QA_DATABASE_URL se proporciona fuera de Git; no imprimir su valor.
psql "$env:FE23_QA_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/001_esquema_base.sql
```

Este comando no se ejecutó durante FE-23 por ausencia de servicios QA. No usar
la conexión de producción. No guardar la URL, contraseñas ni tokens en evidencia.

Verificar en QA que `perfiles.id` es PK/FK a `auth.users.id`, que se rechazan roles
ajenos a administrador/terapeuta/marketing y valores nulos en rol/activo, y que
`activo` inicia en true. Comprobar también los triggers de auditoría y que el rol
de conexión del backend tiene los permisos necesarios con RLS activado. La 001
activa RLS pero no define políticas de lectura/escritura para clientes directos;
no se debe desactivar RLS para hacer pasar las pruebas.

Las cuentas QA deben crearse con Supabase Auth o el flujo de administración ya
existente (FE-29), nunca insertando contraseñas en SQL. Cada cuenta necesita un
perfil con el mismo UUID, rol válido y estado activo. Para preparar el primer
administrador en un proyecto QA vacío, un operador autorizado puede crear el
usuario en Auth y asociar su perfil mediante una transacción auditada; después se
reutiliza POST `/api/usuarios`. Generar contraseñas temporales fuera de Git y no
copiar hashes. Las pruebas automatizadas de FE-23 generan sus credenciales
ficticias en memoria y no crean cuentas reales.

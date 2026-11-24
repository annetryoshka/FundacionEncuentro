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
   | `migrations/011_indicadores_operativos.sql` | FE-94: función `indicadores_operativos(desde, hasta)` para el dashboard de FE-6 |
   | `migrations/013_residencia_pacientes.sql` | FE-135: ciudad de residencia del paciente y `indicadores_por_residencia(desde, hasta)` |
   | `migrations/014_difusion_publicaciones.sql` | FE-142: publicaciones de difusión, imágenes y vista pública `v_publicaciones_publicas` |
   | `migrations/015_familiares_caso.sql` | FE-125: composición familiar por caso y vista `v_fuente_clinica_vigente` |

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
   - Consultas del historial ya revisadas (FE-84): `backend/test/historial-postgres.test.mjs`. Cada sección va en su propia consulta; unir sesiones, tareas y pagos en una sola duplica filas.
   - Dashboard (FE-94): `select * from indicadores_operativos('2026-10-12', '2026-10-19')`. Fechas inclusivas, solo casos y pacientes no eliminados, pagos en BOB.

   ## Residencia del paciente (FE-135)

   Catálogo de FE-134. Columnas nuevas en `pacientes`:

   | Columna | Regla |
   |---|---|
   | `ciudad_residencia` | `la_paz`, `el_alto`, `otra` o NULL (= sin registrar). Los pacientes existentes quedan en NULL. |
   | `otra_localidad` | Obligatoria (hasta 100 caracteres, no solo espacios) si la ciudad es `otra`; NULL en los demás casos. |
   | `residencia_actualizada_en`, `residencia_actualizada_por` | Las llena un trigger desde `app.usuario_id` cuando cambia la residencia. |

   - Es la residencia **actual**: la comparten todas las carpetas del paciente y cambiarla no toca número, origen, fecha de ingreso ni asignación.
   - Filtro del listado (FE-136), dentro de las mismas condiciones de `listarCarpetas`, antes del total y la paginación:
     `residencia=sin_registrar` → `p.ciudad_residencia is null`; otro valor → `p.ciudad_residencia = $n`.
   - Indicadores: `select * from indicadores_por_residencia('2026-11-20', '2026-11-21')` devuelve siempre 4 filas
     (`la_paz`, `el_alto`, `otra`, `sin_registrar`) con las mismas columnas que `indicadores_operativos`; su suma es igual a esa función.
     Las sesiones y pagos se agrupan por la residencia actual del paciente.
   - Errores: ciudad fuera del catálogo u `otra` sin localidad → `23514` (400).

   ## Difusión (FE-142)

   Contrato de FE-140. Separado de lo clínico: sus FK solo apuntan a `perfiles`.

   ```
   publicaciones_difusion 1 ─ n recursos_difusion   (metadatos de imágenes; una sola principal)
   v_publicaciones_publicas                          (solo publicadas, solo campos públicos)
   ```

   - Estados: se crea en `borrador`; `borrador → publicado → retirado → borrador`. Otra transición → `23514`.
     `creado_por`, `publicado_en/por` y `retirado_en/por` los pone la base desde `app.usuario_id`; lo que envíe el cliente se ignora.
   - Para publicar hace falta `resumen`. Los mínimos por tipo (fechas, modalidad, lugar) los valida la API (FE-143) hasta que FE-141 los ratifique.
   - Límites: título 1–150, resumen ≤ 500, contenido ≤ 10 000, lugar ≤ 200, `contacto_url` http/https ≤ 500, fin ≥ inicio.
     El contenido se guarda como texto: la API y la interfaz no lo interpretan como HTML.
   - Imágenes: el archivo va en el bucket `difusion-publica` (nunca en el almacenamiento clínico); aquí se guardan ruta relativa,
     tipo (`image/jpeg`, `image/png`, `image/webp`), tamaño ≤ 5 MB, dimensiones, `sha256` y texto alternativo obligatorio.
     Ruta repetida o segunda imagen principal → `23505`.
   - La API pública lee solo de `v_publicaciones_publicas`: publicada o no existe (retirada o borrador → 404).
   - RLS activo y sin acceso para `anon`/`authenticated`: todo pasa por el backend.

   Las fechas de sesión y pago no tienen valor por defecto: las envía la API en fecha de Bolivia. `current_date` en Supabase usa UTC.

   ## Composición familiar (FE-125)

   Contrato de FE-123. La familia va en tablas propias, fuera del JSON de `fichas_diagnostico`: guardar el diagnóstico no la borra.

   ```
   casos 1 ─ 0..1 fichas_familiares   (sin fila = sin registrar; versión para ediciones concurrentes)
                    1 ─ n familiares   (parentesco respecto del paciente; deleted_at = eliminado)
   ```

   | Columna de `familiares` | Regla |
   |---|---|
   | `parentesco` | `madre`, `padre`, `hermano`, `hermana`, `hijo`, `hija`, `abuelo_materno`, `abuela_materna`, `abuelo_paterno`, `abuela_paterna`, `tio`, `tia`, `pareja`, `tutor`, `tutora`, `otro`. Se puede repetir. |
   | `parentesco_detalle` | Obligatorio (hasta 100) si el parentesco es `otro`; NULL en los demás. |
   | `nombre_completo`, `lugar_trabajo_estudio` (150), `ocupacion` (200), `observaciones` (2000) | Opcionales. NULL = desconocido; no se aceptan textos vacíos. |
   | `fecha_nacimiento` o `edad_referida` + `fecha_referencia` | Una de las dos formas, o ninguna (edad desconocida). Edad 0–130. Fechas desde 1900 y no futuras (hora de Bolivia). |
   | `convive_con_paciente` | true, false o NULL = desconocido. |
   | `orden_registro` | Orden en que se registraron; usar para listar. |
   | `creado_por`, `actualizado_por` | Los llena un trigger desde `app.usuario_id`. |

   - La edad referida no se actualiza sola. Edad cumplida desde el nacimiento: `edad_en(fecha_nacimiento, fecha)`.
   - Un familiar no cambia de caso ni se edita después de eliminado (`23514`). Sin cabecera no hay familiares (`23503`); la cabecera es única por caso (`23505`).
   - `fichas_familiares.version` sube una vez por transacción que cambia familiares. Para guardar: `select version ... for update`, comparar con la versión que envió el cliente (distinta → 409) y aplicar los cambios en la misma transacción.
   - No enlaza familiares con `pacientes` ni crea carpetas para ellos.
   - `v_fuente_clinica_vigente`: por caso, el diagnóstico de la ficha (`origen = 'ficha'`) o, si no hay ficha, el del alta (`'alta'`), o `'sin_datos'`. Un NULL de la ficha no se completa con el alta. Las columnas `alta_*` conservan siempre lo registrado en el alta.

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
   | FE-84 | `historial-postgres.test.mjs` |
   | FE-94 | `indicadores-postgres.test.mjs` |
   | FE-135 | `residencia-postgres.test.mjs` |
   | FE-142 | `difusion-postgres.test.mjs` |
   | FE-125 | `familiares-postgres.test.mjs` (aplica la 015 sobre una base con datos existentes) |

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

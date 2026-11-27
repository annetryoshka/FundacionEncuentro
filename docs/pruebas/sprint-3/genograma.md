# FE-133 — Verificar integridad y confidencialidad del genograma

- **Historia:** FE-17, importar y visualizar el genograma de GenoPro dentro de la ficha.
- **Base probada:** rama `feature/FE-130-almacenamiento-genograma`, commit `f9f4447`. Incluye la API de Adriana (FE-131, `ebd73e3`) y el almacenamiento de Alejandro (FE-130, `f559ac7` y `f9f4447`).
- **Trazabilidad:** RF-15.
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `f9f4447` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** suite QA 11/11 aprobadas (10,0 s); regresión de FE-130 y FE-131 12/12 aprobadas (5,8 s). Se encontró un defecto en la migración 012 (FE133-01, sección 4). La interfaz está pendiente (sección 5).

## 1. Alcance

| Parte | Estado | Cómo se prueba |
|---|---|---|
| Almacenamiento privado (FE-130) | Listo | PostgreSQL 17 local desechable con todas las migraciones |
| API de carga, consulta y descarga (FE-131) | Lista | NestJS HTTP real con guards reales; solo Supabase Auth es un doble |
| Visor y carga (FE-132, Jorge) | Listo, en la rama `feature/FE-138-FE-170-front-sprint3` | Sección 5 |
| Muestra real de GenoPro (FE-129, Andrea) | En curso | Sección 5: comparar que la imagen conserva las relaciones |

Todos los archivos son ficticios y se generan en la prueba. Cada ejecución crea una base `fe133_*` en tu PostgreSQL local y la borra al terminar.

## 2. Cómo ejecutar

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test test/genograma-qa-postgres.test.mjs
node --test test/genograma-postgres.test.mjs test/genograma-http.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

La segunda línea de `node --test` vuelve a correr las suites de Alejandro y Adriana como regresión.

**Requisito previo (una sola vez por PostgreSQL local), por el defecto FE133-01:** crear los roles `anon` y `authenticated` sin login, como existen en Supabase. Sin ellos la migración 012 falla. Se pueden crear con `create role anon nologin; create role authenticated nologin;` como superusuario.

## 3. Matriz de aceptación

| # | Escenario | Esperado | Observado | Resultado |
|---|---|---|---|---|
| G1 | Cargar PNG, JPEG y PDF y descargarlos | Bytes idénticos, `Content-Type` y `Content-Length` correctos, sha256 guardado igual al del archivo, cada reemplazo conserva la versión anterior | Bytes y sha256 idénticos en los 3 formatos; 3 versiones conservadas | Aprobado |
| G2 | Cabeceras de la respuesta | `private, no-store`, `nosniff`, descarga como adjunto; los metadatos no incluyen bytes ni la clave interna | Cabeceras correctas; metadatos con 5 campos, sin bytes ni clave | Aprobado |
| G3 | Nombre de archivo con comillas, saltos de línea y "ñ" | No se inyectan cabeceras; el nombre de descarga queda saneado | Sin cabecera inyectada; nombre saneado | Aprobado |
| G4 | Límite de tamaño | Exactamente 5 MB → 204 e idéntico al descargarlo; 5 MB + 1 byte → 413 sin guardar nada | 5 MB → 204 e idéntico; 5 MB + 1 → 413 sin guardar | Aprobado |
| G5 | PNG declarado como JPEG, HTML con extensión `.png`, SVG con script, GIF, archivo vacío, sin archivo, campo con otro nombre | 415 / 415 / 415 / 415 / 400 / 400 / 400, sin guardar nada y sin cambiar el vigente | 7/7 con el código esperado y sin guardar | Aprobado |
| G6 | Aislamiento entre casos | Cada caso descarga solo su archivo; las claves de los archivos empiezan por el ID del caso | Cada caso, su archivo | Aprobado |
| G7 | Reasignar el caso a otra terapeuta | La anterior recibe 404 (metadatos, descarga y carga); la nueva recibe 200 | Anterior 404, nueva 200; carga de la anterior 404 | Aprobado |
| G8 | Caso eliminado | 404 incluso para administración, y no se puede cargar | 404 para administración; carga 404 | Aprobado |
| G9 | Permisos por URL/API | Sin token o token inventado → 401; marketing → 403; terapeuta ajena → 404; administración → 200; PUT sin token → 401 | 401/401/403/404/200; PUT sin token 401 | Aprobado |
| G10 | Regresión: cargar genograma ↔ diagnóstico | El diagnóstico queda igual | Diagnóstico igual | Aprobado |
| G11 | Dos cargas simultáneas | Ambas 204; queda un vigente coherente con sus metadatos | 204/204; vigente coherente | Aprobado |
| R1 | Regresión: suites de FE-130 y FE-131 | Todas en verde | 12/12 | Aprobado |

## 4. Observaciones de la revisión del código (antes de ejecutar)

0. **DEFECTO FE133-01 (Alejandro), detectado al ejecutar:** la migración `012_genograma_archivos.sql` (línea 81) hace `revoke all on public.genograma_archivos from anon, authenticated;` sin comprobar si esos roles existen. En un PostgreSQL que no es Supabase, la migración falla con `role "anon" does not exist` (código 42704), y con ella todas las suites `*-postgres.test.mjs` de cualquier rama que tenga la 012, incluida `main`. Las migraciones 011, 013, 014 y 017 sí lo protegen con `if exists (select 1 from pg_roles where rolname = 'anon')`. Propuesta: aplicar la misma protección en la 012. Por ser una migración ya aplicada en Supabase, el cambio lo decide Alejandro. Mientras tanto, para ejecutar las suites en local se crean los roles `anon` y `authenticated` sin login en el PostgreSQL local, imitando a Supabase (sección 2).
1. **Archivos huérfanos.** El archivo se guarda primero y luego se activa en otra transacción. Si la activación falla (por ejemplo, el caso se reasigna en ese instante), queda una fila sin activar en `genograma_archivos`. La migración lo acepta como "descartable", pero no existe una limpieza programada. Riesgo bajo; anotarlo para Alejandro.
2. **"Sin genograma" y "caso inexistente" devuelven el mismo 404.** Solo cambia el mensaje ("Genograma no encontrado" frente a "Caso no encontrado"). El frontend debe distinguirlos por el mensaje o por el contexto de la carpeta.
3. **Límite doble.** La API corta en 5 MB y la base admite hasta 10 MB. No es un problema, pero conviene que el contrato diga 5 MB.
4. **Estilo:** la sangría de `consultar` y `GenogramaDescargaService` es irregular. No afecta el funcionamiento.

## 5. Interfaz y muestra de GenoPro (pendiente)

| Paso | Esperado | Resultado |
|---|---|---|
| Ver un PNG cargado tras recargar; ampliar y cerrar con Esc | La imagen es visible y el foco vuelve | |
| Ver un PDF (visor, abrir en otra pestaña, descargar) | Se abre y se descarga el mismo archivo | |
| Reemplazo rechazado (archivo falso) | Mensaje 415 y se conserva el anterior | |
| Muestra de GenoPro de FE-129 | La imagen conserva las relaciones de la muestra (padres, hijos, uniones) | |
| Móvil (375 px) | Visor usable, sin desplazamiento horizontal | |

## 6. Hallazgos

- **FE133-01 (Media, Alejandro):** la migración 012 falla en un PostgreSQL que no es Supabase (`role "anon" does not exist`), lo que impide correr las suites locales de cualquier rama con la 012, incluida `main`. Detalle y propuesta en la sección 4. Para esta verificación se crearon los roles en el PostgreSQL local.
- La integridad y la confidencialidad del archivo cumplen todos los escenarios: no hubo otros defectos en el backend.

## 7. Cierre

- [x] Suite QA y regresión ejecutadas; resultados en la matriz (11/11 y 12/12, 2026-11-26).
- [ ] Defecto FE133-01 comunicado a Alejandro.
- [ ] Interfaz verificada (sección 5).
- [ ] Muestra de GenoPro comparada cuando Andrea cierre FE-129.

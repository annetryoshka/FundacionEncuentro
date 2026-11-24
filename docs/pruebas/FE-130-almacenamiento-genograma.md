# FE-130 — Metadatos y almacenamiento privado de genogramas

Historia: FE-17 · Responsable: Alejandro Bobarin · Estimación: 5 h-persona · Insumo: FE-129 (Andrea).

**Base:** rama `feature/FE-131-api-genograma` (`ebd73e3`, Adriana), sobre `main` `37ed16b`. FE-130 implementa las interfaces `GenogramaArchivos` y `GenogramaEscritura` que define FE-131; se integra después de FE-131.

## Qué se hizo

| Archivo | Cambio |
|---|---|
| `db/migrations/012_genograma_archivos.sql` | Tabla `genograma_archivos` (contenido `bytea`, tipo, tamaño, `sha256`, autor, activación) y `genogramas.archivo_clave` como referencia al vigente. |
| `backend/src/modules/casos/genograma/genograma-almacen-postgres.ts` | Adaptador PostgreSQL de las dos interfaces de FE-131. |
| `genograma-acceso.service.ts` | `verificar` acepta un `client` opcional para comprobar el permiso dentro de la transacción de activación. |
| `casos.module.ts` | Registra el controlador y los servicios de FE-131 con el adaptador. |
| `test/genograma-postgres.test.mjs` | Pruebas SQL y de API con base real. |
| `test/helpers/pg-qa.mjs`, `test/helpers/casos.mjs` | `crearBase(prefijo, { hasta })` + `migrar()` para probar una migración sobre datos existentes; `servidor()` expone `base`. |
| `db/migrations/README.md` | Modelo, reglas, integridad y recuperación. |

**Decisión:** los archivos se guardan en PostgreSQL, no en Supabase Storage. Así, la activación y el cambio de referencia van en una transacción, el respaldo de la base incluye los archivos y no hace falta configurar un bucket ni una clave nueva. Límite en la base: 10 MiB (FE-129); la API limita a 5 MiB.

## Reutilizado

Tabla `genogramas` de la 001 (se conserva `datos`), `set_actualizado_en`, `auditar_cambio`, `db.transaction` y los helpers de prueba.

## Resultados

| Criterio | Prueba | Resultado |
|---|---|---|
| Migración aplicable sobre datos existentes | Base hasta la 011 con un genograma previo y luego la 012 | ✅ fila conservada, `archivo_clave` nulo, sin vigente |
| Carga, consulta y descarga | PUT, GET y GET `/archivo` por HTTP con autenticación y base reales | ✅ 204/200, metadatos y bytes iguales |
| Autoría y sustitución consistente | Reemplazo por la terapeuta asignada | ✅ autor nuevo; 2 versiones activadas; la anterior se puede leer |
| Archivo inválido | PDF falso | ✅ 415, vigente y cantidad de archivos sin cambio |
| Aislamiento de casos | Terapeuta no asignada: GET, descarga y PUT; marketing | ✅ 404 / 403, nada guardado |
| Caso sin genograma o inexistente | GET y descarga | ✅ 404 |
| Vigente intacto ante un fallo | Activación sin permiso, con datos distintos y con archivo de otro caso | ✅ rechazo; vigente sin cambio; archivo queda sin activar |
| Integridad SQL | Clave de otro caso (23514), referencia cruzada (23503), tamaño/tipo/activación (23514), contenido inmutable y sin reactivar (23514), borrar el vigente (23503) | ✅ |
| Huella y auditoría | `sha256` = SHA-256 calculado en Node; auditoría solo en `genogramas` con autor | ✅ |
| Recuperación | `pg_dump -Fc` y `pg_restore` de una base con un PDF ficticio de 3 MiB | ✅ dump 3,6 MB en 0,3 s; restauración 0,5 s; `sha256` y tamaño coinciden; la referencia vigente se conserva |

## Procedimiento de recuperación

1. Respaldo: `pg_dump -Fc "$DATABASE_URL" -f respaldo.dump` (incluye los archivos).
2. Restauración en una base vacía: `pg_restore --no-owner -d <base> respaldo.dump`.
3. Comprobar: `select count(*) from genograma_archivos where sha256 <> sha256(contenido) or octet_length(contenido) <> tamanio` → `0`; y que cada `genogramas.archivo_clave` exista.

## Entorno

PostgreSQL 16 local en Docker (base desechable por prueba; nunca Supabase). La autenticación es la de las pruebas (`servidor()` simula Supabase Auth). Backend: `npm run build`, `test:unit` 256/256, `test:integration` 277 pasan, 0 fallan, 1 omitida (requiere otra configuración).

## Pendiente

- La migración 012 no se aplicó en el Supabase compartido: se aplica cuando FE-131 y FE-130 estén en `main`.
- FE-129 aún no tiene muestra real de GenoPro; las pruebas usan PDF/PNG ficticios.
- Archivos nunca activados: se dejó la consulta para descartarlos; no hay limpieza automática.

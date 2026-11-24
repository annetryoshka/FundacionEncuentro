# FE-142 — Modelar publicaciones y recursos de difusión

Historia FE-112 · Insumo [FE-140](../srs/sprint-3/FE-140-difusion-publicaciones.md) (rama `docs/andrea-sprint3-contratos`) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-142-difusion-publicaciones` sobre `main` en `37ed16b`. Solo base de datos, datos de
demostración y pruebas; la API protegida y la pública son de FE-143 y el panel de FE-144.

| Archivo | Cambio |
|---|---|
| `db/migrations/014_difusion_publicaciones.sql` | `publicaciones_difusion`, `recursos_difusion`, transiciones de estado, vista `v_publicaciones_publicas`, RLS y auditoría |
| `backend/scripts/datos-demo.mjs` | Una campaña publicada, una actividad en borrador y un curso retirado, ficticios y a nombre de marketing |
| `backend/test/difusion-postgres.test.mjs` | Estados, validaciones, imágenes, vista pública y separación de lo clínico |
| `db/migrations/README.md` | Reglas del modelo para FE-143 |

Decisiones (propuestas de FE-140 aún por ratificar con FE-141):

- Para publicar la base exige `resumen`; los mínimos por tipo quedan en la API.
- Imágenes: solo metadatos; el archivo va en un bucket propio `difusion-publica`.
- No hay borrado lógico: retirar es la forma de ocultar.
- Los datos demo no traen imágenes porque aún no hay imágenes autorizadas.

## Entorno y comandos

PostgreSQL 16 local desechable (Docker), migraciones 001–011 y 014 (012 y 013 son de FE-130 y FE-135). La suite crea su base y la borra.
No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55432/postgres \
  node --test test/difusion-postgres.test.mjs
```

## Matriz de pruebas

| # | Criterio (FE-140) | Comprobación | Resultado |
|---|---|---|---|
| 1 | Sin publicaciones = vacío | La vista pública devuelve 0 filas, sin error | ✔ |
| 2 | Crear → borrador | Queda en `borrador`, autor = quien la crea (se ignora el `creado_por` y `publicado_en` enviados) y no aparece en la vista. Crear en `publicado` o `retirado` → `23514` | ✔ |
| 3 | Campos | Tipo fuera del catálogo, título vacío o > 150, resumen > 500, contenido > 10 000, modalidad desconocida, lugar vacío o > 200, URL `javascript:`, `ftp:`, sin dominio o con espacios, fin antes que inicio → `23514`; sin título o tipo → `23502`. Los límites exactos y una campaña sin fechas se aceptan | ✔ |
| 4 | Publicar incompleto | Sin resumen o con solo espacios → `23514`; el borrador sigue igual | ✔ |
| 5 | Publicar | `publicado_en` y `publicado_por` puestos por la base; la vista devuelve exactamente los campos guardados | ✔ |
| 6 | Editar publicado | Sigue publicado; se conservan autor y fecha de publicación aunque el cliente envíe otros; `actualizado_por` cambia; la vista muestra el nuevo título | ✔ |
| 7 | Retirar | Desaparece de la vista (listado y por id); guarda fecha y autor del retiro | ✔ |
| 8 | Retirado → borrador → publicado | Se corrige sin aparecer; al volver a publicar cambia `publicado_en` | ✔ |
| 9 | Transiciones no previstas | Borrador → retirado, publicado → borrador, retirado → publicado, estado desconocido → `23514`; el estado no cambia | ✔ |
| 10 | Imágenes | PDF, SVG, 0 bytes, > 5 MB, ancho 0, sin texto alternativo, texto > 300, ruta con `..`, absoluta o con espacios, almacenamiento `genogramas`, `sha256` inválido → rechazo; ruta repetida o segunda principal → `23505`; un fallo de imagen no cambia el texto guardado | ✔ |
| 11 | Vista pública | Expone la imagen principal; columnas exactas (sin estado, autoría ni fechas internas); el número de filas es igual al de publicadas y ninguna fila no publicada aparece | ✔ |
| 12 | Separación de lo clínico | Las FK de ambas tablas solo apuntan a `perfiles` y `publicaciones_difusion`; RLS activo en las dos | ✔ |
| 13 | Auditoría | Creación y publicación quedan con su autor (marketing crea, administración publica) | ✔ |

Comprobaciones adicionales:

- `datos-demo.mjs` contra la base local (Supabase Auth simulado): 3 publicaciones a nombre de marketing
  (campaña publicada, actividad en borrador, curso retirado); la vista pública muestra solo la campaña.
  Una segunda ejecución no crea nada; `--borrar` las elimina antes que las cuentas, así la cuenta de marketing se puede borrar.

## Resultado

10 de 10 pruebas aprobadas (13 criterios). Regresión: backend build, 240 pruebas unitarias y 279 de integración
(todas las suites PostgreSQL habilitadas, `--test-concurrency=1`) aprobadas; frontend lint, build y 156 pruebas aprobadas.

## Para FE-143

- Consulta pública: solo `v_publicaciones_publicas` (filtro por `tipo`, orden por `publicado_en desc`, paginación).
  Un id que no está en la vista → 404.
- Administración: `insert` sin estado; publicar o retirar = `update ... set estado`, dentro de `db.transaction`.
  `23514` → 400, `23505` → 409.
- Antes de publicar, la API valida los mínimos por tipo y devuelve los campos pendientes.
- Imágenes: subir al bucket `difusion-publica` y guardar la fila en `recursos_difusion`. Si la subida falla, el texto ya está guardado.

## Pendiente

- La migración 014 no se aplicó en Supabase: se ejecuta en el SQL Editor, después de la 012 y la 013, cuando se integre la rama.
- Crear el bucket `difusion-publica` en Supabase Storage (FE-143).
- Contenido, contactos e imágenes autorizadas: FE-141.

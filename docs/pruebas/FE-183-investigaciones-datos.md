# FE-183 — Persistencia de investigaciones públicas

Historia FE-116 (RF-26) · Insumo [FE-182](../srs/sprint-3/FE-182-investigaciones-publicas.md) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-183-investigaciones-publicas` sobre `feature/FE-173-gastos-mensuales` (`cfe0afd`, PR #74), para que la
numeración y el README queden en orden. Solo base de datos y pruebas.
La API es de FE-184 (Emilia, revisión de Adriana); la pantalla, de FE-187 (Jorge, sobre los componentes de FE-186);
la verificación, de FE-185 (Gemina).

**Alcance acordado por el equipo el 26/11/2026:** se publican investigaciones (artículos) y el público las consulta;
**sin comentarios de visitantes**, así que no hay moderación. Es la opción por defecto de FE-182 §2.

| Archivo | Cambio |
|---|---|
| `db/migrations/023_investigaciones_publicas.sql` | `publicaciones_foro` (001): resumen, autor visible, imagen opcional, estados como difusión, fechas y autoría por la base, permisos de administración/marketing, borrado solo de lo nunca publicado; vista `v_investigaciones_publicas`; auditoría; sin acceso para `anon`/`authenticated`, tampoco a `comentarios_foro` |
| `backend/test/investigaciones-publicas-postgres.test.mjs` | 11 pruebas sobre PostgreSQL local |
| `db/migrations/README.md` | Columnas, flujo y errores para FE-184/FE-187 |

Numeración: 021 es de FE-126 y 022 de FE-173; 023 no la usa ninguna rama (revisado por contenido en todas las ramas remotas).

## Decisiones

- **Se reutiliza `publicaciones_foro`**, como indica FE-183, en lugar de agregar un tipo a `publicaciones_difusion`. Así no
  cambian la API, los DTO ni las pantallas de difusión ya integrados, y coincide con el modelo `InvestigacionPublica` de FE-186.
- **Estados y reglas copiados de difusión (FE-140/FE-142):** se crea en borrador; borrador → publicado → retirado → borrador;
  publicar exige resumen; publicar y retirar registran fecha y autor.
- **Autoría:** `autor_id` es quien lo creó en el sistema y no se publica. `autor_visible` es lo que ve el público
  (NULL si no se autorizó mostrarla).
- **Fecha pública:** fecha en Bolivia de la última publicación (`fecha_publicacion`).
- **Permisos en la base:** solo administración o marketing activos crean, editan, publican, retiran o eliminan (`42501`).
- **Eliminar:** solo lo que nunca se publicó. Lo que estuvo publicado se retira y se conserva.
- **Imagen:** solo metadatos (ruta en `difusion-publica`, texto alternativo obligatorio). El bucket todavía no existe; es el
  mismo pendiente que las imágenes de difusión.
- `contenido` admite hasta 20 000 caracteres (difusión, 10 000): un artículo es más largo que un aviso.

## Entorno y comandos

PostgreSQL 17 local desechable (Docker, misma versión mayor que Supabase). La suite crea su base y la borra. No se usó Supabase.

```powershell
cd backend
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<clave>@localhost:55432/postgres'
node --test test/investigaciones-publicas-postgres.test.mjs
```

Datos de prueba: un artículo cargado con 001–022 (sin estado) y los permisos por defecto de Supabase para `anon` y
`authenticated`; después se aplica la 023. Artículos ficticios de marketing y administración.

## Matriz de pruebas

| # | Criterio (FE-116 / FE-182 §6) | Comprobación | Resultado |
|---|---|---|---|
| 1 | Migración sobre datos existentes | El artículo previo queda en borrador con su título, contenido, creador y fecha; no aparece en la vista; publicarlo exige resumen | ✔ |
| 2 | Alta en borrador | Estado borrador, creador = quien lo registra; `autor_id`, fechas de publicación y `creado_en` enviados por el cliente se ignoran; nacer publicado o retirado → `23514` | ✔ |
| 3 | Validación | Título vacío o de 151; contenido vacío o de 20 001; resumen de 501; autor visible vacío o de 151; ruta con `..`, absoluta o con espacios; ruta sin texto alternativo; texto o medidas sin ruta; ancho 0; texto alternativo de 301; estado desconocido → `23514`. Título o contenido nulos → `23502`. Límites exactos aceptados | ✔ |
| 4 | Publicación en borrador o retirada no aparece | Publicar sin resumen falla y conserva el borrador; retirado y vuelto a borrador no aparecen | ✔ |
| 5 | Publicada y autorizada, visible | Vista con título, resumen, contenido, autor visible, fecha en Bolivia e imagen; editar lo publicado conserva fecha y autor de publicación; retirar la saca; republicar actualiza la fecha | ✔ |
| 6 | Transiciones | Borrador → retirado, publicado → borrador y retirado → publicado → `23514` | ✔ |
| 7 | Visitante no gestiona | Terapeutas, usuario inexistente, marketing inactivo o sin `app.usuario_id` → `42501` al crear, publicar o eliminar; nada cambia | ✔ |
| 8 | Conservar lo publicado | Se elimina un borrador nunca publicado; publicado, retirado o vuelto a borrador después de publicarse → `23514` | ✔ |
| 9 | Campos públicos | Vista con 11 columnas fijas, sin estado, creador ni fechas internas; cuenta igual a los publicados | ✔ |
| 10 | Comentarios no habilitados | Ninguna vista usa `comentarios_foro`; `anon`/`authenticated` sin acceso a artículos, comentarios ni vista aun con los permisos por defecto de Supabase; FK solo a `perfiles`; RLS activo | ✔ |
| 11 | Auditoría | Alta y publicación con su autor y estados antes/después | ✔ |

Comprobación de las pruebas: se quitaron o alteraron a propósito, una por vez, el filtro de publicados de la vista, el
control de rol, el bloqueo de borrado, la lista de transiciones, la protección de la fecha de publicación, la protección del
creador, el creador puesto por la base, el inicio en borrador, el resumen para publicar, las columnas de la vista, el retiro de
permisos a `anon` y a los comentarios, y la fecha en Bolivia: las 13 mutaciones hicieron fallar al menos una prueba.

## Resultado observado

| Comando | Resultado |
|---|---|
| `npm run build` (backend) | OK |
| `npm run test:unit` | 279/279 |
| `node --test --test-concurrency=1 test/*.test.mjs` con todas las suites de PostgreSQL | 438 pass, 0 fail, 13 skip (12 requieren Supabase Auth real, 1 variante sin la 012) |
| `investigaciones-publicas-postgres.test.mjs` | 11/11 |
| Frontend | Sin cambios |

## Pendiente

- **FE-182 / FE-116:** registrar en Jira el alcance sin comentarios (decisión del equipo del 26/11/2026).
- **FE-184:** gestión interna y lectura pública sobre este flujo (README «Investigaciones públicas»).
- **FE-187:** conectar `ListadoInvestigaciones`/`TarjetaInvestigacion` y el detalle con la API; sin formulario de comentarios.
- **FE-185:** artículos ficticios de QA y recorrido borrador → publicado → retirado.
- Imágenes: falta el bucket `difusion-publica` (mismo pendiente que difusión).
- Supabase: 023 no aplicada. Comprobación previa de solo lectura (26/11/2026): `publicaciones_foro` y `comentarios_foro`
  vacías, sin nombres en uso. Requiere antes la 022 (ya aplicada).

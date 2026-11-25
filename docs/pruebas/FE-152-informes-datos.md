# FE-152 — Persistencia y fotografía de datos para informes

Historia FE-15 · Insumo [FE-151](../srs/sprint-3/FE-151-plantillas-informes.md) (PR #50, propuesta pendiente de ratificar) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-152-fotografia-informes` sobre `main` en `503987b` (con FE-125). Solo base de datos y pruebas; la generación
y revisión por API es de FE-153 (PR #56) y la interfaz de FE-154.

| Archivo | Cambio |
|---|---|
| `db/migrations/016_fotografia_informes.sql` | Tablas `informe_versiones` e `informe_version_sesiones`; función `fotografia_informe`; comprobación de la fotografía al guardar; reglas de borrador/revisado; `informe_version_al_dia`; auditoría y RLS |
| `backend/test/informes-postgres.test.mjs` | Casos ficticios A y B de FE-151 §6, cruces entre casos, versiones, migración sobre datos existentes |
| `db/migrations/README.md` | Modelo y forma de guardar para FE-153 |

Decisiones tomadas de FE-151 (propuesta pendiente de ratificar con la Fundación):

- `informes` (ya existía en 001, sin uso) es la cabecera: caso, tipo y autor. Cada generación es una fila de `informe_versiones`.
- La fotografía (`datos_origen`) es una copia de los datos usados. No cambia nunca; si el expediente cambia se genera otra versión.
- Diagnóstico: fuente vigente de FE-125 (`v_fuente_clinica_vigente`): ficha, alta como antecedente o sin datos.
- Sesiones: las elegidas, sin repetir y en orden de fecha y número; cada una con todas sus tareas (mismo orden que historial).
- Familia y genograma solo si se piden. Del genograma se guarda la referencia al archivo vigente y su `sha256`, no el archivo.
- Estados `borrador` y `revisado`. Revisar es definitivo; un borrador se puede descartar. Un solo borrador abierto por informe.
- Sin conclusiones automáticas: el texto (`secciones`) lo escribe la profesional y cada cambio queda en `auditoria`.

## Cómo se evita mezclar casos y fuentes antiguas

| Riesgo | Protección |
|---|---|
| Sesión de otro caso en la fotografía | `fotografia_informe` la rechaza (`23514`); `informe_version_sesiones` tiene FK `(sesion_id, caso_id)` |
| Versión colgada del informe de otro caso | FK `(informe_id, caso_id)` → `informes (id, caso_id)` (`23503`) |
| Fotografía de otro caso o con texto alterado | Al guardar, la base recalcula la fotografía con la misma selección y exige que sea igual (`23514`) |
| Diagnóstico cambiado entre leer y guardar | La misma comprobación la rechaza: hay que leerla de nuevo |
| Ficha de diagnóstico de otro caso | FK `(ficha_diagnostico_id, caso_id)` → `fichas_diagnostico (id, caso_id)` |
| Genograma de otro caso | La clave debe ser `<caso_id>/<uuid>`, igual que en `genograma_archivos` (012) |
| Cambio posterior del expediente | La versión guardada no se toca; `informe_version_al_dia` pasa a false y se genera otra versión |
| Zona horaria de la conexión | Los instantes se guardan en UTC con formato fijo: la comparación no depende de la sesión |

## Entorno y comandos

PostgreSQL 16 local desechable (Docker). Cada suite crea su base y la borra. No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55152/postgres \
  node --test test/informes-postgres.test.mjs
```

## Matriz de pruebas

Casos ficticios: **A** (voluntario, terapeuta t1) con ficha de diagnóstico, tres sesiones registradas fuera de orden,
tres tareas y familia de dos integrantes; **B** (derivado, terapeuta t2) sin ficha, con diagnóstico de alta,
contexto judicial y una sesión.

| # | Criterio (FE-151 §6) | Comprobación | Resultado |
|---|---|---|---|
| 1 | A con diagnóstico y dos sesiones: cita solo esos registros y en orden | Se piden s2, s1, s2: quedan s1 y s2 por fecha, con sus tareas en orden; diagnóstico de la ficha; responsable t1; familia y genograma null | ✔ |
| 2 | B sin ficha: identifica ausencias, no toma datos de A | Origen `alta` con el diagnóstico del alta, `fichaId` null, contexto judicial de B, familia `{ registrada: false }`; ningún id, nombre ni texto de A en la fotografía | ✔ |
| 3 | Sin cruces | Sesión de B en fotografía de A y sesión inexistente → `23514`; caso inexistente → `P0002` | ✔ |
| 4 | Familia incluida | Versión 1 de la ficha familiar e integrantes en orden de registro | ✔ |
| 5 | Guardar con trazabilidad | Borrador nº 1, `creado_por` y `generado_por` = t1, `ficha_diagnostico_id` = ficha de A, sesiones citadas en orden y del caso, `huella_origen` = sha256 del JSON guardado, al día | ✔ |
| 6 | No inventar ni mezclar | Rechazados (`23514`): diagnóstico alterado, sesión de B añadida, fotografía de B en informe de A, fotografía tomada antes de corregir el diagnóstico. Versión del caso B en informe de A → `23503`. Con la fotografía nueva se guarda | ✔ |
| 7 | Editar un borrador conserva autor y fuente | Administración edita el texto: `actualizado_por` = admin, `creado_por` = t1, el texto anterior queda en `auditoria`. Segundo borrador → `23505`; cambiar la fotografía → `23514`; crear ya revisado → `23514` | ✔ |
| 8 | Cambiar diagnóstico después de revisar | Revisar pone `revisado_por/en`. Después: editar, volver a borrador, eliminar la versión o sus sesiones → `23514`. Tras corregir el diagnóstico, la v1 conserva el anterior y deja de estar al día; la v2 usa el nuevo; la v1 sigue revisada | ✔ |
| 9 | Descartar borrador | Se elimina con sus sesiones citadas y queda en `auditoria` | ✔ |
| 10 | Registros citados protegidos | Borrar una sesión citada → `23503`; cambiar tipo o caso del informe → `23514` | ✔ |
| 11 | Zona horaria | Desde una conexión en `Asia/Tokyo` la versión sigue al día y los instantes coinciden | ✔ |
| 12 | Genograma sin la 012 | Pedirlo → `0A000` (no se omite en silencio) | ✔ (sin 012) |
| 13 | Genograma con la 012 | B sin archivo → `{ vigente: false }`. A con archivo activado: clave, nombre, tipo y sha256 del archivo, sin contenido; la versión guarda `genograma_clave` | ✔ (con 012) |
| 14 | Seguridad | RLS activa en las tablas nuevas; las funciones no son `SECURITY DEFINER` | ✔ |
| 15 | Migración sobre datos existentes | Base con 001–015, caso, sesión e informe antiguo: tras la 016, `informes`, `casos`, `fichas_seguimiento` y `auditoria` iguales (md5 y cantidad) | ✔ |

Pruebas 12 y 13 se excluyen entre sí: en `main` (sin 012) corre la 12 y se omite la 13; con la 012 de FE-130 corre la 13 y se omite la 12.
Las dos se ejecutaron.

Gate:

| Comprobación | `main` + 016 | `main` + 012 (FE-130) + 016 |
|---|---|---|
| backend `npm run build` | ✔ | — |
| backend `npm run test:unit` | 240/240 | — |
| backend integración (todas las suites PG, `--test-concurrency=1`) | 316 ✔, 0 ✖, 1 omitida (13) | 316 ✔, 0 ✖, 1 omitida (12) |
| frontend `lint`, `build`, `test` | ✔, ✔, 156/156 | — |

## Para FE-153 (API)

En una transacción con `app.usuario_id` (como `db.transaction`):

```sql
insert into informes (caso_id, tipo) values ($1, 'judicial') returning id;      -- una vez por informe
select fotografia_informe($1, $2::uuid[], $3, $4) as datos;                    -- caso, sesiones, familia, genograma
-- con datos se arman las secciones (prepararBorrador)
insert into informe_versiones (informe_id, caso_id, version_plantilla, datos_origen, secciones)
values ($1, $2, $3, $4, $5) returning id, nro_version, estado;
```

- `datos_origen` = el `origen` de `prepararBorrador` sin cambios. Si la base responde `23514` al guardar, los datos cambiaron
  o la fotografía no es del caso: leer de nuevo y regenerar.
- Revisar: `update informe_versiones set estado = 'revisado' where id = $1`. Editar texto: `update ... set secciones = $2`.
- Errores: `23514` → 400 (o 409 si la fotografía quedó desactualizada), `23505` → 409 (ya hay un borrador), `23503` → 404,
  `P0002` → 404, `0A000` → genograma aún no disponible.
- La autorización (asignada o administración; marketing y terapeuta ajena → 404) sigue en la API: `obtenerCarpetaAutorizada`.

## Pendiente

- Ratificar con la Fundación plantillas, mínimos y política de revisión (FE-151). El modelo no fija campos por plantilla:
  los mínimos los valida FE-153.
- FK estricta de `genograma_clave` a `genograma_archivos` cuando la 012 esté en `main` (hoy: misma regla de clave por caso).
- Aplicar la 016 en Supabase después de la 015.

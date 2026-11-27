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
   | `migrations/012_genograma_archivos.sql` | FE-130: archivo privado del genograma (PDF/PNG/JPEG) con versiones; `genogramas.archivo_clave` apunta al vigente |
   | `migrations/013_residencia_pacientes.sql` | FE-135: ciudad de residencia del paciente y `indicadores_por_residencia(desde, hasta)` |
   | `migrations/014_difusion_publicaciones.sql` | FE-142: publicaciones de difusión, imágenes y vista pública `v_publicaciones_publicas` |
   | `migrations/015_familiares_caso.sql` | FE-125: composición familiar por caso y vista `v_fuente_clinica_vigente` |
   | `migrations/016_fotografia_informes.sql` | FE-152: versiones de informes con la fotografía de los datos usados y `fotografia_informe(...)` |
   | `migrations/017_importacion_historica.sql` | FE-163: lotes de importación histórica, coincidencias y `confirmar_importacion(...)` |
   | `migrations/018_investigacion_categorias.sql` | FE-168: categorías de investigación, selección autorizada y paquete para Atlas.ti con manifiesto |
   | `migrations/020_registro_exportaciones.sql` | FE-158: exportaciones PDF/Word de informe revisado, ficha o historial con sus datos, archivo privado y trazabilidad (019 la usa FE-169) |
   | `migrations/022_gastos_funcionamiento.sql` | FE-173: gastos de funcionamiento en `movimientos_contables` (egreso), corrección y anulación con auditoría, `consultar_gastos_mes(mes)` |

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

   ## Genograma (FE-130)

   ```
   casos 1 ─ n    genograma_archivos   (una fila por archivo subido; contenido bytea inmutable)
         1 ─ 0..1 genogramas           (archivo_clave = versión vigente)
   ```

   - La clave es `<caso_id>/<uuid>`. Un check y la FK compuesta `(archivo_clave, caso_id)` impiden usar el archivo de otro caso.
   - Primero se guarda el archivo sin activar; luego, en una transacción, se activa (nombre, autor, fecha) y se cambia la referencia. Si falla, el vigente anterior no cambia.
   - Las versiones anteriores se conservan. No se borra el archivo vigente (FK `restrict`).
   - Archivos que nunca se activaron (carga fallida), descartables: `select clave from genograma_archivos where activado_en is null and creado_en < now() - interval '1 day'`.
   - `sha256` es una columna generada. Comprobación de integridad: `select clave from genograma_archivos where sha256 <> sha256(contenido)` debe devolver 0 filas.
   - `genograma_archivos` no tiene trigger de auditoría (copiaría el archivo entero); el cambio de vigente se audita en `genogramas`.
   - Respaldo y recuperación: los archivos están en la base, así que un `pg_dump` los incluye. Restaurar y correr la comprobación de integridad anterior. Procedimiento probado en `docs/pruebas/FE-130-almacenamiento-genograma.md`.

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

   ## Informes (FE-152)

   Plantillas de FE-151. Cada generación guarda una copia de los datos usados; un cambio posterior del expediente no la altera.

   ```
   informes 1 ─ n informe_versiones           (borrador → revisado; datos_origen = fotografía)
                    1 ─ n informe_version_sesiones   (sesiones citadas, mismo caso, en orden)
   ```

   - `fotografia_informe(caso, sesiones[], incluirFamilia, incluirGenograma)` devuelve en un jsonb: caso, paciente, responsable actual,
     diagnóstico vigente (`v_fuente_clinica_vigente`: `origen` ficha / alta / sin_datos), contexto judicial, `seleccion`,
     sesiones elegidas (sin repetir, por fecha y número) con sus tareas, y familia y genograma si se piden (null = no incluido).
     Sesión de otro caso o inexistente → `23514`; caso inexistente o eliminado → `P0002`. El genograma requiere la 012 (si falta, `0A000`).
   - Guardar (FE-153), en una transacción con `app.usuario_id`: `insert into informes (caso_id, tipo)` y
     `insert into informe_versiones (informe_id, caso_id, version_plantilla, datos_origen, secciones)` con `datos_origen` =
     el resultado de `fotografia_informe`. La base comprueba que la fotografía es igual a los datos actuales del caso:
     alterada, de otro caso o desactualizada → `23514` (volver a leerla y regenerar). Informe de otro caso → `23503`.
   - La base pone `nro_version`, `creado_por`, `generado_por`, `revisado_por/en` y llena `informe_version_sesiones`.
     `ficha_diagnostico_id` y `genograma_clave` salen de la fotografía.
   - `secciones` (`[{ titulo, contenido }]`) se edita solo en borrador; cada cambio queda en `auditoria` con su autor.
     `estado = 'revisado'` es definitivo: después no se edita ni se elimina (`23514`). Un borrador se puede eliminar.
     Un solo borrador abierto por informe (`23505`).
   - `informe_version_al_dia(version)` → false si el expediente cambió desde la fotografía (para avisar y ofrecer otra versión).
   - El caso, el tipo y el autor de un informe no cambian. `informes.formato` y `archivo_path` quedan para la exportación (FE-158).

   ## Importación histórica (FE-163)

   Mapeo de FE-162 (propuesta). Plantilla y muestras ficticias en `db/importacion/`. La importación solo inserta
   pacientes y casos: no modifica, fusiona ni borra registros existentes.

   ```
   importaciones 1 ─ n importacion_filas   (en_revision → confirmada | descartada; datos = fila leída)
   importacion_filas → pacientes, casos    (resultado: creada | vinculada | excluida)
   ```

   Flujo para la API (FE-164), cada paso en una transacción con `app.usuario_id` de administración:

   1. **Cargar:** `insert into importaciones (perfil_id, archivo_nombre, formato, archivo_sha256, origen)` y una fila de
      `importacion_filas (importacion_id, numero_fila, referencia_origen, datos)` por línea, con `datos` = `{ columna: texto }`
      de la plantilla (`importacion_columnas()`; encabezado = línea 1). Luego `select clasificar_importacion(id)`.
      Si es la misma transacción, la versión queda en 1. Archivo ya importado:
      `select id from importaciones where archivo_sha256 = $1 and estado = 'confirmada'`.
   2. **Vista previa:** `importacion_filas` con `estado` (`valida_nueva`, `error`, `posible_duplicado`, `duplicado_en_lote`),
      `errores` (`[{ campo, mensaje }]`), `coincidencias`, `advertencias` y `decision`, más `importaciones.version`.
      Coincidencias por `tipo`: `carpeta` (mismo origen y número que un caso, también eliminado), `ya_importada`
      (misma fila en un lote confirmado), `referencia` (misma referencia con otros datos), `nombre` (similitud > 0.6,
      como el alta manual) y `fila` (otra fila del lote; `mismoNumero` indica choque de número).
      Advertencia `contador`: el número supera el último del tipo y el contador avanzará.
   3. **Decidir o corregir:** `update importacion_filas set decision = ...` (`crear`, `excluir` o `vincular` con uno de
      `caso_destino_id`, `paciente_destino_id`, `fila_destino`). Para corregir, cambiar `datos` y volver a clasificar.
      Las filas válidas reciben `crear`; si cambian su estado o coincidencias, la decisión se borra y se vuelve a pedir.
      La base pone `decidido_por/en` y sube `version` una vez por transacción.
   4. **Confirmar:** `select confirmar_importacion(id, version, aceptaAvance)` aplica todo el lote o nada. Devuelve el resumen
      (`creadas`, `vinculadas`, `excluidas`, `filas` con `pacienteId`, `casoId` y número) o `{ estado: 'revisar', filas, version }`
      si al volver a clasificar cambió algo (la nueva clasificación queda guardada). Repetirlo sobre un lote confirmado
      devuelve el mismo resumen sin escribir nada.
      Si los números propios harían saltar un contador (dejar huecos, p. ej. de 10 a 900001), con `aceptaAvance = false`
      (por defecto) se detiene con `FEI04`; la API muestra el salto y vuelve a confirmar con `true` solo si administración
      lo acepta. Números consecutivos al último o por debajo de él no lo requieren. Queda en `acepta_avance_contador`.

   | Decisión | Efecto |
   |---|---|
   | `crear` | Paciente y caso nuevos (número propio o el del contador), residencia y contexto judicial si hay |
   | `vincular` + `caso_destino_id` | Nada se escribe en el caso: la fila queda como antecedente de origen |
   | `vincular` + `paciente_destino_id` / `fila_destino` | Caso nuevo del paciente existente o del creado por esa fila; el paciente no cambia |
   | `excluir` | No se importa; queda registrada |

   - Errores para traducir: `FEI01` versión desactualizada → 409; `FEI02` filas sin resolver → 400 (DETAIL: JSON
     `[{ numeroFila, motivo }]`); `FEI03` lote descartado → 409; `FEI04` salto del contador sin aceptar → 409 (DETAIL:
     JSON `[{ tipo, ultimoActual, nuevoUltimo }]`); `P0002` → 404; `42501` falta `app.usuario_id`.
   - Lote confirmado o descartado: no se modifica ni elimina (`23514`). Descartar: `update importaciones set estado = 'descartada'`.
   - Solo el backend accede (RLS, sin permisos para `anon`/`authenticated`). Que sea solo administración lo controla la API.

   ## Investigación y paquete para Atlas.ti (FE-168)

   Propuesta de FE-167 (catálogo, perfiles e identificadores pendientes de ratificar). El sistema prepara documentos
   DOCX/TXT y un manifiesto; no exporta códigos ni proyectos de Atlas.ti.

   ```
   categorias_investigacion 1 ─ n categorias_investigacion   (padre_id; sin ciclos)
                            1 ─ n caso_categorias            (en el caso, su diagnóstico o una sesión del mismo caso)
   exportaciones (tipo atlas_ti) 1 ─ n exportacion_documentos  (INV-001 ↔ caso, solo en el sistema)
   ```

   - **Catálogo:** `codigo` (`QA-CAT-01`; mayúsculas, números y guiones; no cambia), `nombre` único en su nivel sin distinguir
     mayúsculas, `activa`. Una categoría con etiquetas o subcategorías no se borra (`23503`): se retira con `activa = false`.
   - **Etiquetas:** `insert into caso_categorias (caso_id, categoria_id, ficha_diagnostico_id | ficha_seguimiento_id, fragmento, nota)`.
     Ficha de otro caso → `23503`; la misma categoría en el mismo destino → `23505`; categoría retirada, carpeta dada de baja
     o cambio de caso/categoría/ficha → `23514`. La base pone `etiquetado_por`; `fragmento` y `nota` se editan.
   - **Alcance:** administración, todos los casos activos; terapeuta, sus casos asignados; marketing o cuenta inactiva, ninguno.
   - `seleccion_investigacion(perfil, categorias[], desde, hasta, residencias[])`: casos del alcance con `tipo`, número,
     `categorias` (códigos), `sesiones_en_periodo` y `tiene_diagnostico`. Categorías: cualquiera de las elegidas, con sus
     subcategorías. Período: al menos una sesión entre las fechas (inclusivas). Residencias: `la_paz`, `el_alto`, `otra`,
     `sin_registrar`. Filtro inválido → `22023`.
   - `conteo_categorias(perfil, desde, hasta, residencias[])`: todo el catálogo con casos y etiquetas por ámbito (caso,
     diagnóstico, sesión) dentro del alcance; no suma subcategorías.

   Flujo para la API (FE-169), cada paso en una transacción con `app.usuario_id`:

   1. **Preparar:** `select preparar_exportacion_investigacion(casos[], secciones[], formato, desde, hasta, criterios)` → id.
      Secciones `diagnostico`, `seguimiento`, `tareas` (con seguimiento); formato `docx` o `txt`; `criterios` = filtros usados
      (jsonb, para trazabilidad). Un caso inexistente, dado de baja o no autorizado anula todo (`P0002` → 404); marketing o
      sin `app.usuario_id` → `42501`. Numera `INV-001…` sin seguir el número de carpeta.
   2. **Vista previa y revisión:** `manifiesto_exportacion(id)` y `datos_documento_investigacion(id, 'INV-001')`. Solo los lee
      quien preparó el paquete o administración, y solo si el caso sigue autorizado (si no, `P0002`). Mostrar el texto libre
      (evolución, fragmentos, notas) para revisar nombres u otros identificadores: la base no los quita.
   3. **Confirmar revisión:** `select marcar_revision_exportacion(id)` (una vez; repetir → `23514`).
   4. **Generar y registrar:** con los mismos datos, un archivo por documento con el nombre de `archivo` y `manifiesto.json`;
      después `update exportaciones set archivo_path = ...` (antes de revisar → `23514`).

   - **Manifiesto** (`formatoVersion: 1`): `formato`, `periodo`, `catalogo` (`[{ codigo, nombre, descripcion, padre }]` de las
     categorías usadas y sus superiores) y `documentos` (`[{ idExportacion, archivo, categorias, secciones }]`).
     Sin id del paquete, casos, carpetas ni personas.
   - **Documento:** `categorias` (`[{ codigo, nombre, ambito, nroSesion, fragmento, nota }]`), `diagnostico` (fuente vigente)
     y `seguimiento` (`[{ nroSesion, mes, evolucion, tareas? }]`, mes `AAAA-MM`). Nunca nombres, teléfono, nacimiento,
     residencia, número de carpeta, datos judiciales, familia, pagos ni responsables.
   - **Correspondencia:** un documento por caso y por archivo; las categorías del manifiesto son las de su documento (las del
     caso, las de su diagnóstico si se exporta y las de sus sesiones del período si se exporta seguimiento). Si cambian
     después de preparar, manifiesto, documento y revisión fallan con `FEX01` → 409 (DETAIL: JSON con los `idExportacion`):
     preparar otro paquete.
   - Un paquete preparado no cambia ni pierde documentos (`23514`); se puede eliminar completo.

   ## Exportación de documentos PDF y Word (FE-158)

   Propuesta de FE-156. Cada exportación de un informe revisado, una ficha o un historial es una fila de `exportaciones`
   (tipo `pdf` o `word`) con el caso, quién la preparó, los parámetros, los datos exactos del documento y su archivo.

   ```
   exportaciones (pdf | word) → casos                  (siempre un caso; los datos son de ese caso)
                              → informe_versiones      (solo documento = informe; versión revisada del mismo caso)
   estado: preparada → generada (archivo registrado) | fallida (error del generador)
   ```

   - **Parámetros** (`formatoVersion: 1`): `documento` (`informe`, `ficha`, `historial`), `formato` (`pdf`, `docx`), `secciones`,
     `informeVersionId`, `incluirGenograma`, `incluirPagos`. La base los guarda en forma canónica; una clave desconocida → `22023`.
     - Informe: solo `informeVersionId`. Se exporta tal como se revisó (texto y fotografía de `informe_versiones`); no se regenera
       aunque el expediente cambie. Versión en borrador → `23514`; de otro caso o inexistente → `P0002`.
     - Ficha: `identificacion`, `familia`, `diagnostico` (por defecto identificación y diagnóstico).
     - Historial: además `sesiones` (por defecto las cuatro). `incluirPagos` solo aquí y solo administración (`42501`).
     - `incluirGenograma` requiere la 012 (si falta, `0A000`).
   - **Datos** (`datos_origen`): `documento`, `caso` (siempre), `seleccion` y las claves de las secciones pedidas: `paciente`,
     `responsable`, `judicial` (identificación), `familia`, `diagnostico` (fuente vigente), `sesiones` (todas, por fecha y número,
     con tareas), `genograma`, `pagos` (`[{ fecha, monto: "50.50", moneda, metodo, referencia, nroSesion, sesionId }]`).
     Se leen una sola vez, al preparar, en una misma instantánea (reutiliza `fotografia_informe`). El archivo se genera desde aquí.
   - **Alcance:** administración, cualquier caso activo; terapeuta, sus casos asignados. Caso ajeno, dado de baja o inexistente →
     `P0002` (404); marketing, cuenta inactiva o sin `app.usuario_id` → `42501`.

   Flujo para la API (FE-159/FE-160), cada paso en una transacción con `app.usuario_id`:

   1. **Vista previa (opcional):** `select datos_exportacion_actuales(caso, parametros)` devuelve los datos que se registrarían.
   2. **Preparar:** `select preparar_exportacion_documento(caso, parametros, datosMostrados)` → id. Con `datosMostrados` (la vista
      previa), si el expediente cambió entretanto → `23514`: volver a pedir la vista previa. Sin él, usa los datos actuales.
   3. **Generar:** `datos_exportacion_documento(id)` → `{ exportacionId, documento, formato, estado, archivoNombre, archivoPath, datos }`.
      Generar el archivo desde `datos` y guardarlo en `archivoPath` (`<caso_id>/<id>.pdf|.docx`, privado).
   4. **Registrar:** `select registrar_archivo_exportacion(id, sha256Hex, bytes)` (tamaño 0 → `22023`) o, si el generador falla,
      `select registrar_fallo_exportacion(id, mensaje)`. Una vez; después `23514`. Para reintentar, preparar otra exportación.
   5. **Descargar:** `archivo_exportacion(id)` → `{ archivoPath, archivoNombre, tipoContenido, bytes, sha256 }`. Sin archivo
      registrado → `55000` (409). Comprobar el sha256 al leer el archivo.

   - **Lectura** (pasos 3–5): quien la preparó o administración, mientras el caso siga autorizado; con pagos, solo administración.
     Si no, `P0002`. El nombre de descarga (`exportacion-<id>.pdf`) no tiene datos personales.
   - **Trazabilidad:** `select * from exportaciones_documentos_caso(caso)`: documento, formato, versión del informe, secciones,
     pagos/genograma, autor, fecha, estado y nombre. Administración ve todas las del caso; terapeuta, las suyas. Cada alta y cierre
     queda además en `auditoria`.
   - Una exportación no cambia ni se elimina (`23514`). La ruta del archivo la fija la base: no se registra bajo otro caso.
   - `informes.formato` y `archivo_path` quedan sin uso: un informe puede exportarse varias veces, cada una con su fila.

   ## Gastos de funcionamiento (FE-173)

   Contrato de FE-172 (HU5). Un gasto es una fila de `movimientos_contables` con `tipo = 'egreso'`; los ingresos no cambian.
   No hay distribución de ingresos.

   | Columna | Regla |
   |---|---|
   | `categoria` | `internet`, `electricidad`, `alquiler` u `otros`. Obligatoria. |
   | `fecha` | Obligatoria, desde 2000-01-01 y no futura (hora de Bolivia). Sin valor por defecto: la envía la API. El mes sale de esta fecha. |
   | `monto` | Positivo, hasta dos decimales, máximo 99999999.99. Un tercer decimal se rechaza; no se redondea. Se guarda con dos decimales. |
   | `descripcion` | Hasta 200 caracteres, no solo espacios. Obligatoria para `otros`. |
   | `pago_id` | Siempre NULL en un gasto: no es un pago de sesión. |
   | `registrado_por`, `creado_en`, `actualizado_por`, `actualizado_en` | Los pone la base desde `app.usuario_id`; lo que envíe el cliente se ignora. |
   | `anulado_en`, `anulado_por`, `motivo_anulacion` | Los pone `anular_gasto`. Motivo opcional, hasta 200. |

   Flujo para la API (FE-174), cada paso en una transacción con `app.usuario_id`:

   - **Registrar:** `insert into movimientos_contables (tipo, categoria, fecha, monto, descripcion) values ('egreso', ...) returning *`
     y responder con `select gasto_json(m) from movimientos_contables m where id = $1`.
   - **Consultar:** `select consultar_gastos_mes('2026-11')` (null = mes actual en Bolivia) devuelve
     `{ mes, gastos: [gasto], totalMes, cantidadVigentes, cantidadAnulados, totalesPorCategoria: [{ categoria, cantidad, total }] }`.
     Los anulados aparecen en `gastos` con `anulado: true`, pero no suman. Las cuatro categorías aparecen siempre, en el orden del contrato.
     Montos como texto con dos decimales (`"1700.00"`). Mes que no sea `AAAA-MM` → `22023` (400).
   - **Corregir:** `update movimientos_contables set categoria/fecha/monto/descripcion ... where id = $1 and tipo = 'egreso' returning *`
     (0 filas = 404). Si cambia la fecha a otro mes, el gasto sale de un total y entra en el otro.
   - **Anular:** `select anular_gasto(id, motivo)`. Repetirlo devuelve el mismo gasto sin escribir ni restar otra vez.
     Inexistente o un ingreso → `P0002` (404).

   - Solo administración activa: otro rol, cuenta inactiva o sin `app.usuario_id` → `42501` (403), también al consultar.
   - Un gasto anulado no se modifica y ningún gasto se elimina (`23514`). Cambiar el `tipo` de un movimiento → `23514`.
   - Errores para traducir: `23514` y `23502` → 400, `22008` (fecha imposible) → 400, `42501` → 403, `P0002` → 404.
   - Cada alta, corrección y anulación queda en `auditoria` con su autor (trigger de la 001).

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
   | FE-152 | `informes-postgres.test.mjs` (aplica la 016 sobre una base con datos existentes) |
   | FE-168 | `investigacion-postgres.test.mjs` (aplica la 018 sobre una base con datos existentes) |
   | FE-158 | `exportaciones-postgres.test.mjs` (aplica la 020 sobre una base con datos existentes) |
   | FE-173 | `gastos-postgres.test.mjs` (aplica la 022 sobre una base con datos existentes) |

   | FE-130 | `genograma-postgres.test.mjs` (también la API con base real) |

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

## Actualización y recuperación (FE-197)

Guía completa: `docs/operacion/sprint-3/actualizacion-y-recuperacion.md`.

- Antes de aplicar en Supabase: respaldo del esquema `public` con `pg_dump` 17, ensayo local y prueba en seco con `rollback`.
- Comprobar si una migración está aplicada con un objeto que **ella crea** (012 → `genograma_archivos`, no `genogramas`).
- Revertir = restaurar el respaldo previo. Restaurar en tres secciones (`pre-data`, `data`, `post-data`);
  fuera de Supabase, llenar `auth.users` desde `perfiles` antes de `post-data`.
- El respaldo incluye los archivos de genograma (bytea). No incluye `auth.users` ni archivos de Supabase Storage.
- Ensayo automático (PostgreSQL local): `backend/scripts/ensayo-actualizacion.mjs`.

## Evaluación inicial independiente (021 · FE-126)

Aplicar `021_evaluacion_inicial.sql` después de la 020 y antes de desplegar la API nueva. Añade la evaluación a la vista y a las fotografías; no ejecuta UPDATE sobre fichas ni transforma comentarios/diagnósticos antiguos. Las fotografías sin evaluación conservan su estructura, y los informes revisados y archivos anteriores no se reescriben.

El PUT de la API pide evaluación al crear o editar; las fichas antiguas siguen siendo legibles. Se probó la 021 sobre una base con ficha histórica e informe revisado, verificando igualdad del JSON, fotografía e informe previo. Ver [evidencia](../../docs/pruebas/sprint-3/evaluacion-inicial.md). Esta ejecución se hizo en PostgreSQL local; no acredita aplicación de la migración en Supabase.

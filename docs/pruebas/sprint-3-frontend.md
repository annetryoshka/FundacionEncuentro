# Sprint 3 · Frontend integrado (FE-127, FE-132, FE-138, FE-144, FE-149, FE-154, FE-160, FE-165, FE-170, FE-199)

**Responsable:** Jorge Manuel Calizaya Tito (frontend y QA).
**Fecha:** 26/11/2026.
**Estado:** el frontend está implementado y se probó contra el backend real. El backend de estas pruebas fusiona los PR #51, #54, #56, #60, #62, #63, #64 y #65 y la rama `feature/FE-159-exportacion-pdf-docx`, todavía sin fusionar en `main`. Se usó PostgreSQL 16 con las migraciones 001–020. La autenticación fue un Supabase de prueba local. Todos los datos son ficticios.

## 1. Qué incluye

| Subtarea | Pantallas | API |
|---|---|---|
| FE-138 Residencia | Alta y edición del paciente (`SelectorResidencia` de Gemina); etiqueta en el listado, el encabezado y el resumen; filtro `?residencia=` combinado con los demás, que vuelve a la página 1; tabla por residencia en Indicadores (tarjetas en móvil). | `POST /casos` y `PATCH /carpetas/:id` (envían nombre, fecha y residencia juntos), `GET /carpetas?residencia=`, `GET /indicadores/por-residencia` |
| FE-127 Familia y orden de la ficha | `/carpetas/:id/familia`: filas editables (parentesco respecto del paciente, «otro» con descripción, nacimiento, edad referida con su fecha o edad desconocida, ocupación, convivencia, observaciones). Además: quitar con «Deshacer», cancelar, 409 sin perder lo escrito. En la carpeta, la tarjeta «Contexto del paciente» (familia, genograma y diagnóstico vigente) va antes de los apartados. El orden de los apartados pone primero familia, genograma y diagnóstico, y después el historial. | `GET/PUT /carpetas/:id/familia` (`version`, `eliminarIds`; solo se envían los integrantes nuevos o cambiados), `GET /carpetas/:id/diagnostico/vigente` |
| FE-132 Genograma | `/carpetas/:id/genograma`: carga multipart, validación en el navegador (formato y 5 MB), mensajes para 400, 413 y 415. Visor de imagen con «Ampliar» (Esc cierra y el foco vuelve) y de PDF (`<object>`, abrir en otra pestaña, descargar). Un reemplazo rechazado conserva el anterior. | `PUT/GET /carpetas/:id/genograma`, `GET …/genograma/archivo` (blob privado con token) |
| FE-144 Difusión | `/difusion` (filtros por estado y tipo en la URL), `/difusion/nueva`, `/difusion/:id`: formulario, vista previa con la tarjeta de Gemina, ciclo borrador → publicada → retirada → borrador, 422 `camposFaltantes`, 409, imagen principal (solo metadatos). | `/difusion/publicaciones…` |
| FE-149 Portal público | `/publicaciones` (filtro por tipo y paginación) y `/publicaciones/:id`, sin sesión ni navegación clínica. Borrador, retirada o id inválido se muestran como «no disponible». El login enlaza al portal. | `/publico/publicaciones…` (sin token) |
| FE-154 Informes | `/carpetas/:id/informes` (plantilla, sesiones, familia, genograma, objeto del judicial; 422 con enlace a «Origen y consentimiento») y `/carpetas/:id/informes/:versionId` (vista previa, corrección, «Guardar como revisado» con confirmación, 409). Solo la terapeuta asignada. | `POST /carpetas/:id/informes`, `GET …/:versionId`, `PATCH …/:versionId/revision` |
| FE-160 Exportar PDF/Word | Tarjeta «Exportar a PDF o Word» en la carpeta (ficha o historial, secciones; pagos solo para administración). En el informe revisado se exporta tal cual. Un doble clic no repite el pedido. | `POST /carpetas/:id/exportaciones`, `GET …/:exportacionId/archivo` |
| FE-165 Importación | `/importaciones` (subir CSV/XLSX, origen, plantilla descargable) y `/importaciones/:id` (resumen, filtros, decisión por fila: crear, vincular a carpeta, paciente o fila, o excluir; corrección de datos; confirmación con aceptación del avance del contador; resultado con enlaces). Un archivo ya importado responde 409 con enlace al lote. | `/importaciones…` (`version` en cada cambio) |
| FE-170 Investigación | `/investigacion` (catálogo; administración crea, edita y desactiva categorías; selección por período, residencias y categorías; secciones y formato; aviso sobre identificadores), `/carpetas/:id/investigacion` (asignar una categoría al caso, al diagnóstico o a una sesión) y `/investigacion/exportaciones/:id` (lectura completa, confirmación con la huella y descarga del ZIP). | `/investigacion/…` |
| FE-199 Componentes de apoyo | Se integraron `SelectorResidencia`, `FiltroResidenciaCarpetas`, `EtiquetaResidencia` y `residencia.ts` (FE-137), y `ListadoPublicaciones`, `TarjetaPublicacion` e `ImagenPublica` (FE-148). `ListadoInvestigaciones` (FE-186) queda sin ruta hasta que exista su API (FE-187). | — |

Cambios comunes:
- `api/cliente.ts` acepta `FormData` y descargas (`descargarArchivo`, `nombreDeDisposicion`).
- Nuevos `utilidades/archivos.ts`, `CampoSeleccion` y nuevos íconos.
- El simulador (`api/simulado/sprint3.ts`, clave v5) imita los nuevos endpoints con los mismos códigos de respuesta.

## 2. Pruebas automáticas

`npm test`: **29 archivos, 262 pruebas aprobadas** (eran 190). `tsc`, `oxlint` sin advertencias y `npm run build` sin errores.

## 3. Recorrido E2E contra el backend real (Playwright)

Datos de FE-134 §4: casos A, B, C y D con 2, 1, 0 y 0 sesiones entre el 20 y el 21/11/2026; pagos de Bs 75,50 (A) y Bs 100,00 (B).

| Comprobación | Resultado |
|---|---|
| Listado con etiqueta de residencia; filtro El Alto y Sin registrar (en la URL); combinación con clasificación | Aprobado |
| Alta con «Otra localidad» (exige localidad); editar A de La Paz a El Alto conserva el número y la terapeuta | Aprobado |
| Indicadores por residencia: La Paz 1 caso · 2 sesiones · Bs 75,50; El Alto 1 · 1 · Bs 100,00; Sin registrar 1 · 0 · Bs 0,00 (coincide con FE-134 §5) | Aprobado |
| Terapeuta 1: filtro El Alto dentro de sus carpetas → 0, y sin acceso a indicadores | Aprobado |
| Familia del caso A de FE-123: registrar 4 integrantes, recargar, editar, quitar, «otro» exige descripción | Aprobado |
| Familia: 409 real con dos sesiones (terapeuta y dirección) sin perder lo escrito; «Cargar la versión actual» | Aprobado |
| Genograma: PNG visible tras recargar, ampliar y cerrar con Esc; firma falsa → 415 y se conserva el anterior; reemplazo por PDF y descarga | Aprobado |
| Exportar ficha a PDF (2,1 KB) y Word (10 KB) con firma de archivo válida; la terapeuta no ve «pagos» | Aprobado |
| Difusión: borrador, 422 al publicar sin resumen, publicar, verlo como visitante (móvil), retirar → «no disponible», volver a borrador, imagen principal | Aprobado |
| Informes: judicial sin juzgado → 422 con enlace; sistémico con 1 de 2 sesiones, corrección, revisado, recarga, exportar a PDF | Aprobado |
| Importación `02-lote-errores.csv`: confirmar bloqueado, corregir la fila 2, excluir las demás, aceptar el avance del contador → 2 creadas y 10 no importadas; volver a subir → 409 con enlace | Aprobado |
| Importación con el ejemplo de FE-162 (14 columnas) → mensaje de encabezados distinto de la plantilla (18) | Aprobado (ver §4) |
| Investigación: crear categoría, etiquetar el diagnóstico de A con fragmento, 409 al repetir, seleccionar por categoría, revisar sin nombres, confirmar con la huella y descargar el ZIP (`manifiesto.json` + `INV-001.docx`) | Aprobado |
| Ancho a 390 px sin desplazamiento horizontal en carpetas, genograma, importación, investigación y difusión | Aprobado |

## 4. Observaciones para el equipo

1. **Ejemplo FE-162 contra la plantilla real:** el CSV de `docs/srs/sprint-3/ejemplos` tiene 14 columnas y la plantilla de la migración 017 tiene 18 (`estado`, `juzgado`, `nroExpediente` y `fechaDerivacion`). El backend lo rechaza. Conviene actualizar el ejemplo (Andrea / Alejandro).
2. **Informes sin listado:** no hay `GET /carpetas/:id/informes`. Por eso un informe se vuelve a abrir solo desde su enlace (Adriana).
3. **Imágenes de difusión:** la API registra solo los metadatos (`ruta`). No existe un endpoint para subir la imagen. El front la sirve desde `VITE_DIFUSION_IMAGENES_URL` (por defecto `/imagenes/difusion/`), que debe ser almacenamiento público, no clínico.
4. **`DifusionPublicaController`** también publica `POST` y `DELETE` de recursos bajo `@Public()`. Hay que quitarlos o protegerlos (Adriana).
5. **CORS:** para leer el nombre del archivo en otro dominio, el backend debe exponer `Content-Disposition` (`exposedHeaders`). El front usa un nombre de respaldo si no lo recibe.
6. **Huella de investigación:** una vez, el primer paquete preparado cambió de huella después de confirmar la revisión, y la descarga respondió 409. No se pudo reproducir. El front ofrece «Volver a leer» y «Preparar un paquete nuevo».
7. **Pendiente por API:** las investigaciones públicas (FE-187) y la inserción del genograma en los archivos exportados (FE-159 lo deja pendiente).

## 5. Segunda entrega (27/11/2026): FE-175, FE-187, FE-190 y FE-199

Base: `main` 6baa8c5, que incluye los recorridos guiados de Alejandro. Backend de prueba: `main` + PR #95 (FE-184), con las migraciones 021 a 023 aplicadas en PostgreSQL 16. Todos los datos son ficticios.

| Subtarea | Pantallas | API |
|---|---|---|
| FE-175 Gastos del mes | `/gastos` (solo administración): mes en la URL con flechas y calendario; total del mes y por tipo; registrar (tipo, fecha, monto en Bs con coma o punto, descripción obligatoria en «Otros gastos»); corregir; anular con confirmación y motivo. Los anulados quedan visibles, tachados, y no suman. Guardar se desactiva mientras envía y Cancelar no escribe. | `GET/POST /gastos`, `PATCH /gastos/:id`, `POST /gastos/:id/anular` |
| FE-190 Constancia y pagos | Constancia: con «Pendiente» se avisa que la atención continúa, sin presentarla como registrada (DEC-C02). Pagos: «un solo pago por sesión, sin cuotas» y «solo QR o transferencia, sin efectivo» (DEC-P01/P02); el 409 se explica con la regla. Los campos judiciales no cambian. | Sin cambios de contrato |
| FE-187 Artículos | `/articulos`, `/articulos/nuevo` y `/articulos/:id` (administración y marketing): filtro por estado, formulario, vista previa con la tarjeta de Gemina, ciclo borrador → publicado → retirado → borrador, 422 por falta de resumen, 409 y eliminación solo de borradores nunca publicados. Portal: `/investigaciones` y `/investigaciones/:id` sin sesión y sin comentarios; en móvil, una segunda fila de navegación. | `/investigaciones/articulos…`, `/publico/investigaciones…` |
| FE-199 | Quedan integrados todos los componentes de apoyo: residencia (FE-137), tarjetas públicas (FE-148) e investigaciones (FE-186). | — |

**Recorridos guiados:** `/gastos` y `/articulos` tienen recorrido con sus marcas `data-recorrido`. `/articulos/nuevo` y `/articulos/:id` figuran en `RECORRIDOS` con `null`, como las demás pantallas de edición. El inventario está actualizado en `docs/manuales/recorridos-pantallas.md`.

**Pruebas automáticas:** 40 archivos y 342 pruebas aprobadas. `tsc`, `oxlint` sin advertencias, Prettier y `build` sin errores.

**E2E contra el backend real (Playwright):**

| Comprobación | Resultado |
|---|---|
| Ejemplo de FE-172 §5: 120 + 80 + 1500 = Bs 1.700,00 → corregir electricidad a 85 → Bs 1.705,00 → anular internet → Bs 1.585,00, con recarga | Aprobado |
| Mes sin gastos → Bs 0,00; «Otros gastos» sin descripción no se envía; la terapeuta no accede | Aprobado |
| Pago repetido con otros datos → 409 real («La sesión ya tiene un pago registrado con otros datos»); `metodo: efectivo` → 400 | Aprobado (verificado por la API; la pantalla solo ofrece sesiones sin pago) |
| Constancia pendiente: aviso de que la atención continúa | Aprobado |
| Artículos: crear, 422 sin resumen, publicar, verlo como visitante en móvil (390 px sin desborde), retirar → «no disponible», volver a borrador, no ofrecer eliminar uno ya publicado, eliminar un borrador nuevo (204), la terapeuta sin acceso | Aprobado |

**Observaciones:**
1. El PR #95 (FE-184) tiene conflicto con `main` en `backend/src/app.module.ts`, porque los dos agregan un módulo (GastosModule y ArticulosModule). Hay que conservar los dos. FE-187 funciona en cuanto ese PR se fusione.
2. Corregir o anular un pago no está habilitado: queda para FE-211 (Sprint 4), según FE-188.

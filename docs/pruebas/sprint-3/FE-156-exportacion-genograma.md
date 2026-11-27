# FE-156 · Genograma en PDF y DOCX editable

Fecha: 26/11/2026, La Paz. Datos exclusivamente ficticios. Base de partida: `c806c34`.

## Resultado

Exportación gráfica implementada y comprobada por HTTP con Nest y PostgreSQL 16.16 local. El genograma es un anexo visual; el resto del DOCX contiene párrafos/tablas editables. No se certifica aquí la instalación de GenoPro, Microsoft Word, ATLAS.ti ni Supabase de producción.

| Comprobación | Resultado observado |
| --- | --- |
| PNG y JPEG | Imagen real incrustada en ambos formatos; proporción conservada. |
| PDF de dos páginas | Dos imágenes/páginas de anexo, sin truncamiento; ficha de 3 páginas. |
| Historial con 24 familiares | Se conservan los 24; PDF y Word de 5 páginas, sin texto tapado ni imágenes cortadas. |
| Informe revisado, luego genograma reemplazado | La imagen y nombre originales permanecen; los bytes de la imagen del DOCX coinciden antes/después. |
| Sin seleccionar genograma / seleccionado pero ausente | Sin imágenes añadidas; la ausencia se refleja en los datos del documento cuando se solicitó. |
| PDF corrupto o de 21 páginas | Fallo registrado; sin ruta/longitud de archivo generado ni descarga vacía presentada como éxito. |
| Caso ajeno / marketing / sin sesión | HTTP 404 / 403 / 401. |
| SHA-256 o tipo distintos de la fotografía | Conversión rechazada; nunca sustituye la versión por el archivo vigente. |
| Edición de párrafo y celda | Cambios guardados/reabiertos y conservados tras DOCX → ODT → DOCX con LibreOffice; imagen conservada. |
| Tipografía PDF | Liberation Sans incrustada; segundo cotejo visual sin las superposiciones de la sustitución inicial. |

## Pruebas automatizadas

- `backend/src/modules/exportaciones/tests/exportar-genograma.spec.ts`: 4 comprobaciones de selección, clave de la fotografía, autorización de consulta e integridad.
- `backend/test/exportaciones-genograma-postgres.test.mjs`: 8 escenarios reales de API/base y análisis de los archivos, incluido PDF multipágina y captura de bytes para revisión visual.
- `frontend/src/features/expediente/exportacion/ExportarDocumento.test.tsx`: 4 escenarios de selección expresa, omisión por defecto, informe inmutable y reintento.
- Regresión final backend: compilación, 283 pruebas unitarias aprobadas y 421 de integración aprobadas; 13 omitidas por sus condiciones de entorno, cero fallos. Incluye las suites anteriores de autorización, descargas, persistencia y evaluación inicial.
- Frontend: 289 pruebas aprobadas, compilación y lint. Navegador real Chromium 1366×900 y 390×844 con API simulada: selección/formato, descarga, informe revisado sin opción de reemplazo y ausencia de desborde/errores de JavaScript. Los bytes reales se verifican con la API local, no con el simulador.

## Reproducir

Instalar con el lockfile del backend en Node.js 22.13+ / 24, incluidas dependencias opcionales de plataforma de `@napi-rs/canvas`. PDF.js usa sus fuentes/recursos empaquetados; no depende de Poppler o LibreOffice para generar archivos en la aplicación.

```sh
cd backend
npm ci
npm run build
npm run test:unit
# Usar únicamente una base PostgreSQL local desechable; el helper aplica las migraciones.
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres \
  FE156_ARTEFACTOS=/tmp/fe156-ficticios \
  node --test test/exportaciones-genograma-postgres.test.mjs
```

La base de prueba requiere los roles de plataforma `anon` y `authenticated`, igual que las demás suites locales. `FE156_ARTEFACTOS` es opcional y guarda las descargas ficticias para abrir/renderizar. No usar un proyecto de producción para esta suite.

Revisar todas las páginas de `ficha-pdf`, `historial-extenso` e `informe-revisado`. Para Word, editar un párrafo/celda de una copia y guardar/reabrir, conservando el original descargado. La revisión ejecutada usó LibreOffice y renderizado a PDF/PNG. Las muestras generadas son de prueba, sin datos reales ni salida atribuida a GenoPro.

## Alcance de aceptación

FE-156 aporta definición de contenido por documento/rol y demuestra edición/representación. La conformidad institucional de los modelos sistémico/judicial sigue en FE-151. La activación en Supabase continúa requiriendo las migraciones existentes hasta 021; no se añadió migración para la inserción de imágenes y no se aplicó ningún cambio a Supabase en esta sesión.

Referencias de implementación: [PDF.js](https://mozilla.github.io/pdf.js/examples/), [imágenes DOCX](https://docx.js.org/api/classes/index.ImageRun.html), [imágenes PDFKit](https://pdfkit.org/docs/images.html). Se usa PDF.js directamente, sin añadir el envoltorio `pdf-to-img`.

# FE-156 · Exportación a PDF y Word editable

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado vigente:** definición y verificación técnica completadas el 26/11/2026. La estructura institucional de las plantillas sigue su aceptación en FE-151; no se atribuye validación de la Fundación a las pruebas técnicas.

HU FE-114 · RF-18. Desbloquea FE-157/158/159/160/161.

## 1. Alcance

Exportar informe revisado, ficha de diagnóstico o historial del caso autorizado. El mismo contenido seleccionado se refleja en PDF y DOCX. DOCX mantiene texto y tablas editables; un genograma insertado sigue siendo una imagen/representación, no un editor de relaciones.

Un PDF legible no demuestra que su contenido sea editable como un Word. No prometer que el sistema ya exporta estos documentos: esta es la especificación.

## 2. Selección y permisos

| Documento/sección | Administración | Terapeuta asignada | Marketing/ajena |
|---|---|---|---|
| Informe sistémico/judicial | Según política clínica ratificada. | Del caso asignado. | Denegado. |
| Ficha e historial clínico | Sí, conforme al acceso actual. | Del caso asignado. | Denegado. |
| Datos familiares/genograma | Mismos permisos clínicos; selección expresa. | Igual. | Denegado. |
| Pagos en historial administrativo | Solo si se seleccionan y autoriza administración. | Nunca incluir montos/metadatos financieros. | Denegado. |

El control ocurre en servidor, aunque el cliente oculte opciones. No concatenar una consulta financiera en la respuesta clínica general.

## 3. Formato de salida propuesto

- PDF con márgenes y tipografía legibles, títulos de sección, tablas sin cortes que oculten datos y número de página.
- DOCX con estilos de párrafo y tablas; evitar aplanar todo el documento como una imagen.
- Fechas de negocio sin cambio de día por zona horaria y dinero con dos decimales cuando esté autorizado.
- Archivo con identificador técnico de exportación y nombre sin datos personales innecesarios.
- Archivos privados, errores explícitos y registro de quién exportó, qué versión/secciones y cuándo.
- Un fallo no devuelve un archivo vacío con estado de éxito.
- Reutilizar la versión revisada del informe; no regenerar silenciosamente otro texto al descargar.

## 4. Contrato propuesto

Solicitud de exportación autenticada por caso y alcance:

```json
{
  "documento": "historial",
  "formato": "docx",
  "secciones": [
    "identificacion",
    "familia",
    "diagnostico",
    "sesiones"
  ],
  "incluirGenograma": false,
  "incluirPagos": false
}
```

Las claves definitivas se acuerdan entre FE-158/159/160. La API debe devolver un archivo válido y un tipo de contenido coherente; si usa un identificador de descarga, verificar acceso también al consumirlo.

## 5. Muestra de estructura editable

[FE-156-ficha-ficticia.docx](ejemplos/FE-156-ficha-ficticia.docx) es una muestra de referencia creada con datos inventados. Sirve para comprobar texto/tablas editables y comunicar el diseño; no fue generada por la aplicación y no demuestra que FE-159 esté implementado.

Evidencia estructural de la muestra: existe texto en párrafos/tablas de OpenXML y se comprobó que una copia puede modificarse y reabrirse conservando el cambio. La verificación en Word/LibreOffice del archivo producido por la futura API corresponde a la aceptación del producto.

## 6. Matriz de aceptación

| Prueba | Resultado esperado |
|---|---|
| Mismo caso y selección en PDF/DOCX | Identificación, secciones y contenido equivalentes. |
| Editar un párrafo y celda del Word | Cambio conservado al guardar y reabrir. |
| Tabla/familia de varios integrantes | Legible, sin texto oculto por cortes. |
| Genograma amplio o ausente | Mantiene proporción y legibilidad o muestra ausencia definida. |
| Dos exportaciones de casos diferentes | No se mezclan fuentes, títulos ni adjuntos. |
| Terapeuta pide incluirPagos=true | El servidor rechaza la selección financiera; no entrega un documento con montos. |
| Token/caso sin permiso al descargar | Denegado sin bytes clínicos. |
| Error del generador | Mensaje de fallo y posibilidad de reintento; no archivo corrupto presentado como éxito. |

**Pendiente para cierre:** ratificar contenido/estilo con la Fundación y revisar los documentos producidos por la aplicación después de FE-159/160. La muestra adjunta es referencia, no exportación real del sistema.

## Revisión de la entrega integrada por Andrea · 26/11/2026

El producto integrado ya genera y descarga PDF/DOCX mediante POST `/api/carpetas/:id/exportaciones` y descarga autenticada de su resultado. `GenerarExportacionDto` admite `informe`, `ficha` o `historial`; el informe exige una versión revisada. Administración accede a ficha/historial y pagos expresamente seleccionados; el informe clínico revisado se restringe a la terapeuta asignada. Marketing y la terapeuta ajena no reciben archivos.

`generar-docx.ts` produce párrafos y tablas OpenXML con texto, no una captura aplanada. `generar-pdf.ts` usa A4, márgenes y numeración. La API con PostgreSQL local ya generó y descargó ambos formatos en la base `18ae1cf`; `backend/test/evaluacion-inicial-postgres.test.mjs` inspeccionó el XML de un DOCX real descargado e incluyó la evaluación inicial. `exportaciones-api-postgres.test.mjs` cubre autorización y fallos de persistencia. Los documentos revisados anteriores permanecen intactos.

**Límite encontrado:** la exportación actual agrega metadatos/referencia del genograma, pero el generador no incrusta la imagen/PDF dentro del Word o PDF. La carga y visualización en la ficha sí están disponibles. No se declara esa inserción gráfica como terminada; se registra como diferencia de la HU FE-114 para su decisión/corrección, junto con la revisión visual de Word y PDF de varias páginas.

La muestra `FE-156-ficha-ficticia.docx` sigue siendo una referencia ajena a la API. La evidencia de ejecución real es la suite anterior, no esa muestra. No se ejecutó Word/LibreOffice ni una validación de estilo de la Fundación en esta sesión. FE-156 conserva pendiente ese cotejo final; la definición de formatos y el examen estructural están entregados.

## Cierre técnico · 26/11/2026 (posterior a la revisión anterior)

Se resolvieron la inserción gráfica y el cotejo visual pendientes. La ficha/historial permiten seleccionar el genograma; PDF y DOCX incluyen PNG/JPEG o todas las páginas de un PDF legible de hasta 20 páginas. El anexo conserva proporción. Las imágenes se limitan a 25 millones de píxeles de entrada y a 3000 píxeles por lado en la representación. Un error de lectura/conversión registra el fallo y no entrega bytes vacíos como éxito.

El informe revisado usa exclusivamente la clave y SHA-256 guardados en su fotografía. Se probó que reemplazar el vigente no cambia la imagen de una exportación posterior de ese informe. El acceso al archivo se vuelve a comprobar por caso y usuario; marketing, cuenta ajena y sin sesión quedan denegados. La selección de pagos continúa restringida a administración.

Se descargaron documentos reales desde Nest y PostgreSQL locales. Se revisaron todas las páginas de una ficha con PDF de dos páginas (3 páginas finales en ambos formatos), un historial con 24 familiares (5 páginas finales en ambos formatos) y un informe con su genograma. El PDF incorpora Liberation Sans incluida en PDF.js, para evitar las sustituciones tipográficas observadas en el primer cotejo.

En un DOCX real de la API se editó un párrafo y una celda, se guardó y reabrió; luego se abrió/guardó con LibreOffice mediante DOCX → ODT → DOCX y se verificó que ambos cambios y la imagen persistían. Esa copia se renderizó y revisó en sus dos páginas. No se ejecutó Microsoft Word.

Evidencia y reproducción: [pruebas de FE-156](../../pruebas/sprint-3/FE-156-exportacion-genograma.md). La muestra antigua del apartado 5 conserva su carácter de referencia; no se sustituye por una supuesta salida de GenoPro. La validación de las plantillas institucionales corresponde a FE-151 y la muestra de la instalación de GenoPro a FE-129.

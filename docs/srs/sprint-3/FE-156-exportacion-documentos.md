# FE-156 · Exportación a PDF y Word editable

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** análisis preparado; no acredita implementación ni validación de la Fundación.

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

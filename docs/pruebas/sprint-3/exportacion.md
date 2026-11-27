# FE-161 · Verificación de archivos, contenido y exclusión de datos

Fecha: 26/11/2026, La Paz. Apoyo ejecutado por Andrea; responsable de la subtarea conservada en Jira: Emilia. No se atribuye a Emilia la ejecución de estas pruebas ni se registran horas trabajadas en su nombre.

## Matriz de verificación

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| PDF/DOCX reales, no solo firma de archivo | Descargas HTTP de `exportaciones-genograma-postgres.test.mjs`; análisis PDF.js y OpenXML/ZIP | Aprobado. |
| Página, cortes y tablas | Revisión visual de ficha de 3 páginas e historial de 5 páginas en cada formato, con 24 familiares y dos páginas de genograma | Sin texto tapado, imágenes cortadas ni páginas omitidas. |
| Word editable | Edición de párrafo y celda; guardar/reabrir; DOCX → ODT → DOCX con LibreOffice | Cambios e imagen conservados. |
| Casos A y B separados | Escenario FE-161 de la suite: nombres y evolución exclusivos por caso, comprobados en PDF y DOCX | Sin contenido cruzado. |
| Terapeuta sin montos | Historial real de A descargado como terapeuta: no contiene monto ni referencia de pago | Aprobado en ambos formatos. |
| Administración con selección expresa | Mismo historial con pago ficticio 73.25 y referencia ficticia, seleccionado por administración | Contiene los datos financieros de A; no los datos de B. |
| Pedido financiero no autorizado | API rechaza `incluirPagos: true` de terapeuta | HTTP 403, sin archivo financiero. |
| Cuenta/caso no autorizado | API y descarga como marketing, sin sesión y terapeuta ajena | 403, 401 y 404 según contrato. |
| Fallos sin falsa descarga | PDF corrupto, más de 20 páginas, fallo de persistencia e integridad de descarga | Exportación fallida o rechazo; no bytes vacíos como éxito. |

Los escenarios visuales, límites y reproducción se documentan en [FE-156-exportacion-genograma.md](FE-156-exportacion-genograma.md). Se conservaron muestras ficticias descargadas y la copia editada para revisión. El simulador se usó solo en los recorridos de interfaz de escritorio/móvil; no demuestra validez de los archivos.

Este resultado cubre la verificación de exportación de FE-161. La conformidad institucional de las plantillas y la versión instalada de GenoPro permanecen en FE-151/FE-129. No se ejecutó Microsoft Word ni se probó producción/Supabase.

Regresión final tras agregar el escenario de contenido financiero y separación: 422 pruebas de integración aprobadas, 13 omitidas por entorno y cero fallos. Se conservan 283 unitarias y 289 de frontend aprobadas; compilaciones y lint satisfactorios.

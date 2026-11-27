# FE-129 · Importación visual de GenoPro

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** análisis preparado; no acredita implementación ni validación de la Fundación.

HU FE-17 · RF-15. Desbloquea FE-130/131/132/133.

## 1. Lo confirmado y lo que falta

| Tema | Estado |
|---|---|
| Símbolos | Confirmado por Andrea: cuadrado para hombre, círculo para mujer. |
| Ubicación | Después del resumen familiar y antes del historial. |
| Herramienta | Andrea identifica probablemente GenoPro; versión exacta pendiente. |
| Archivo de la Fundación | No se recibió una muestra ficticia exportada desde su instalación. |
| Exportación ejecutada en esa versión | No realizada en esta entrega. |
| Ruta funcional inicial | Propuesta: cargar PDF/PNG/JPEG y visualizar sin editar relaciones. |

## 2. Comprobación documental

La [ayuda oficial para PDF/Word](https://support.genopro.com/Topic27535.aspx) describe impresión a PDF y exportación gráfica a metafile. Eso no demuestra que exista exportación directa a todos los formatos de imagen en la instalación concreta.

La [ayuda de Fast Save](https://genopro.com/help/fast-save/) distingue XML comprimido de un guardado binario. Por ello no asumir que cualquier `.gno` puede descomprimirse y convertirse automáticamente.

No se declara compatibilidad con importación nativa, edición en navegador ni sincronización. Un `.gno` puede conservarse como archivo privado original si se implementa esa opción, pero no es por sí mismo una previsualización.

## 3. Contrato visual propuesto

- Admitir inicialmente PDF, PNG y JPEG verificados por contenido, no solo por extensión. Límite técnico inicial propuesto: 10 MiB por representación, revisable con una muestra legible.
- Identificar caso, archivo, tipo, tamaño, autor y fecha. No guardar una URL pública permanente para un genograma clínico.
- Operaciones nuevas propuestas: GET/POST `/api/carpetas/:id/genograma` y descarga autorizada del archivo vigente. Acordar respuesta exacta antes de codificar.
- Guardado transaccional de referencia; si falla el reemplazo, conservar archivo y referencia anteriores. No borrar originales sin verificar que la nueva versión es recuperable.
- Visor con ajuste al ancho, ampliación, apertura/descarga y navegación de páginas PDF.
- El resumen familiar y el archivo son fuentes relacionadas, pero una imagen no llena automáticamente familiares.

## 4. Muestra ficticia que debe prepararse en GenoPro

| Persona QA | Edad de referencia 20/11/2026 | Símbolo | Relación |
|---|---:|---|---|
| Padre QA | 44 | Cuadrado | Padre del paciente. |
| Madre QA | 41 | Círculo | Madre del paciente. |
| Paciente QA A | 12 | Cuadrado | Persona identificada como paciente. |
| Hermana QA | 8 | Círculo | Hermana del paciente. |

Vincular a padres e hijos y añadir una leyenda legible. La muestra solo contiene datos inventados. No usar un expediente real para generar el ejemplo de repositorio.

## 5. Guion de verificación de la instalación

1. Registrar nombre y versión del programa.
2. Crear la muestra anterior e identificar al paciente.
3. Probar impresión a PDF en la instalación y revisar que se lean nombres/relaciones.
4. Si se obtiene PNG/JPEG por exportación/conversión, registrar el procedimiento real.
5. Registrar formato, tamaño, páginas y legibilidad en computadora/celular.
6. Si se propone `.gno`/XML, identificar el modo de guardado y comprobar por separado personas, relaciones, símbolos y posiciones; no convertirlo en compromiso del sprint sin prueba.
7. Conservar muestra ficticia y resultado observado en la evidencia de FE-129.

| Evidencia | Resultado actual |
|---|---|
| Documentación oficial revisada | Sí; enlaces anteriores. |
| Versión usada por la Fundación | Pendiente. |
| Archivo ficticio salido de esa instalación | Pendiente. |
| Prueba visual en el sistema | Corresponde a FE-132/133 después de implementar. |

## 6. Aceptación funcional preparada

Carga válida → recarga conserva la representación, identidad del caso y autoría. Archivo inválido/excesivo → rechazo y versión anterior intacta. Caso sin genograma → estado vacío sin ocultar historial. Cuenta ajena → no obtiene metadatos ni archivo por URL directa. PDF multipágina y nombres pequeños → controles de ampliación útiles.

**Para completar FE-129:** anexar muestra/procedimiento y versión comprobados. Este documento permite diseñar la carga visual; todavía no acredita esa comprobación.

## Revisión de la entrega integrada por Andrea · 26/11/2026

La carga y el visor ya están implementados: POST/GET `/api/carpetas/:id/genograma` y GET `/:id/genograma/archivo`, con autorización por caso. El límite efectivo integrado es **5 MiB** (sustituye la propuesta inicial de 10 MiB); formatos PDF, PNG y JPEG. Se validan extensión, MIME y contenido; `.gno`, XML y SVG no constituyen formatos de carga visual admitidos. No se promete edición de relaciones ni sincronización.

La API y la interfaz cubren ausencia, carga/descarga privada, reemplazo y rechazo sin perder la representación anterior, permisos y ampliación. Evidencia: `backend/test/genograma-http.test.mjs`, `genograma-postgres.test.mjs`, y `frontend/src/features/expediente/genograma/Genograma.test.tsx`. La aceptación de navegador de FE-196 identifica los escenarios visuales ejecutados y su API simulada.

Documentación primaria consultada de nuevo el 26/11/2026:
- [GenoPro: impresión y vista previa](https://genopro.com/help/print/): utiliza las impresoras instaladas y conserva proporción al ajustar páginas.
- [Respuesta de GenoProSupport sobre PDF/Word](https://support.genopro.com/Topic27535.aspx): impresión con controlador PDF y exportación gráfica Metafile. No demuestra una exportación PNG directa en la instalación de la Fundación.
- [Fast Save oficial](https://genopro.com/help/fast-save/): distingue el XML comprimido y el formato binario rápido; no basta renombrar `.gno`.

No están disponibles el número de versión ni una muestra ficticia salida de la instalación de la Fundación. Por tanto **FE-129 conserva solo ese bloqueo externo**: ejecutar el guion del apartado 5 y registrar versión, archivo, legibilidad y procedimiento. El visor del sistema ya puede probarse con archivos ficticios y no debe rehacerse por esta ausencia.

## Aceptación del alcance técnico por la PO · 26/11/2026

Andrea aprobó el cierre del alcance técnico de Sprint 3: importación visual PDF/PNG/JPEG, visor privado e incorporación en documentos; no importación nativa .gno/XML. La validación externa permanece pendiente y se traslada por su decisión expresa a [FE-213](https://andreanarvaezort-1786202493806.atlassian.net/browse/FE-213), prevista en Sprint 4. Este apartado sustituye el pendiente de cierre de Sprint 3 de las secciones anteriores, sin acreditar ensayos en la instalación de la Fundación, una muestra histórica real ni un catálogo/perfil institucional aprobado. No se registran horas reales ni reuniones.

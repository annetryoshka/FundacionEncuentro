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

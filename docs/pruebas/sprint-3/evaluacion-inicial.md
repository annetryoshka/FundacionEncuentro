# FE-126 / FE-127 / FE-128 · Evaluación inicial y diagnóstico opcional

Implementación y verificación de apoyo: Andrea Carolina Narváez Ortega.

Fecha local: 26/11/2026. Base: main `abcc9b8`. Rama: `fix/andrea-evaluacion-inicial`.

## Resultado

La ficha exige evaluación inicial y permite guardar sin diagnóstico. La evaluación se conserva como campo independiente; no se obtiene de comentarios ni diagnósticos históricos. El ajuste se entrega en tres commits: API/datos (FE-126), interfaz (FE-127) y regresión/evidencia (FE-128). El trabajo anterior y sus autorías se conservan.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Backend: `npm run build` | Completado |
| Backend: `npm run test:unit -- --maxWorkers=2` | 27 archivos, 279 pruebas aprobadas |
| Frontend: `npm run build` y `npm run lint` | Completados |
| Frontend: `npm test -- --maxWorkers=2` | 31 archivos, 275 pruebas aprobadas |
| Backend: integración con PostgreSQL 16.16 local, UTF-8, C.utf8 | 426 pruebas: 413 aprobadas, 0 fallidas, 13 omitidas |
| Chromium real, API simulada local | Recorridos aprobados en escritorio 1366×900 y móvil emulado 390×844 |

Las 13 omitidas son 12 de Supabase real y una condición de genograma sin migración 012; esta base sí incluye la 012. Se habilitaron las suites de PostgreSQL de los distintos sprints sobre bases locales desechables. No se conectó a la base de la Fundación ni se volvió a ejecutar la suite externa de Supabase.

## Regresión de API y datos

Archivo reproducible: [evaluacion-inicial-postgres.test.mjs](../../../backend/test/evaluacion-inicial-postgres.test.mjs).

| Escenario | Resultado observado |
|---|---|
| Aplicar 021 sobre una ficha antigua con comentarios, diagnóstico y una clave adicional | JSON, fotografía e informe revisado anterior se conservan exactamente; evaluación leída como null. |
| Intentar editar sin evaluación, con null, espacios, número o texto demasiado largo | 400; la ficha queda intacta. Un diagnóstico escrito no sustituye la evaluación. |
| Guardar evaluación con diagnóstico null | 200; texto normalizado, mismo ID y creación, clave adicional conservada, una única ficha. |
| Familia y genograma al editar la ficha | Mismos datos familiares, versión y metadatos del genograma. |
| Fuente vigente e historial | Incluyen evaluación; diagnóstico null no se rellena desde el alta; antecedente del alta conservado. |
| Generar informe sistémico | Su detalle contiene la evaluación; el informe revisado anterior conserva todo su contenido y metadatos. |
| Generar Word/PDF | Word contiene la evaluación en XML editable; PDF se genera y descarga correctamente desde la misma fotografía. |
| Acceso sin sesión, marketing y terapeuta ajena | 401/403/404, sin divulgar evaluación ni modificar la ficha. |
| Investigación: vista previa, revisión y ZIP | La evaluación se muestra antes de confirmar y está en el TXT; cambiarla después invalida la revisión y la descarga devuelve 409. |

La suite de regresión completa incluye también los permisos, familia, genograma, sesiones, tareas, pagos, informes, investigación e importación existentes. Las plantillas nuevas pasan a v2; no se regenera ningún informe revisado previamente.

## Interfaz

[EvaluacionInicial.test.tsx](../../../frontend/src/features/expediente/EvaluacionInicial.test.tsx) comprueba guardar sin diagnóstico y recargar el resumen, impedir que un diagnóstico sustituya la evaluación, leer/editar una ficha antigua y cancelar sin guardar, y limpiar un diagnóstico conservando la evaluación. La prueba de investigación comprueba que la evaluación aparece en la vista previa antes de confirmar el paquete. El error de evaluación desaparece cuando el campo vuelve a ser válido.

Además se ejecutó el recorrido en Chromium: login con cuentas ficticias del simulador, creación sin diagnóstico, rechazo de evaluación vacía, cancelación, recarga, resumen, historial, ficha antigua sin evaluación y edición conservando comentarios. En ambos tamaños no hubo errores JavaScript ni desplazamiento horizontal del documento. Es un navegador real con API simulada; la API con PostgreSQL real se verifica por separado arriba, sin atribuir autenticación real al simulador.

- [Resultados del navegador](evaluacion-inicial/navegador-resultados.json).
- [Formulario en escritorio](evaluacion-inicial/formulario-escritorio.png).
- [Formulario en móvil emulado](evaluacion-inicial/formulario-movil.png).

## Despliegue

Aplicar [021_evaluacion_inicial.sql](../../../db/migrations/021_evaluacion_inicial.sql) después de la 020 y antes de iniciar la API actualizada. La 021 solo amplía lecturas y fotografías: no rellena ni renombra datos clínicos antiguos. Se comprobó su aplicación sobre datos existentes en PostgreSQL local. Su ejecución en Supabase no forma parte de esta evidencia.

La lectura histórica queda disponible. Para guardar la próxima edición de una ficha antigua, la profesional completa la evaluación; el sistema conserva sus comentarios y los demás campos del formulario. La aceptación de negocio de toda HU FE-110 y la validación con la Fundación siguen sus evidencias propias.

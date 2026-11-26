# Integración del Sprint 3 · 26/11/2026

Responsable de integración: Andrea Carolina Narváez Ortega.

Base: `5c94b57c03390f8fb59e5ca1bc41e125e0a70ca8`. Se reúnen los avances nuevos de 16 ramas y los PR #50, #51, #54, #55, #56, #60, #63 y #64. Los commits originales y sus autorías se conservan como antecedentes de la integración. Las ramas antiguas FE-31 y FE-33 no se reincorporan: son trabajos previos ajenos a este incremento.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Frontend: `npm test -- --maxWorkers=2` | 30 archivos, 271 pruebas aprobadas |
| Frontend: `npm run build` y `npm run lint` | Ambos completados |
| Backend: `npm run build` | Completado |
| Backend: `npm run test:unit -- --maxWorkers=2` | 27 archivos, 273 pruebas aprobadas |
| Backend: `node --test --test-timeout=120000 --test-concurrency=2 test/*.test.mjs` con PostgreSQL local | 418 pruebas: 405 aprobadas, 0 fallidas, 13 omitidas |

PostgreSQL 16.16 local, UTF-8 y configuración regional `C.utf8`. Se habilitaron FE_PG_QA, FE34_PG_QA, FE40_PG_QA y FE88_PG_QA sobre bases locales desechables; los roles `anon` y `authenticated` reproducen los nombres de plataforma que presuponen las migraciones. No se ejecutaron migraciones ni escrituras en Supabase de la Fundación. Se omitieron 12 pruebas de Supabase real y una condición de genograma sin migración 012, porque esta base sí tiene esa migración. Esta revisión no vuelve a certificar la ejecución externa; la evidencia previa de Emilia se conserva en `logout-supabase.md` y su JSON.

## Conflictos resueltos y correcciones

- Se conservan todos los módulos: exportaciones, importación, informes, difusión, investigación, familiares y genograma.
- Se combinan los contratos de API y las secciones de migraciones, conservando las rutas ya presentes en main.
- El helper HTTP conserva tanto módulos adicionales como configuración de prueba; se evita sustituir esa interfaz por una versión anterior.
- Se combinan las dependencias de importación/exportación con DOCX y JSZip de investigación y se regenera el lockfile.
- El controlador público de difusión queda limitado a consulta. Se eliminan los POST/DELETE duplicados de recursos de ese controlador; la escritura conserva sus rutas autenticadas de administración/marketing. La prueba HTTP comprueba que las rutas públicas de escritura responden 404.

## Observaciones y trabajo restante

- El ejemplo CSV de FE-162 ya lo acepta la API de FE-164 integrada en la base de esta revisión. La observación de encabezados del informe previo de frontend corresponde a una versión anterior.
- FE-124: existe `ResumenFicha.tsx`, aportado por Jorge en FE-127. Andrea debe contrastarlo con su tarea y completar el resumen, que hoy muestra parentesco, nombre y edad pero no la ocupación/lugar de trabajo. La ficha familiar completa sí contiene esos campos. No atribuirse el componente previo como una implementación propia.
- FE-162: la revisión de filas ya está construida dentro de `PaginaLoteImportacion.tsx` por Jorge (FE-165). Andrea debe revisar la coincidencia con su contrato y acordar el componente de apoyo que falta, evitando duplicar esa pantalla.
- FE-146: los contenidos de FE-141 son borradores; el registro deja contactos, imágenes y autorización pendientes. Puede prepararse la estructura, pero la aprobación de contenido real sigue pendiente.
- FE-194: revisar evidencia de Emilia y actualizar el dictamen. El recorrido manual de escritorio/móvil del documento de logout sigue sin completar.
- FE-196: falta aceptación funcional integrada; las pruebas automáticas de esta integración no equivalen a aprobación de todas las HU.
- FE-205: registrar eventos y horas realmente realizados.
- Permanecen las decisiones de la Fundación de los contratos de Andrea: mínimo clínico, consentimiento/pagos, plantillas, muestra de GenoPro, usos de investigación y ratificación de gastos, disponibilidad y foro.
- Pendientes de producto documentados por el equipo: investigación pública (FE-187), genograma visual en archivos exportados, carga de imágenes de difusión, listado de informes y cabecera CORS Content-Disposition para conservar nombres de descarga entre dominios. Deben priorizarse con el equipo; esta integración no los declara implementados.
- El borrador del informe de voluntariado del Sprint 2 conserva campos pendientes y requiere pasarse al modelo institucional; no es un informe final entregado.

## Ramas incluidas

| Rama de origen | Commit revisado |
|---|---|
| `docs/andrea-sprint3-contratos` | `39cf3d99e0d17dbc304eaae7c6865ebc562c871d` |
| `docs/gestion-sprint-2-actualizacion` | `2e6a1160fb69e244b1f5910780012b0f29827d81` |
| `feature/FE-121-informe-sprint-2` | `8b5e7a58e163aa54d8d67b728c706d348c6c0ca9` |
| `feature/FE-141-contenido-difusion` | `073fb507834e96b90f8791231fc93fcdffa4f85b` |
| `feature/FE-201-bloqueos-e-integracion` | `36d6e64c96ca16cd1b772a40673b2565cc83d644` |
| `feature/FE-202-avance-y-capacidad` | `5a8f9455cbf8a940abba05f6972437d4953299bb` |
| `feature/FE-203-guia-operativa` | `344dfcbdfa580bec30e1e6a1304c9e5cfb656387` |
| `feature/FE-204-indice-evidencias` | `94e7dcda2e7876bb1220f28f9bba736ba99d605c` |
| `feature/FE-210-participacion-sprint-3` | `419b3498624a7e918454af08811159ad11d215a4` |
| `feature/FE-126-ficha-familiar` | `b6fa8215cc30a03ec5266c4e0076c026919fea6a` |
| `feature/FE-130-almacenamiento-genograma` | `f9f4447e0c129119589e875b6b1d5ffe04af13a1` |
| `feature/FE-153-borradores-informes` | `b4245e16a30948dd37435a7cfade7f91e59fb131` |
| `feature/FE-143-api-difusion` | `af477f45ad79bcbbc2bfb16eb35327578dc91eda` |
| `feature/FE-169-api-investigacion` | `d4b0eea26a2ff5f39a9d80bbeef4f424c1e07561` |
| `feature/FE-192-logout-timeout` | `dcb36c80a7d495ec8e63c8752a14f5e5dca07236` |
| `feature/FE-138-FE-170-front-sprint3` | `43eb87a9ebed12819330459c80c06fb8346d7536` |

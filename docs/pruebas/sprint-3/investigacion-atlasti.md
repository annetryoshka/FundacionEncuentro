# FE-171 — Comprobar paquete e interoperabilidad de Atlas.ti

- **Historia:** FE-115, categorizar casos y exportar información seleccionada para Atlas.ti.
- **Base probada:** `main` integrado (`d614395`), en la rama `feature/FE-171-verificacion-atlasti`. Incluye las categorías y el paquete de Alejandro (FE-168), la API de Adriana (FE-169) y la interfaz de Jorge (FE-170).
- **Referencia:** `docs/srs/sprint-3/FE-167-investigacion-atlasti.md` (paquete, privacidad e interoperabilidad, sección 6).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `d614395` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** paquete QA 9/9 (10,4 s); regresión FE-168/FE-169 15/15; interfaz 9/9 tras corregir la prueba FE171-01. Importación en ATLAS.ti pendiente.

## 1. Alcance

Las pruebas existentes (`investigacion-postgres`, `investigacion-api-postgres`, `evaluacion-inicial-postgres`) comprueban el contenido del paquete en la base. La suite QA `backend/test/investigacion-qa-paquete-postgres.test.mjs` **descarga el ZIP real por la API y abre cada archivo** como lo haría Atlas.ti: estructura del ZIP, validez de cada DOCX (partes OOXML y XML en UTF-8), TXT en UTF-8 estricto, manifiesto contra los archivos, privacidad en todos los archivos y la revisión obligatoria antes de descargar.

**Qué no cubre:** no hay una instalación de ATLAS.ti para importar el paquete. El manual oficial de ATLAS.ti 26 (consultado por Andrea) admite DOCX y TXT como documentos; esta verificación comprueba que los archivos generados son DOCX y TXT bien formados y con el texto íntegro. **La importación en la versión que use la Fundación sigue pendiente** (sección 5).

Datos ficticios: caso A con teléfono, fecha de nacimiento, diagnóstico, una sesión con acentos, eñes, signos y un emoji, un pago de 987,65 y una etiqueta con fragmento; caso B con su propia sesión; caso C de otra terapeuta. Los nombres de los pacientes contienen la palabra "Identificable" para detectarlos si se filtraran.

## 2. Cómo ejecutar

Requisito previo: los roles `anon` y `authenticated` en el PostgreSQL local, hasta que se fusione el fix de FE133-01.

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/investigacion-qa-paquete-postgres.test.mjs
node --test --test-force-exit test/investigacion-postgres.test.mjs test/investigacion-api-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

## 3. Matriz de aceptación

| # | Escenario | Esperado | Observado | Resultado |
|---|---|---|---|---|
| X1 | Paquete DOCX de dos casos | ZIP con solo `manifiesto.json`, `INV-001.docx` e `INV-002.docx`; `application/zip` y descarga como adjunto | 3 archivos exactos; cabeceras correctas | Aprobado |
| X2 | Validez de los DOCX | Cada uno tiene `[Content_Types].xml`, `_rels/.rels` y `word/document.xml` en UTF-8; contiene Categorías, Diagnóstico, Seguimiento y el código de categoría; acentos, eñes, signos y emoji intactos | OOXML completo en UTF-8; texto y emoji intactos | Aprobado |
| X3 | Paquete TXT | Archivos UTF-8 válidos (decodificación estricta); la primera línea es el código; mismo texto; el fragmento acompaña a su categoría | UTF-8 estricto; código en la 1.ª línea; fragmento presente | Aprobado |
| X4 | Manifiesto | Formato, 2 documentos, código `INV-###`, archivo existente en el ZIP, categorías; sin UUID | Coincide con el ZIP; sin UUID | Aprobado |
| X5 | Privacidad en DOCX y TXT | Ningún archivo contiene nombres, teléfono, fecha de nacimiento, UUID, monto de pago ni la fecha exacta de la sesión (va por mes) | Sin ningún dato prohibido en DOCX ni TXT | Aprobado |
| X6 | Sin mezcla | Cada documento solo trae los datos de su caso | Sin mezcla | Aprobado |
| X7 | Revisión obligatoria | Descargar sin revisar → 409; huella incorrecta → 409; la vista de revisión muestra el texto libre; tras revisar, 200; si el texto cambia después, 409 | 409 / 409 / 200 / 409 | Aprobado |
| X8 | Permisos | Un caso ajeno en la selección → 403 o 404 y ningún paquete creado; marketing → 403; otra terapeuta no lee la descarga, el manifiesto ni la revisión | Rechazo sin paquete; 403; otra terapeuta sin acceso | Aprobado |
| X9 | Solicitud inválida | Tareas sin seguimiento, formato `pdf`, sección `pagos`, sin casos, período invertido → 400 | 400 en los 5 casos | Aprobado |
| R1 | Regresión FE-168 y FE-169 | En verde | 15/15 | Aprobado |

## 4. Interfaz

`Investigacion.test.tsx` (Jorge): **8/9** en verde el 2026-11-26 antes de la corrección. Fallaba de forma estable "un paquete ya revisado en otra visita se descarga sin volver a confirmar".

**Observación FE171-01 (Baja, Jorge / Andrea): el fallo está en la prueba, no en la aplicación.** El simulado de esa prueba responde con `new Response(new Blob(['PK']))`. En el entorno de pruebas (jsdom con Node 22) ese `Blob` no es aceptado por `Response` ("object.stream is not a function"), así que la petición falla y la pantalla muestra "No hay conexión con el servidor". Comprobado aislando la causa: con `new Response('PK', …)` la respuesta funciona. La descarga real del navegador no usa ese simulado.

**Corrección aplicada en esta rama** (solo la prueba, con aviso a Jorge): el cuerpo del simulado pasa de `new Blob(['PK'])` a `'PK'`. Tras el cambio, `Investigacion.test.tsx` da **9/9**. No se tocó código de la aplicación.

## 5. Pendiente: importación en ATLAS.ti

| Paso | Resultado |
|---|---|
| Versión y plataforma de ATLAS.ti de la Fundación | Pendiente |
| Importar `INV-001.docx` e `INV-002.docx` como documentos | Pendiente |
| Comprobar texto, secciones y acentos dentro de ATLAS.ti | Pendiente |
| Usar el manifiesto para crear los códigos `QA-CAT-01` a mano o por grupo de documentos | Pendiente |

Para ejecutarlo hace falta una instalación de prueba (o licencia de evaluación) y el ZIP ficticio de la suite. Hasta entonces la interoperabilidad se da por **comprobada en formato**, no en el producto.

## 6. Hallazgos

El paquete generado es correcto: DOCX válidos y TXT en UTF-8, con el texto íntegro y sin datos identificatorios ni financieros, y la revisión es obligatoria y se invalida si el texto cambia. El único problema fue FE171-01, en una prueba de interfaz y no en la aplicación; ya está corregido. Falta la importación real en ATLAS.ti (sección 5).

## 7. Cierre

- [x] Suite QA y regresión ejecutadas; resultados en la matriz (9/9 y 15/15, 2026-11-26).
- [x] FE171-01 corregido en la prueba (9/9); [ ] avisar a Jorge para que lo revise.
- [ ] Importación en ATLAS.ti (sección 5).

# FE-166 — Verificar importación y protección de registros antiguos

- **Historia:** FE-9, importar pacientes y antecedentes históricos con revisión de duplicados.
- **Base probada:** `main` integrado (`d614395`), en la rama `feature/FE-166-verificacion-importacion`. Incluye los lotes y la deduplicación de Alejandro (FE-163), la API de Adriana (FE-164), el asistente de Jorge (FE-165) y la tabla de revisión de Andrea (FE-162).
- **Referencia:** `docs/srs/sprint-3/FE-162-importacion-historica.md` (estados por fila y aceptación, sección 6).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `d614395` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** suite QA 7/7 (6,3 s); regresión FE-163/FE-164 18/18; interfaz 13/13. Sin defectos.

## 1. Alcance

`importacion-postgres.test.mjs` (Alejandro) cubre la base y `importacion-api-postgres.test.mjs` (Adriana) la carga y la corrección por la API. La suite QA `backend/test/importacion-qa-api-postgres.test.mjs` se centra en lo que pide FE-166: **que una importación no modifique registros antiguos**. Antes de importar se toma una "fotografía" completa (todas las columnas) del paciente, la carpeta, la ficha de diagnóstico, la asignación y las sesiones de dos carpetas antiguas, y se compara después de cada paso.

Datos ficticios: carpeta antigua E (con diagnóstico, sesión, terapeuta y residencia La Paz) y carpeta antigua F. El CSV trae una fila nueva, una fila con el mismo tipo y número que E (pero otra residencia, otro diagnóstico y otros antecedentes), una fila con fecha imposible y una fila cuyo nombre es una fórmula de Excel.

## 2. Cómo ejecutar

Requisito previo: los roles `anon` y `authenticated` en el PostgreSQL local, hasta que se fusione el fix de FE133-01. Si el build falla con `Cannot find module`, correr `npm ci`.

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/importacion-qa-api-postgres.test.mjs
node --test --test-force-exit test/importacion-postgres.test.mjs test/importacion-api-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

## 3. Matriz de aceptación

| # | Escenario | Esperado | Observado | Resultado |
|---|---|---|---|---|
| M1 | Permisos | Terapeuta 403, marketing 403, sin sesión 401 en cargar, consultar y confirmar; ningún lote creado | 403/403/401; 0 lotes | Aprobado |
| M2 | Archivos inválidos | `.pdf` y `.exe` → 415; vacío, encabezados ajenos, PDF renombrado a `.csv` y XLSX corrupto → 400; más de 5 MB → 413; ningún lote creado | 7/7 con el código esperado; 0 lotes | Aprobado |
| M3 | Vista previa | Nueva = `valida_nueva`, mismo tipo y número que E = `posible_duplicado`, fecha imposible = `error` con la causa; no crea pacientes ni casos; registros antiguos idénticos | Estados correctos; 0 altas; fotografía idéntica | Aprobado |
| M4 | Confirmación bloqueada | Con filas pendientes → 422; decisión con versión vieja → 409; nada cambia | 422 y 409; fotografía idéntica | Aprobado |
| M5 | Vincular a E y confirmar | Se crean solo las filas nuevas; **paciente, carpeta, ficha de diagnóstico, asignación y sesiones de E y F idénticos** a la fotografía inicial; la nueva conserva su fecha histórica y recibe un número que no choca; una fórmula se guarda como texto literal | Solo altas nuevas; fotografía de E y F idéntica en las 5 tablas; fecha histórica y número sin choque | Aprobado |
| M6 | Repetir | Segunda confirmación sin efectos; volver a subir el mismo archivo → 409; nada duplicado | Sin efectos; resubida 409; sin duplicados | Aprobado |
| M7 | Otro lote sobre la carpeta F | Corregir la fila e intentar crear con un número ocupado no confirma; F sigue intacta | No se confirma; F intacta | Aprobado |
| R1 | Regresión FE-163 y FE-164 | En verde | 18/18 | Aprobado |

## 4. Observaciones de la revisión del código (antes de ejecutar)

1. El tipo de archivo se decide solo por la **extensión** (`.csv` o `.xlsx`); el contenido se valida al leerlo. M2 comprueba que un PDF renombrado a `.csv` se rechace en la lectura.
2. **Fórmulas de Excel en los datos.** Un nombre como `=HYPERLINK(...)` se acepta como texto. No es un riesgo en la importación, pero sí puede serlo si después se **exporta** a CSV o Excel (inyección de fórmulas). Conviene revisarlo en las exportaciones.
3. La validación con un archivo histórico real y autorizado de la Fundación sigue pendiente (FE-162). Todo lo probado aquí es ficticio.

## 5. Interfaz

Las 13 pruebas existentes (`Importacion.test.tsx` de Jorge y `TablaRevisionImportacion.test.tsx` de Andrea) pasan (2026-11-26). Cubren la carga multipart con el origen, la vista previa y los filtros, la decisión por fila (crear, vincular, excluir), la corrección de datos, la confirmación con aceptación del avance del contador, el 409 por archivo repetido con enlace al lote y la tabla accesible en celular. No se agregaron pruebas de interfaz: el foco de FE-166 es la protección de los datos en el servidor.

## 6. Hallazgos

No se encontraron defectos: ningún paso de la importación (vista previa, decisiones, vincular, confirmar, repetir, segundo lote) modificó a los pacientes, las carpetas, las fichas de diagnóstico, las asignaciones ni las sesiones existentes. Quedan como observaciones la posible inyección de fórmulas al exportar (punto 2) y la validación pendiente con un archivo real autorizado (punto 3).

## 7. Cierre

- [x] Suite QA y regresión ejecutadas; resultados en la matriz (7/7 y 18/18, 2026-11-26).
- [x] Interfaz: 13/13 existentes en verde (2026-11-26).

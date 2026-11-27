# FE-155 — Contrastar informes con los datos del caso

- **Historia:** FE-15, generar y revisar informes sistémicos y judiciales desde el caso.
- **Base probada:** `main` integrado (`c39dee3`), en la rama `feature/FE-155-verificacion-informes`. Incluye la fotografía de datos de Alejandro (FE-152), la generación y revisión de Adriana (FE-153) y la interfaz de Jorge (FE-154).
- **Referencia:** `docs/srs/sprint-3/FE-151-plantillas-informes.md` (plantillas `fe151-sistemica-v2` y `fe151-judicial-v2`, sección 6 de aceptación).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `c39dee3` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** suite QA 8/8 aprobadas y 1 `todo`; regresión 23/23 que confirma el defecto FE155-01; interfaz 11/11.

## 1. Alcance

Las suites existentes comprueban la fotografía de datos en SQL (`informes-postgres`) y el servicio (`informes-generacion-postgres`). Esta suite QA (`backend/test/informes-qa-api-postgres.test.mjs`) **contrasta el texto del informe con los datos del caso** pasando por la API HTTP real, como lo vería la terapeuta.

Datos ficticios: caso A con evaluación inicial, diagnóstico e hipótesis, tres sesiones (se eligen la 3.ª y la 1.ª), una madre registrada y un pago de 987,65; caso B con su propia sesión; caso C sin diagnóstico ni sesiones; caso J derivado con juzgado y expediente ficticios.

## 2. Cómo ejecutar

Requisito previo: los roles `anon` y `authenticated` en el PostgreSQL local (FE133-01). Si el build falla con `Cannot find module`, correr `npm ci`.

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/informes-qa-api-postgres.test.mjs
node --test --test-force-exit test/informes-postgres.test.mjs test/informes-generacion-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

## 3. Matriz de aceptación

| # | Escenario (FE-151 §6) | Esperado | Observado | Resultado |
|---|---|---|---|---|
| I1 | Sistémico del caso A con las sesiones 3 y 1 | 5 secciones v2; identificación y profesional correctos; la evaluación incluye evaluación inicial, diagnóstico e hipótesis; cita solo las sesiones elegidas, ordenadas por fecha; conclusiones "Pendiente de redacción profesional" | Como se esperaba | Aprobado |
| I2 | Sin mezcla ni pagos | Ningún dato del caso B; ningún monto, "Bs", "BOB" ni "pago" | Sin datos de B ni del pago de 987,65 | Aprobado |
| I3 | Caso sin diagnóstico ni sesiones | "Sin datos registrados." y "Sin sesiones seleccionadas."; nada del caso A | Ausencias declaradas | Aprobado |
| I4 | Sesión de otro caso, inexistente o repetida | 4xx sin guardar informe; una sesión repetida se cita una sola vez | 4xx sin guardar; repetida citada una vez | Aprobado |
| I5 | Judicial | Destinatario y referencia del caso, objeto indicado, sesión citada; sin objeto → 422 `['objeto']`; sin juzgado → 422 con `judicial.juzgado`; nada guardado | Como se esperaba; 422 sin guardar | Aprobado |
| I6 | Revisar y luego cambiar el diagnóstico | Revisión 200 y segunda revisión 409; el revisado conserva el diagnóstico de su momento y la conclusión escrita; una nueva generación usa el diagnóstico nuevo | 200, luego 409; revisado intacto; la nueva generación usa el dato nuevo | Aprobado |
| I7 | Permisos | Terapeuta ajena 404, marketing 403, administración 403, sin sesión 401 (generar y consultar); la versión de A no se abre por la ruta de B | 404/403/403/401; 404 entre casos | Aprobado |
| I8 | Solicitud inválida | Tipo desconocido, sesión que no es UUID, `incluirFamilia` no booleano, texto de conclusiones enviado por el cliente → 400 | 400 en los 4 casos | Aprobado |
| I9 | **FE155-01:** familia seleccionada | Con "Composición familiar" marcada, la madre registrada figura en el informe (plantilla A, punto 4) | Con y sin la casilla el informe es idéntico (5 secciones, sin la madre) | **Defecto confirmado** |
| R1 | Regresión FE-152 y FE-153 | En verde | 23/23; 1 omitida a propósito (variante sin migración 012) | Aprobado |

## 4. Hallazgo previo a la ejecución

**FE155-01 (Media, Adriana / Andrea): la composición familiar seleccionada no aparece en el texto del informe.**

- La pantalla "Generar informe" ofrece la casilla **"Composición familiar"**, marcada por defecto (`PaginaInformes.tsx`), y la API la recibe (`incluirFamilia`).
- La fotografía de datos sí guarda la familia (`informe-fotografia.ts`), pero **ninguna plantilla v2 la escribe**: `plantilla-sistemica.ts` genera Identificación, Profesional, Evaluación, Intervención y Conclusiones; `plantilla-judicial.ts` tampoco tiene sección familiar. `GET /informes/:versionId` no devuelve la fotografía, así que la familia no es visible en ninguna parte del informe.
- FE-151 (plantilla A, punto 4) pide "Contexto familiar y genograma, si se seleccionan". Tampoco se escriben las **tareas** que el punto 6 menciona ("sesiones seleccionadas y tareas pertinentes").
- La prueba I9 está marcada como `todo`: documenta el comportamiento esperado sin poner roja la suite. Cuando se corrija, se quita la marca.
- Propuesta: agregar una sección "Contexto familiar" (parentesco respecto del paciente, nombre o "no registrado", edad) cuando `incluirFamilia` sea verdadero, o quitar la casilla si la PO decide que la familia no va en el texto. La decisión es de Andrea como PO.

## 5. Interfaz

Las 11 pruebas existentes de `Informes.test.tsx` (Jorge) pasan (2026-11-26): generar el borrador sistémico con las sesiones elegidas, corregirlo, revisarlo y exportarlo; el 422 judicial explicado; el 409 de doble revisión sin perder lo escrito; administración y terapeuta ajena sin acceso; el listado para volver a abrir un borrador. No se agregaron pruebas de interfaz: lo que falta (FE155-01) es del contenido generado por el backend.

## 6. Hallazgos

- **FE155-01 confirmado (Media, Adriana / Andrea):** con "Composición familiar" marcada y sin marcar, el informe generado es **idéntico**: las mismas 5 secciones y ninguna mención de la madre registrada. La casilla de la interfaz no tiene ningún efecto visible y la plantilla A de FE-151 no se cumple en su punto 4 (ni en las tareas del punto 6). Detalle y propuesta en la sección 4.
- Todo lo demás coincide con los datos del caso: sesiones elegidas y su orden, evaluación vigente, ausencias declaradas, conclusiones sin inventar, separación entre casos, sin pagos, informe judicial con mínimos, versiones revisadas inalterables y permisos.

## 7. Cierre

- [x] Suite QA ejecutada; resultados en la matriz (8/8 + FE155-01 confirmado, 2026-11-26).
- [x] Regresión FE-152/FE-153 (R1): 23/23.
- [ ] FE155-01 comunicado a Andrea y Adriana.
- [x] Interfaz: 11/11 existentes en verde (2026-11-26).

## Corrección de FE155-01 por Andrea

Las plantillas nuevas `fe151-sistemica-v3` y `fe151-judicial-v3` representan Contexto familiar cuando se selecciona: parentesco, nombre, nacimiento o edad referida con su fecha, ocupación y trabajo/estudio disponibles. Sin selección no se agrega la sección; una ficha ausente/vacía se declara explícitamente. Se incluyen las tareas de las sesiones elegidas. No se agregan conclusiones inventadas, pagos ni datos de otros casos. Los informes ya revisados conservan sus secciones y versión anteriores. No requiere migración.

Se activa I9 de la suite QA y se agrega I10 para comprobar tareas elegidas/omitidas. El simulador se alinea con la selección familiar en ambas plantillas y con las tareas. La validación institucional sigue en FE-212; esta corrección cumple el contrato técnico aceptado por la PO.

Verificación de la corrección: 498 pruebas de integración aprobadas, 13 omitidas por entorno y cero fallos; 283 unitarias backend y 299 frontend aprobadas, compilaciones/lint satisfactorios. I9 está activa e I10 comprueba la selección de tareas.

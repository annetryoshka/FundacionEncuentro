# FE-128 — Verificar la ficha ampliada y la regresión del diagnóstico

**Actualización posterior:** la adecuación de evaluación inicial obligatoria y diagnóstico opcional está implementada y verificada con apoyo de Andrea; ver [evidencia actual](evaluacion-inicial.md). El informe siguiente conserva el corte histórico y los resultados de las versiones identificadas.

- **Historia:** FE-110, registrar la composición familiar y consultar el resumen inicial de la ficha.
- **Base probada:** rama `feature/FE-126-ficha-familiar`, commit `1c7ad98` (API de Adriana, FE-126), que ya incluye `836d5da` (migración 015 de Alejandro, FE-125).
- **Referencia:** contrato FE-123 (`docs/srs/sprint-3/FE-123-ficha-familiar-y-diagnostico.md`, commit `832d464`), FE-66 y FE-70.
- **Trazabilidad:** RF-02, RF-08, RF-11.
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `1c7ad98` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** suite QA 10/10 aprobadas (15,0 s); regresión de FE-125 y FE-126 14/14 aprobadas (12,2 s). La interfaz sigue pendiente.

## 1. Alcance

| Parte | Estado | Cómo se prueba |
|---|---|---|
| Base de datos (FE-125) | Lista | PostgreSQL 17 local desechable con todas las migraciones |
| API familia y diagnóstico vigente (FE-126) | Lista | NestJS HTTP real con guards reales; solo Supabase Auth es un doble |
| Formulario familiar y orden de la ficha (FE-127) | **Pendiente (Jorge)** | Bloqueado: cancelación, navegación y móvil (sección 5) |
| Componente de resumen (FE-124) | **Pendiente (Andrea)** | Bloqueado |

Todos los datos son ficticios. Cada ejecución crea una base `fe128_*` en tu PostgreSQL local y la borra al terminar. No se conecta a Supabase.

## 2. Cómo ejecutar

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test test/ficha-familiar-qa-postgres.test.mjs
node --test test/familia-api-postgres.test.mjs test/familiares-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

La primera suite es la de QA (FE-128). La segunda línea vuelve a correr las suites de Adriana y Alejandro como regresión.

## 3. Matriz de aceptación

| # | Escenario (FE-110 / FE-123 / FE-66) | Esperado | Observado | Resultado |
|---|---|---|---|---|
| Q1 | Ficha A: crear padre 44, madre 41, hermana (con nacimiento) y abuela materna 68; recargar | 200, versión 1, mismos datos al recargar, parentescos respecto del paciente, autoría de la terapeuta | Como se esperaba | Aprobado |
| Q2 | Ficha B: hijo, dos tíos (parentesco repetido), abuelo con todo desconocido, "otro" con detalle; ficha registrada sin integrantes | Desconocidos en `null` (sin textos inventados), nombre de solo espacios → `null`, `registrada: true` con lista vacía | Como se esperaba | Aprobado |
| Q3 | Dos ediciones parciales (una de administración); `null` explícito | Se conservan los demás campos e integrantes; `null` limpia; `creadoPor` se mantiene; `actualizadoPor` = quien editó | Como se esperaba | Aprobado |
| Q4 | Regresión: editar la familia ↔ editar el diagnóstico | Ninguno cambia al otro; el diagnóstico conserva su ID y su autoría (FE-66) | Como se esperaba | Aprobado |
| Q5 | Fuente vigente: sin datos → alta → ficha | `origen` cambia en ese orden; un `null` de la ficha no se rellena con el alta; el alta se conserva | Como se esperaba | Aprobado |
| Q6 | 15 entradas inválidas (catálogo, "otro" sin detalle, fechas futuras o imposibles, edad sin referencia, nacimiento y edad a la vez, límites, autoría enviada por el cliente, campo extra, ID duplicado) | 400 y la ficha queda igual (sin escrituras parciales) | 15/15 con 400 y sin cambios | Aprobado |
| Q7 | Usar el ID de un familiar de otro caso (editar o eliminar) | 404; ninguna de las dos fichas cambia | 404 / 404, sin cambios | Aprobado |
| Q8 | Versión vieja, o `null` sobre una ficha ya registrada | 409 sin cambios | 409 / 409 | Aprobado |
| Q9 | Eliminar un integrante y luego intentar editarlo | Desaparece de la lista; editarlo da 404; la fila se conserva con `deleted_at` | Como se esperaba | Aprobado |
| Q10 | Permisos en `/familia` y `/diagnostico/vigente` | Sin sesión o token inventado → 401; marketing → 403; terapeuta ajena → 404; administración → 200; carpeta inexistente → 404; ID no UUID → 400 | Como se esperaba | Aprobado |
| R1 | Regresión: suites de FE-125 y FE-126 | Todas en verde | 14/14 | Aprobado |

## 4. Observaciones de la revisión del código (antes de ejecutar)

1. **Cambio de semántica en el PUT de diagnóstico.** El guardado pasó de reemplazar el JSON (`contenido = excluded.contenido`) a combinarlo (`contenido || excluded.contenido`). Esto conserva los campos adicionales, como pedía FE-126. Como el DTO siempre envía los tres campos, omitir `hipotesisRelacional` sigue limpiándolo (se guarda `null`). Q4 y Q5 lo cubren. Confirmar con Andrea que es el comportamiento esperado.
2. **Hallazgos de FE-70 todavía abiertos** (FE-123 §4): FE-66 pide *evaluación inicial* obligatoria y *diagnóstico de ingreso* opcional, pero la API sigue exigiendo `diagnosticoIngreso`. FE-123 indica mantener el contrato actual hasta ratificarlo, así que no es un defecto de FE-126.
3. **Menores de estilo:** sangría irregular en `obtenerVigente` y `guardar`, y archivos sin salto de línea final. No afectan el funcionamiento.

## 5. Pendiente: interfaz (cuando se integren FE-124 y FE-127)

| Paso | Esperado | Escritorio | Móvil |
|---|---|---|---|
| Abrir una ficha con familia | Orden: datos generales → familia → genograma → diagnóstico → historial | | |
| Registrar un familiar con datos desconocidos y recargar | Se ve "desconocido", no un texto inventado | | |
| Editar y **cancelar** | No se guarda nada; la versión no cambia | | |
| Lista vacía frente a fallo de red | Mensajes distintos | | |
| Dos pestañas editando a la vez | La segunda recibe aviso de conflicto (409) | | |
| Navegación Atrás y recarga | Sin pérdida de datos ni pantallas clínicas tras cerrar sesión | | |

## 6. Hallazgos

La ejecución del backend no encontró defectos: la API y la base cumplen los criterios de FE-110 y FE-123 que se pueden comprobar sin interfaz. Quedan abiertas las observaciones de la sección 4, que necesitan una decisión de la PO, y la prueba de interfaz de la sección 5.

## 7. Cierre

- [x] Suite QA y regresión ejecutadas; resultados en la matriz (10/10 y 14/14, 2026-11-26).
- [ ] Observaciones 1 y 2 comunicadas a Andrea y Adriana.
- [ ] Prueba de interfaz (sección 5) cuando FE-127 esté listo. Hasta entonces, FE-128 queda **en curso**.

## Decisión posterior de la PO · 26/11/2026

Andrea confirmó evaluación inicial obligatoria y diagnóstico de ingreso opcional. El cambio de FE-126 que combina el JSON conserva claves adicionales y se mantiene como protección de integridad. En la API actual, omitir hipótesis/comentarios todavía los limpia: no confundir ese PUT de formulario completo con una edición parcial.

Los resultados anteriores corresponden a los commits identificados en este informe y no certifican la nueva regla. Tras adaptar API y formulario, verificar: evaluación sin diagnóstico, evaluación vacía rechazada, lectura de fichas antiguas, edición con evaluación, diagnóstico `null` sin recuperación desde el alta, conservación de claves adicionales/familia/genograma y propagación a historial/informes/exportaciones. El contrato actualizado está en FE-123 §4.

## Adecuación posterior realizada por Andrea · 26/11/2026

Se completaron API, migración 021, formulario, tipos, historial, informes/exportaciones y simulador. Regresión: 279 unitarias backend, 275 frontend, 413 de integración con PostgreSQL local y dos recorridos en Chromium (escritorio y móvil emulado). Cero fallos; 13 pruebas de integración omitidas con motivo registrado. La evaluación puede guardarse sin diagnóstico, y las fichas antiguas y sus informes revisados no se reescriben. La [evidencia actual](evaluacion-inicial.md) detalla los casos y el paso de despliegue de la 021 en Supabase.

# FE-176 — Conciliación de gastos (preparación)

HU FE-5 · Responsable: Gemina Ponce · Revisión: Emilia · Contrato: [FE-172](../../srs/sprint-3/FE-172-control-administrativo.md)

**Estado: BLOQUEADA al 2026-11-26** (`main` en `c806c34`). No existen todavía la API `/api/gastos` ni la pantalla de gastos (FE-173, FE-174 y FE-175; acta FE-196). Aquí queda preparado el guion para ejecutarlo cuando se integren. **Ningún paso contra la aplicación se ha ejecutado.**

## Datos ficticios

| ID | Fecha | Tipo | Monto Bs |
| --- | --- | --- | ---: |
| G1 | 2026-11-20 | Internet / Wi-Fi | 120.00 |
| G2 | 2026-11-21 | Electricidad | 80.00 |
| G3 | 2026-11-22 | Alquiler | 1500.00 |

No son costos reales de la Fundación.

## Cotejo aritmético previo (en centavos, sin la aplicación)

| Paso | Operación | Total esperado |
| --- | --- | ---: |
| Inicial | 120.00 + 80.00 + 1500.00 | 1700.00 |
| Corregir G2 a 85.00 | 120.00 + 85.00 + 1500.00 | 1705.00 |
| Anular G1 | 85.00 + 1500.00 | 1585.00 |

## Guion de ejecución

| # | Paso | Resultado esperado | Resultado observado |
| --- | --- | --- | --- |
| 1 | Administración registra G1, G2 y G3 y consulta 2026-11 | Total 1700.00 y totales por categoría | Bloqueado |
| 2 | Corregir G2 a 85.00 y recargar | 1705.00; queda traza de la corrección | Bloqueado |
| 3 | Anular G1 con confirmación | 1585.00; G1 sigue identificable | Bloqueado |
| 4 | Repetir la anulación de G1 | Sigue en 1585.00 | Bloqueado |
| 5 | Consultar 2026-12 sin gastos | Lista vacía y Bs 0,00 | Bloqueado |
| 6 | Monto 0, negativo o con tres decimales | Rechazado sin escritura parcial | Bloqueado |
| 7 | Fecha inválida o futura; categoría desconocida; «otros» sin descripción | Rechazado sin escritura parcial | Bloqueado |
| 8 | Terapeuta, marketing y visitante intentan registrar, corregir, anular y consultar | Denegado, también contra la API | Bloqueado |
| 9 | Los gastos no alteran los pagos de sesiones del mismo período | Pagos e indicadores sin cambios | Bloqueado |
| 10 | Simular un fallo de carga | Error visible, distinto de «0,00» | Bloqueado |

## Registro al ejecutar

| Campo | Valor |
| --- | --- |
| Commit probado | |
| Migraciones aplicadas | |
| Entorno y fecha | |
| Hallazgos | |
| Revisado por Emilia | |

## Guía de uso

Se redacta cuando exista la pantalla de gastos.

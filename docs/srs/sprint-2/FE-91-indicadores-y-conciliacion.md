# FE-91 · Indicadores y conciliación manual

Entregable de análisis para FE-6. El dashboard está disponible para administración.

| Indicador | Cálculo | Fecha |
|---|---|---|
| Casos actuales | Contar una vez cada caso con paciente y caso no eliminados, incluidos casos concluidos. | Estado actual. |
| Casos por estado | Agrupar el mismo universo en Iniciado, En proceso y En conclusión. | Estado actual. |
| Sesiones del período | Contar cada sesión por identificador, sin multiplicarla por tareas o pagos. | Fecha de sesión, extremos incluidos. |
| Pagos recibidos | Sumar una vez cada pago registrado en BOB, con precisión de centavos. | Fecha de pago, extremos incluidos. |

Interpretar las fechas según el calendario de Bolivia. El selector afecta sesiones y pagos. Etiquetar el total monetario como «Pagos recibidos».

## Datos ficticios y resultado

Casos A y D iniciados, B en proceso y C en conclusión. Se registran cinco sesiones y cuatro pagos.

| Sesión | Fecha de sesión | Fecha de pago | Importe BOB |
|---|---|---|---:|
| S-A1 | 2026-10-12 | 2026-10-12 | 75,50 |
| S-A2 | 2026-10-12 | 2026-10-20 | 40,25 |
| S-B1 | 2026-10-19 | 2026-10-19 | 125,00 |
| S-C1 | 2026-10-11 | 2026-10-15 | 25,10 |
| S-D1 | 2026-10-20 | — | — |

| Período inclusivo | Casos actuales | Iniciados / en proceso / en conclusión | Sesiones | Pagos BOB |
|---|---:|---|---:|---:|
| 12–19 de octubre de 2026 | 4 | 2 / 1 / 1 | 3 | 225,60 |
| 1–5 de octubre de 2026 | 4 | 2 / 1 / 1 | 0 | 0,00 |

En el primer período entran S-A1, S-A2 y S-B1. Los pagos incluidos son los de S-A1, S-B1 y S-C1 por sus propias fechas. Agregar dos tareas a S-A1 debe dejar el resultado en Bs 225,60. Un error de consulta se presenta como error, con opción de reintentar. Una consulta directa de un rol no administrativo se deniega.

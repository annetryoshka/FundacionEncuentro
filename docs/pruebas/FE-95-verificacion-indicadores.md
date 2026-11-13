# FE-95 — Conciliar indicadores y probar límites de fecha

Historia FE-6 · Especificación [FE-91](../srs/sprint-2/FE-91-indicadores-y-conciliacion.md) ·
Implementación FE-93 (API, PR #33) y FE-94 (función SQL, en curso) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama de la HU `feature/FE-93-api-indicadores` (`307ffe4`), con la migración
`011_indicadores_operativos.sql` (idéntica a la de FE-94). Se verifica `GET /api/indicadores?desde&hasta`
por HTTP real: conciliación manual de FE-91, extremos del período, cambio de mes, casos eliminados,
moneda, validaciones, permisos y error de consulta. La interfaz (FE-92) está en otra rama sin integrar.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/indicadores-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real con `AuthModule` e `IndicadoresModule`, guards y `ValidationPipe` reales, PostgreSQL 17
local recién creado con locale ICU `es-BO`, todas las migraciones de la rama y los datos ficticios de
FE-91. Solo se simula la respuesta de Supabase Auth. La suite crea una base aleatoria `fe95_run_*` y la
elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55442/fe40_qa'
node --test test/indicadores-api-postgres.test.mjs
```

## Datos (FE-91)

| Sesión | Caso (estado)  | Fecha de sesión | Fecha de pago | Importe BOB |
| ------ | -------------- | --------------- | ------------- | ----------: |
| S-A1   | A (iniciado)   | 2026-10-12      | 2026-10-12    |       75,50 |
| S-A2   | A (iniciado)   | 2026-10-12      | 2026-10-20    |       40,25 |
| S-B1   | B (en proceso) | 2026-10-19      | 2026-10-19    |      125,00 |
| S-C1   | C (concluido)  | 2026-10-11      | 2026-10-15    |       25,10 |
| S-D1   | D (iniciado)   | 2026-10-20      | —             |           — |

## Matriz de pruebas

| #   | Criterio                | Comprobación                                                                                                                                                                   | Resultado     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | Conciliación FE-91      | 12–19 oct → 4 casos (2/1/1), 3 sesiones, Bs 225,60, moneda BOB                                                                                                                 | ✔             |
| 2   | Período sin movimientos | 1–5 oct → 0 sesiones y 0 de pagos; los 4 casos actuales se conservan                                                                                                           | ✔             |
| 3   | Formato del total vacío | El total sin pagos debería ser `"0.00"`                                                                                                                                        | ✔ (D1 corregido) |
| 4   | Extremos inclusivos     | 20–20: 1 sesión, 40,25 · 11–11: 1 sesión, 0 · 13–18: 0 sesiones, 25,10 · 11–20: 5 sesiones, 265,85                                                                             | ✔             |
| 5   | Cambio de mes           | Sesión 31/10 con pago 01/11: octubre cuenta la sesión, noviembre el pago, 31/10–01/11 ambos                                                                                    | ✔             |
| 6   | Tareas no multiplican   | Dos tareas en S-A1 → siguen 3 sesiones y Bs 225,60                                                                                                                             | ✔             |
| 7   | Eliminados              | Caso C eliminado → 3 casos, 0 concluidos, Bs 200,50; paciente de B eliminado → 2 casos, 2 sesiones, Bs 75,50                                                                   | ✔             |
| 8   | Suma manual y moneda    | Total de la API = `sum(monto)` en SQL solo BOB (265,85); un pago en USD no se mezcla                                                                                           | ✔             |
| 9   | Validaciones            | Período invertido, 30/02, 29/02/2026, `2026-10-1`, `12/10/2026`, vacía, falta desde, falta hasta, sin parámetros y parámetro desconocido → 400; un solo día y 29/02/2028 → 200 | ✔             |
| 10  | Permisos                | Terapeutas y marketing → 403 sin montos; sin token o token falso → 401                                                                                                         | ✔             |
| 11  | Error de consulta       | Función SQL no disponible → 500 sin detalles internos; la consulta siguiente funciona                                                                                          | ✔             |

## Resultado

Primera ejecución (`21fb593`): 10 aprobadas, 0 fallidas y 1 `todo` (D1), en tres ejecuciones (≈ 10–18 s).

Reverificación (2026-11-13) sobre `7e2c490`, con el fix de D1 y sin el `todo`, contra un PostgreSQL 17
recién creado: **11 aprobadas, 0 fallidas, 0 `todo`**, en dos ejecuciones consecutivas. Regresión: las 212
pruebas unitarias de `src` siguen aprobadas.

## Defectos

### FE-95-D1 · El total sin pagos llega como `"0"` en vez de `"0.00"` — **Corregido**

- **Estado:** corregido por Adriana en `7e2c490` con `round(pagos_recibidos, 2)::text`, que también quitó
  el `todo` de la prueba 3. Reverificado: la prueba 3 pasa y la suite completa da 11/11.

- **Severidad:** baja. No altera los cálculos, pero rompe el formato de los montos.
- **Pasos:** `GET /api/indicadores?desde=2026-10-01&hasta=2026-10-05` con los datos de FE-91.
- **Esperado:** `"pagosRecibidos": { "monto": "0.00", "moneda": "BOB" }`, igual que los demás montos
  (`"225.60"`, y `"75.50"` en pagos). FE-91 muestra el resultado como «0,00».
- **Obtenido:** `"monto": "0"`.
- **Causa:** `indicadores_operativos` usa `coalesce(sum(g.monto), 0)`, y el `0` entero no tiene decimales.
- **Corrección sugerida:** en `indicadores.service.ts`, cambiar `pagos_recibidos::text` por
  `round(pagos_recibidos, 2)::text`. Al corregirlo, quitar el `todo` de la prueba 3 y repetir la suite;
  Adriana revisa el cambio.

## Observaciones

- **O1:** la suite arma su propia app de prueba con `IndicadoresModule`, porque el helper compartido
  `servidor()` solo incluye los módulos de casos. Así no se modifica un archivo que comparten otras ramas.
- **O2:** se subió `connectionTimeoutMillis` a 10 s. En Windows, la primera conexión a PostgreSQL en frío
  puede tardar más de 3 s y hacía fallar el `before` de forma intermitente, sin dejar rastro en el log
  del servidor.
- **O3:** FE-94 sigue en curso. Si cambia la migración 011, hay que repetir esta suite.

## Pendiente

- Probar la interfaz del dashboard (FE-92) y el selector de período cuando se integre con esta API.

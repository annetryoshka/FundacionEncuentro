# FE-173 — Persistir gastos básicos y calcular totales mensuales

Historia FE-5 (RF-25) · Insumo [FE-172](../srs/sprint-3/FE-172-control-administrativo.md) (alcance confirmado por la PO el 26/11/2026) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-173-gastos-mensuales` sobre `main` en `abcc9b8`. Solo base de datos y pruebas.
La API es de FE-174 (Emilia, revisión de Adriana); la pantalla, de FE-175 (Jorge); la verificación, de FE-176 (Gemina).

| Archivo | Cambio |
|---|---|
| `db/migrations/021_gastos_funcionamiento.sql` | `movimientos_contables` (001) para gastos `egreso`: categorías, fecha no futura, monto exacto, descripción, anulación con autor y motivo, autoría por la base, sin borrado; `consultar_gastos_mes`, `anular_gasto`, `gasto_json`; RLS y permisos |
| `backend/test/gastos-postgres.test.mjs` | 14 pruebas sobre PostgreSQL local |
| `db/migrations/README.md` | Columnas, flujo y errores para FE-174/FE-175 |

Numeración: 019 y 020 ya están en `main`; 021 no la usa ninguna rama (revisado por contenido en todas las ramas remotas).

## Decisiones

- **Se reutiliza `movimientos_contables`** con `tipo = 'egreso'`, como indica FE-172. Las reglas nuevas aplican solo a los
  gastos; los ingresos no cambian (no hay código que los use todavía). Un gasto nunca lleva `pago_id`.
- **Monto:** `numeric(10,2)` redondeaba un tercer decimal sin avisar; se cambia a `numeric` con check, como `pagos` en la 010.
  Se guarda siempre con dos decimales (`1500` → `1500.00`).
- **Fecha:** sin valor por defecto (en Supabase `current_date` es UTC); no futura según la hora de Bolivia; desde 2000-01-01
  para atajar años mal escritos.
- **Corrección:** `update` normal sobre un gasto vigente; la base conserva autor y fecha de alta y registra quién corrigió.
- **Anulación:** `anular_gasto(id, motivo)`, motivo opcional. Repetirla devuelve el mismo gasto sin escribir. Un anulado
  no se modifica ni vuelve a quedar vigente; ningún gasto se elimina.
- **Permisos en la base:** solo administración activa registra, corrige, anula y consulta (`42501` para el resto), además del
  control de la API.
- **Consulta:** una sola función con el formato de `GET /api/gastos?mes=` de FE-172: lista del mes con anulados marcados,
  total del mes y las cuatro categorías siempre presentes. Montos como texto decimal.
- Sin distribución de ingresos (fuera de HU5) y sin identificador de solicitud contra reenvíos (FE-172 actualizado no lo pide;
  el botón Guardar se desactiva mientras procesa).

## Entorno y comandos

PostgreSQL 17 local desechable (Docker, misma versión mayor que Supabase). La suite crea su base y la borra. No se usó Supabase.

```powershell
cd backend
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<clave>@localhost:55432/postgres'
node --test test/gastos-postgres.test.mjs
```

Datos de prueba: un ingreso previo de 75.50 cargado con 001–020; después se aplica la 021. Gastos ficticios del ejemplo de
FE-172 (noviembre 2026) y otros en meses vacíos para no mezclar totales.

## Matriz de pruebas

| # | Criterio (FE-5 / FE-172 §5) | Comprobación | Resultado |
|---|---|---|---|
| 1 | Migración sobre datos existentes | El ingreso previo conserva `75.50` y sigue sin reglas de gasto; un ingreso nuevo se registra y elimina sin usuario; un gasto sin fecha → `23502` | ✔ |
| 2 | Mes vacío | Septiembre: lista vacía, total `0.00`, cuatro categorías en cero | ✔ |
| 3 | Registrar y consultar el mes | Internet 120.00, electricidad 80.00, alquiler 1500 → total `1700.00`, por fecha, totales por categoría, autor administración, sin `pago_id`; el ingreso de octubre no suma | ✔ |
| 4 | Corregir y anular | Electricidad a 85.00 → `1705.00`; anular internet → `1585.00`, anulado visible en la lista, motivo recortado; repetir la anulación → mismo gasto, una sola escritura en auditoría | ✔ |
| 5 | Anulado inmutable, sin borrado | Corregir o reactivar un anulado (con y sin motivo) → `23514`; borrar un gasto → `23514` | ✔ |
| 6 | Cambio de mes | Electricidad pasa a octubre: sale de noviembre (`1500.00`) y entra en octubre (`85.00`); al volver, se restituye | ✔ |
| 7 | Varios por categoría y centavos | Dos «otros» de 0.10 y 0.20 en agosto → `0.30`; uno del 1 de septiembre no entra; máximo `99999999.99` aceptado | ✔ |
| 8 | Validación sin escrituras parciales | Monto 0, negativo, tres decimales o mayor al máximo; categoría desconocida, nula o en mayúsculas; fecha futura o anterior a 2000; otros sin descripción; descripción vacía o de 201; con `pago_id` → `23514`; monto o fecha nulos → `23502`; fecha imposible → `22008`; conteo sin cambios. Al corregir: tres decimales, fecha futura, otros sin descripción, cambiar el tipo o anulación a medias → `23514` | ✔ |
| 9 | Autoría del servidor | `registrado_por`, `creado_en` y campos de anulación enviados por el cliente se ignoran; anular por `update` directo usa autor y hora de la base y no admite cambiar datos | ✔ |
| 10 | Permisos | Terapeuta, marketing, usuario inexistente, sin `app.usuario_id` o administración inactiva → `42501` al registrar, corregir, anular y consultar; nada se escribe | ✔ |
| 11 | Mes de la consulta | `2026-13`, `2026-1`, `2026-00`, `noviembre`, `2026-11-01`, `1999-12`, vacío → `22023`; sin mes → mes actual de Bolivia | ✔ |
| 12 | Anular lo que no es gasto | Inexistente o un ingreso → `P0002`; el ingreso no cambia | ✔ |
| 13 | Auditoría | Altas, corrección, anulación y cambios de fecha con autor y montos antes/después | ✔ |
| 14 | Seguridad | RLS activo; `anon`/`authenticated` sin lectura de la tabla ni ejecución de las funciones | ✔ |

Comprobación de las pruebas: se quitaron a propósito, una por vez, la categoría obligatoria, el rechazo del tercer decimal,
la anulación idempotente, la exclusión de anulados en los totales, el rechazo de fecha futura, el control de rol, el bloqueo
de borrado, el límite superior del mes, la protección del autor y la inmutabilidad del anulado: las 10 mutaciones hicieron
fallar al menos una prueba.

## Resultado observado

| Comando | Resultado |
|---|---|
| `npm run build` (backend) | OK |
| `npm run test:unit` | 273/273 |
| `node --test --test-concurrency=1 test/*.test.mjs` con todas las suites de PostgreSQL | 419 pass, 0 fail, 13 skip (12 requieren Supabase Auth real, 1 variante sin la 012) |
| `gastos-postgres.test.mjs` | 14/14 |
| Frontend `lint`, `build`, `test` (sin cambios) | OK, OK, 271/271 |

## Pendiente

- **FE-174:** rutas de FE-172 §4 sobre este flujo (README «Gastos de funcionamiento»), validación en DTO y traducción de errores.
- **FE-175:** formulario, selector de mes y totales con `consultar_gastos_mes`; anulados marcados en la tabla.
- **FE-176:** reproducir el ejemplo de FE-172 por API y pantalla.
- Supabase: 021 no aplicada. Antes, comprobar que `movimientos_contables` no tenga filas `egreso` que incumplan las reglas
  nuevas (hoy no hay código que escriba en la tabla). No se probó con Supabase Auth real: el usuario se simula con
  `app.usuario_id`, como el backend.

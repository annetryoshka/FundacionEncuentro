# FE-90 — Probar pagos y apoyar correcciones backend

Historia FE-7 · Implementación FE-88 (API) y FE-89 (persistencia) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama de la HU `feature/FE-88-api-pagos-sesiones` (`80c885a`), que integra diagnóstico (FE-68),
sesiones (FE-73), tareas (FE-78) y la migración `010_pagos_por_sesion.sql` de FE-89.
Se verifica el backend de pagos (`POST` y `GET /api/carpetas/:id/pagos`) contra los ejemplos
de [FE-86](../srs/sprint-2/FE-86-reglas-de-pago-por-sesion.md). La interfaz (FE-87) está en otra
rama sin integrar; su prueba queda pendiente.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/pagos-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU `es-BO`,
todas las migraciones (001–004, 006, 008, 009 y 010) y datos ficticios. Solo se simula la
respuesta de Supabase Auth (`test/helpers/casos.mjs`). La suite crea una base aleatoria
`fe90_run_*` y la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/pagos-api-postgres.test.mjs
```

## Matriz de pruebas

| #   | Criterio                     | Comprobación                                                                                                                                                                                                                                                                                   | Resultado |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Sin pagos ≠ error            | `GET` responde 200 con `{ pagos: [] }`                                                                                                                                                                                                                                                         | ✔         |
| 2   | Registro (ejemplo FE-86)     | Bs 75,50 para S-A1 por QR → 200, `reutilizado: false`, monto exacto `"75.50"`, BOB, referencia recortada, `registradoPor` = administración; la recarga es idéntica; auditoría con un INSERT del administrador                                                                                  | ✔         |
| 3   | Repetición                   | La misma solicitud → 200, `reutilizado: true`, mismo pago; una referencia de espacios equivale a «sin referencia»; 1 fila y total Bs 75,50                                                                                                                                                     | ✔         |
| 4   | Doble solicitud simultánea   | 5 solicitudes iguales en paralelo → un único pago nuevo; todas devuelven el mismo id; total Bs 75,50                                                                                                                                                                                           | ✔         |
| 5   | Misma sesión con otros datos | Monto, fecha, método o referencia distintos → 409; el pago original se conserva                                                                                                                                                                                                                | ✔         |
| 6   | Importes y datos inválidos   | 18 cuerpos inválidos (cero, negativo, tres decimales, coma decimal, vacío, texto, número sin comillas, más de 8 enteros, fecha imposible o mal formada, `efectivo`, `tarjeta`, UUID inválido, `moneda` o `registradoPor` enviados por el cliente, referencia > 500, sin sesión) → 400; 0 filas | ✔         |
| 7   | Límites válidos              | 0,01 y 99 999 999,99 se guardan exactos; la suma da 100 000 000,00 sin redondeo                                                                                                                                                                                                                | ✔         |
| 8   | Sesión ajena                 | Sesión del caso B o inexistente pagada desde A → 400; no se guarda nada                                                                                                                                                                                                                        | ✔         |
| 9   | Permisos                     | Terapeuta asignada, terapeuta ajena y marketing → 403 al listar y registrar; sin token o con token falso → 401                                                                                                                                                                                 | ✔         |
| 10  | Caso inexistente o eliminado | → 404 al listar y registrar                                                                                                                                                                                                                                                                    | ✔         |
| 11  | Conciliación                 | Cada caso lista solo sus pagos, en orden de fecha; la suma de la API en centavos (19 575) coincide con la base (195,75); la vista `v_ingresos_por_mes` de noviembre da QR 2 pagos / 125,50 y transferencia 1 / 120,25                                                                          | ✔         |
| 12  | Error de guardado            | Fallo simulado tras el `INSERT` → 500; no quedan el pago ni su auditoría; el siguiente registro funciona como nuevo                                                                                                                                                                            | ✔         |

## Resultado

12 pruebas aprobadas, 0 fallidas y 0 omitidas (≈ 12–19 s), en varias ejecuciones. Regresión:
las 182 pruebas unitarias de `src/modules/casos` siguen aprobadas.

## Defectos y correcciones

Ninguno encontrado en la API, así que no hubo correcciones de backend que revisar con Adriana.

## Observaciones

- **O1 (diseño, no defecto):** `POST /pagos` responde 200 y no 201, porque el mismo endpoint
  crea o recupera un reintento idéntico (`reutilizado`). La interfaz debe esperar 200.
- **O2 (pendiente funcional de FE-86):** `efectivo` se rechaza en la API, aunque la tabla lo
  admite. Si se decide incluirlo, hay que actualizar el DTO y esta suite.
- **O3:** `GET /pagos` no abre transacción ni registra al usuario. Es aceptable para una
  consulta de solo lectura restringida a administración.
- **Entorno:** si todas las pruebas fallan rápido con «No se pudo preparar PostgreSQL QA»,
  revisar con `pg_isready` que el PostgreSQL de prueba esté encendido.

## Pendiente

- Probar la interfaz de pagos (FE-87) cuando se integre con esta API.

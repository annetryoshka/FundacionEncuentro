# FE-135 — Persistir residencia y preparar consultas e indicadores

Historia FE-111 · Insumo [FE-134](../srs/sprint-3/FE-134-residencia-y-filtros.md) (rama `docs/andrea-sprint3-contratos`) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-135-residencia` sobre `main` en `37ed16b`. Solo base de datos, datos de demostración
y pruebas; la API (`residencia` en `/api/carpetas`, paciente e indicadores) es de FE-136.

| Archivo | Cambio |
|---|---|
| `db/migrations/013_residencia_pacientes.sql` | `ciudad_residencia`, `otra_localidad`, autor y fecha del cambio en `pacientes`; índice; función `indicadores_por_residencia(desde, hasta)` |
| `backend/scripts/datos-demo.mjs` | Residencia de los 14 pacientes demo: 5 La Paz, 6 El Alto, 1 otra localidad, 2 sin registrar |
| `backend/test/residencia-postgres.test.mjs` | Datos A–D de FE-134 y sus resultados esperados |
| `db/migrations/README.md` | Reglas, condición del filtro para FE-136 y uso de la función |

Decisiones tomadas de FE-134 (propuesta pendiente de ratificar): residencia **actual** en el paciente,
compartida por sus carpetas; NULL = sin registrar; no se completa la residencia de pacientes antiguos.
Si se ratifica la residencia al ingreso, será otra columna en una migración nueva.

## Entorno y comandos

PostgreSQL 16 local desechable (Docker), migraciones 001–011 y 013 (la 012 es de FE-130). Cada suite crea su base y la borra.
No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55432/postgres \
  node --test test/residencia-postgres.test.mjs
```

## Matriz de pruebas

| # | Criterio | Comprobación | Resultado |
|---|---|---|---|
| 1 | Catálogo | Pacientes sin dato quedan en NULL. Ciudad desconocida, `sin_registrar` guardado, `otra` sin localidad, solo espacios o > 100 caracteres, y localidad con otra ciudad → `23514` | ✔ |
| 2 | Fecha y autor del cambio | Cambiar la residencia guarda fecha y usuario de `app.usuario_id`; cambiar el teléfono no los modifica | ✔ |
| 3 | Indicadores por residencia | 20–21/11: La Paz 1 caso / 2 sesiones / 75,50; El Alto 1 / 1 / 100,00; otra 1 / 0 / 0; sin registrar 1 / 0 / 0 | ✔ |
| 4 | Sin duplicar conteos | La suma de las 4 filas es igual a `indicadores_operativos` en tres períodos (total 4 casos, 3 sesiones, 175,50) | ✔ |
| 5 | Período sin movimientos | 0 sesiones e importe 0 en cada residencia; los casos se siguen contando | ✔ |
| 6 | Listado y filtros (tabla FE-134 §5) | Admin: todas 4, cada residencia 1. T1: todas A/C, social + iniciado C, El Alto 0, La Paz + social + en proceso A. Página 2 de tamaño 1: un caso y total 4 | ✔ |
| 7 | Cambiar domicilio | A pasa de La Paz a El Alto: número, origen, fecha de ingreso, estado y asignación iguales; La Paz 0, El Alto 2 casos / 3 sesiones / 175,50; T1 lo ve con filtro El Alto | ✔ |
| 8 | Tareas y segunda carpeta | Dos tareas en una sesión no cambian sesiones ni pagos; una segunda carpeta del mismo paciente suma un caso, sin repetir sesiones ni pagos | ✔ |
| 9 | Eliminados | Paciente con `deleted_at` deja de contar en indicadores y listado | ✔ |
| 10 | Auditoría | Cada cambio de residencia queda en `auditoria` con valor anterior, nuevo y usuario | ✔ |

Comprobaciones adicionales:

- Migración 013 aplicada sobre una base con un paciente y un caso existentes: el paciente queda sin registrar y
  cuenta en `sin_registrar`; `public` no puede ejecutar la función.
- `datos-demo.mjs` contra la base local (Supabase Auth simulado): crea 12 residencias, una segunda ejecución no
  crea nada, `--borrar` limpia todo. Por residencia en 2026: La Paz 6 casos / 19 sesiones / 276,00;
  El Alto 6 / 4 / 65,35; otra 1; sin registrar 2. Suma = `indicadores_operativos` (15 / 23 / 341,35).

## Resultado

10 de 10 pruebas aprobadas. Regresión: backend build, 240 pruebas unitarias y 279 de integración
(todas las suites PostgreSQL habilitadas, `--test-concurrency=1`) aprobadas; frontend lint, build y 156 pruebas aprobadas.

## Para FE-136

- Filtro: `residencia=sin_registrar` → `p.ciudad_residencia is null`; `la_paz` / `el_alto` / `otra` →
  `p.ciudad_residencia = $n`. Va junto a las demás condiciones de `listarCarpetas`, antes del total y la paginación.
- Indicadores: `indicadores_por_residencia(desde, hasta)` tiene las mismas columnas que `indicadores_operativos`
  más `residencia`; una residencia elegida es su fila.
- `23514` al guardar residencia → 400.

## Pendiente

- La migración 013 no se aplicó en Supabase: se ejecuta en el SQL Editor, después de la 012 de FE-130, cuando se integre la rama.
- Ratificar residencia al ingreso y la presentación de "Otra localidad" (pendientes de FE-134).

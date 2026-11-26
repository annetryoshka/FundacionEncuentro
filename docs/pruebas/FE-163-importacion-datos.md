# FE-163 — Lotes, deduplicación y confirmación transaccional de la importación histórica

Historia FE-9 (RF-13, RF-14) · Insumo [FE-162](../srs/sprint-3/FE-162-importacion-historica.md) (rama `docs/andrea-sprint3-contratos`, propuesta) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-163-importacion-lotes` sobre `main` en `cc30333`. Solo base de datos, plantilla, muestras y pruebas.
La lectura de CSV/XLSX y los endpoints son de FE-164 (Adriana); el asistente, de FE-165 (Jorge); la tabla de revisión, de FE-162 (Andrea).

| Archivo | Cambio |
|---|---|
| `db/migrations/017_importacion_historica.sql` | Cabecera `importaciones` (de 001, sin uso) con estado, versión, hash y procedencia; tabla `importacion_filas`; validación, clasificación y `confirmar_importacion`; protección del lote cerrado; auditoría y RLS |
| `db/importacion/plantilla-importacion-historica.csv` | Encabezado de la plantilla (UTF-8, coma) |
| `db/importacion/muestras/01..04-*.csv` | Lote válido, lote con errores, lote con duplicados y el CSV de FE-162 sin cambios |
| `backend/test/importacion-postgres.test.mjs` | 16 pruebas sobre PostgreSQL local |
| `db/migrations/README.md` | Flujo, decisiones y errores para FE-164 |

## Decisiones (propuesta, pendiente de ratificar con la Fundación)

- **Validación en la base.** La misma regla sirve para la vista previa y para volver a validar al confirmar; la API solo lee el archivo.
  Reglas del alta manual: nombre obligatorio, origen voluntario/derivado, fecha de ingreso real entre 1990-01-01 y hoy
  (`2026-02-30` es error, no se convierte en marzo), nacimiento no posterior al ingreso, edad 0–120, clasificación social/privado,
  residencia del catálogo de FE-134 y contexto judicial solo en derivados.
- **Todo el lote o nada.** Si falla una inserción, no queda ninguna fila importada y el lote sigue en revisión.
- **Vincular:** a un caso existente (misma carpeta: no se escribe nada en el caso, la fila queda como antecedente de origen),
  a un paciente existente o al paciente creado por otra fila del lote (caso nuevo; el paciente no cambia).
- **Se agregaron columnas opcionales** a la plantilla de FE-162: `estado`, `juzgado`, `nroExpediente`, `fechaDerivacion`.
  La entrevista ENT-001 destaca los casos del juzgado y los casos antiguos ya concluidos.
- **Duplicados dentro del archivo:** la entrevista indica registros antiguos duplicados. Dos filas de la misma persona
  se resuelven con `vincular` a la otra fila (un paciente, dos carpetas); dos filas con el mismo número no pueden crearse ambas.
- **Plantilla CSV.** XLSX queda para la lectura de FE-164 (el repositorio no tiene una librería de XLSX).
- **Números altos:** se respeta el número histórico y el contador sube hasta él (trigger de 001). La vista previa lo advierte
  y la confirmación se detiene (`FEI04`) si el contador fuera a saltar, hasta que administración lo acepte para ese lote.
  El CSV de FE-162 usa 900001: sin esa aceptación no se puede importar, así que no deja el contador de producción en 900002 por error.

## Entorno y comandos

PostgreSQL 17 local desechable (Docker, misma versión mayor que Supabase). Cada suite crea su base y la borra. No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55163/postgres \
  node --test test/importacion-postgres.test.mjs
```

## Matriz de pruebas

| # | Criterio | Comprobación | Resultado |
|---|---|---|---|
| 1 | Plantilla acordada | Encabezado = `importacion_columnas()`; las cuatro muestras solo usan esas columnas | ✔ |
| 2 | Lote válido (FE-9, escenario 1) | 3 filas → 3 pacientes y 3 casos: números 15 y 16 respetados, derivado sin número con el siguiente del contador, edad calculada, residencia `otra`/Viacha, contexto judicial, texto con coma. Cada fila queda con su paciente y caso; lote con autor, fecha y conteos; 6 inserciones en `auditoria` con el autor | ✔ |
| 3 | Correlativos | Tras importar 15 y 16, el alta manual siguiente recibe 17; advertencia `contador` en la vista previa | ✔ |
| 4 | Reintento de confirmación | Confirmar de nuevo (con la misma u otra versión) devuelve el mismo resumen; conteos sin cambios | ✔ |
| 5 | Repetir un lote confirmado | Mismo archivo como lote nuevo: todas las filas `posible_duplicado` con `ya_importada`, sin decisión automática; `crear` → `FEI02`; vinculadas a los casos del primer lote → 0 pacientes y 0 casos nuevos | ✔ |
| 6 | Filas inválidas (escenario 2) | 11 filas con un error cada una, informado en su columna; confirmar → `FEI02` con las 11 filas y nada escrito; una fila con error no se puede crear; excluidas → se importa solo la válida | ✔ |
| 7 | Corregir | Cambiar la fecha y volver a clasificar → `valida_nueva`, versión 2; confirmar con la versión 1 → `FEI01` | ✔ |
| 8 | Columnas desconocidas o no texto | `validar_fila_importacion` informa ambas | ✔ |
| 9 | Coincidencias con existentes (escenario 2) | Misma carpeta → `carpeta` con el caso existente; nombre parecido → `nombre`; crear la carpeta existente o dos filas con el mismo número → `FEI02` | ✔ |
| 10 | Decidir sin fusionar ni modificar | Vincular al caso existente, al paciente existente y a otra fila; excluir el choque de número: 3 pacientes y 5 casos nuevos; md5 del paciente, caso y contexto existentes igual antes y después | ✔ |
| 11 | Fallo a mitad de la confirmación | Inserción simulada que falla en la tercera fila: 0 pacientes, casos, contextos y contadores cambiados; lote en revisión, versión 1, sin resultados. Reintento → las 3 filas una sola vez | ✔ |
| 12 | Cambio entre vista previa y confirmación | Otra alta ocupa el número: confirmar devuelve `revisar`, la fila pasa a `posible_duplicado` sin decisión y no se escribe nada | ✔ |
| 13 | Confirmaciones simultáneas | Dos conexiones a la vez: un solo lote aplicado, ambas reciben el mismo resumen | ✔ |
| 14 | Lote cerrado | Editar o borrar filas o cabecera de un lote confirmado → `23514`; descartado → `FEI03`; sin `app.usuario_id` → `42501`; lote inexistente → `P0002` | ✔ |
| 15 | Números sin salto | Consecutivos al último y uno por debajo del contador: se confirman sin aceptar salto | ✔ |
| 16 | Ejemplo de FE-162 | QA-001/005 `duplicado_en_lote`, QA-002 `posible_duplicado` (carpeta 101 y nombre), QA-003/004/006 `error` en su columna, QA-007 `valida_nueva`; advertencia del contador a 900001. Confirmar sin aceptar → `FEI04` con el salto de cada tipo y nada escrito; aceptado → se aplica y queda `acepta_avance_contador` | ✔ |
| 17 | Permisos | RLS activa en ambas tablas; un rol sin permisos no lee las tablas ni ejecuta `clasificar`/`confirmar` | ✔ |
| 18 | Migración sobre datos existentes | 001–016 con datos y un registro antiguo en `importaciones` → 017: pacientes, casos y contadores iguales; el registro antiguo queda en revisión y no se puede confirmar sin filas | ✔ |

Comprobación de las pruebas: se quitaron a propósito el bloqueo del lote, el retorno del lote ya confirmado, el
reinicio de la decisión y el control del salto; en cada caso falló la prueba correspondiente (13; 4 y 13; 12; 16).

## Resultado observado

| Comando | Resultado |
|---|---|
| `npm run build` (backend) | OK |
| `npm run test:unit` | 240/240 |
| `node --test --test-concurrency=1 test/*.test.mjs` con todas las suites de PostgreSQL | 332 pass, 0 fail, 1 skip (genograma de informes: requiere la 012 de FE-130) |
| `importacion-postgres.test.mjs` | 16/16 |
| Frontend `lint`, `build`, `test` (sin cambios) | OK, OK, 156/156 |

## Aplicación en Supabase (25/11/2026)

Antes: 001–016 aplicadas salvo la 012; `importaciones` vacía; contadores voluntario 10 y derivado 9.

1. Respaldo del esquema `public` (`pg_dump -Fc --no-owner --no-privileges`), guardado fuera del repositorio.
2. Ensayo en una copia restaurada en PostgreSQL 17 local: 017 aplicada, las 28 tablas existentes iguales (cantidad y md5 de filas).
3. Aplicación en Supabase con la misma comprobación:

| Comprobación | Resultado |
|---|---|
| Tablas existentes (cantidad y md5 de filas, contadores) | 28 iguales antes y después |
| RLS | Activa en las 29 tablas |
| `anon` y `authenticated` | Sin lectura de `importaciones`/`importacion_filas` ni ejecución de `clasificar`/`confirmar` |
| Funciones y vistas existentes | `indicadores_operativos`, `v_fuente_clinica_vigente`, `v_posibles_duplicados` responden |
| Ensayo dentro de una transacción revertida | Fila nueva `valida_nueva`; número existente `posible_duplicado` (carpeta); número 900007 → `FEI04`; aceptado → 2 creadas y 1 vinculada. Tras revertir, 29 tablas iguales |
| API contra Supabase | `/api/health` con base conectada; `/api/carpetas` sin token → 401 |

## Pendiente

- **FE-164:** endpoints, lectura de CSV/XLSX, límite de filas por lote y restricción a administración (flujo en `db/migrations/README.md`).
- **Numeración histórica:** los casos del sistema ya usan voluntario 1–10 y derivado 1–9. Si las carpetas antiguas
  empiezan en 1, chocarán con ellos (`carpeta`) y solo podrán vincularse o excluirse. Definir con la Fundación cómo se
  numeran antes de la primera importación real.
- **Fundación:** ratificar las columnas y las reglas con una muestra vacía o anonimizada del Excel antiguo.
- No se probó con Supabase Auth real: el usuario se simula con `app.usuario_id`, como el backend.

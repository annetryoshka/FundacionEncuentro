# FE-125 — Modelar familiares y conservar la información clínica existente

Historia FE-110 · Insumo [FE-123](../srs/sprint-3/FE-123-ficha-familiar-y-diagnostico.md) (PR #50, commit `832d464`) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-125-familiares` sobre `main` en `2ee2f8c` (con FE-135 y FE-142). Solo base de datos, datos de demostración
y pruebas; la API (`GET/PUT /api/carpetas/:id/familia`) es de FE-126 y la interfaz de FE-124/FE-127.

| Archivo | Cambio |
|---|---|
| `db/migrations/015_familiares_caso.sql` | Tablas `fichas_familiares` (cabecera por caso, versión) y `familiares`; triggers de autoría, validación, versión y auditoría; RLS; función `edad_en`; vista `v_fuente_clinica_vigente` |
| `backend/test/familiares-postgres.test.mjs` | Migración sobre datos existentes, fichas A y B de FE-123 §6, reglas de §2, §3 y §7 |
| `backend/test/helpers/pg-qa.mjs` | Opción `hasta` y `migrar()` en `crearBase`, igual que en FE-130 (compatible con las suites existentes) |
| `backend/scripts/datos-demo.mjs` | Familia de las carpetas 10 (ficha A) y 1 (ficha B); la 6 registrada sin integrantes |
| `db/migrations/README.md` | Modelo, reglas por columna y forma de guardar para FE-126 |

Decisiones tomadas de FE-123 (propuesta pendiente de ratificar con la Fundación):

- La familia va en tablas propias y no en el JSON de `fichas_diagnostico`, que se reemplaza en cada guardado.
- Sin fila en `fichas_familiares` = sin registrar; fila sin integrantes = registrada sin integrantes.
- Parentesco respecto del paciente, con género explícito (`hermana`, `abuela_materna`…) y `otro` con detalle. Se puede repetir.
- Edad: fecha de nacimiento **o** edad referida con su fecha de referencia, no ambas. La edad referida no se actualiza sola.
- Eliminar un familiar es lógico (`deleted_at`): una omisión no borra datos y el registro clínico se conserva.
- Los familiares no se enlazan con `pacientes` ni generan carpetas.

## Transición entre fuentes clínicas

Hoy el diagnóstico se guarda en dos lugares:

| Fuente | Dónde | Quién escribe |
|---|---|---|
| Alta | `casos.diagnostico_ingreso`, `hipotesis_relacional`, `comentarios_clinicos` | Alta de carpeta (FE-32) |
| Ficha | `fichas_diagnostico.contenido` (JSON, una por caso) | Ficha de diagnóstico (FE-68) |

La migración no copia, mueve ni borra ninguna de las dos. La vista `v_fuente_clinica_vigente` define la fuente vigente por caso
(FE-123 §3):

- Con ficha → valores de la ficha, `origen = 'ficha'`. Un NULL de la ficha **no** se completa con el alta (puede ser una corrección).
- Sin ficha → valores del alta como antecedente, `origen = 'alta'`.
- Sin ninguno → `origen = 'sin_datos'`.
- Las columnas `alta_*` conservan siempre lo registrado en el alta, y `ficha_*` la fecha y autor de la ficha.

La API actual de diagnóstico no cambia (FE-123 §4): la decisión sobre evaluación inicial obligatoria queda pendiente.
Si se ratifica, será un cambio de FE-126 en el contenido de la ficha; los registros históricos siguen legibles por esta vista.

## Entorno y comandos

PostgreSQL 16 local desechable (Docker). Cada suite crea su base y la borra. No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55125/postgres \
  node --test test/familiares-postgres.test.mjs
```

## Matriz de pruebas

| # | Criterio | Comprobación | Resultado |
|---|---|---|---|
| 1 | Migración sobre datos existentes, sin pérdidas | Base con 001–014 y datos ficticios (4 casos, alta clínica, ficha con un campo extra, genograma, sesión, tarea, pago). Tras aplicar la 015, cantidad de filas y md5 de **todas** las tablas existentes, incluida `auditoria`, son iguales. Solo aparecen `familiares` y `fichas_familiares`, vacías y con RLS | ✔ |
| 2 | Fuente clínica vigente | A: ficha, hipótesis NULL sin rellenar desde el alta, `alta_*` conservados. B y C: alta. D: sin datos | ✔ |
| 3 | Ficha A (FE-123 §6) | Padre 44, madre 41, hermana 8, abuela materna 68 con edad referida al 2026-11-20; parentesco tal como se registró; autor de `app.usuario_id`; versión 1; paciente de 12 años con `edad_en` | ✔ |
| 4 | Ficha B (FE-123 §6) | Hijo estudiante, dos tíos (parentesco repetido), abuelo paterno con todo desconocido (NULL), `otro` = Padrino; sin genograma | ✔ |
| 5 | Sin registrar / sin integrantes | D sin cabecera; C con cabecera y lista vacía | ✔ |
| 6 | Datos inválidos | 19 casos → `23514` (parentesco fuera de catálogo, `otro` sin detalle, detalle con otro parentesco, textos vacíos o largos, edad −1 o 131, edad sin fecha y al revés, nacimiento y edad juntos, fecha < 1900, fechas futuras); parentesco NULL → `23502`; hoy en Bolivia se acepta | ✔ |
| 7 | Sin escrituras parciales | Alta válida + edición válida + alta inválida en una transacción: no queda ninguna y la versión no cambia | ✔ |
| 8 | Sin relaciones cruzadas | Familiar sin cabecera → `23503`; cabecera de caso inexistente → `23503`; segunda cabecera → `23505`; mover familiar o cabecera a otro caso → `23514`; borrar cabecera o caso con familia → `23503` | ✔ |
| 9 | Editar conserva los demás | Dos cambios a la madre en una transacción: los otros 3 familiares iguales, `creado_por` se conserva, `actualizado_por` = administración, versión +1, 3 filas en `auditoria`. Versión desactualizada → rechazo sin cambios | ✔ |
| 10 | Edición concurrente | La segunda edición espera el bloqueo de la primera y, al confirmarse esta, se rechaza por versión; queda el valor de la primera | ✔ |
| 11 | Eliminación lógica | `deleted_at` sube la versión, oculta al familiar de la lista y conserva sus datos; editarlo o restaurarlo → `23514` | ✔ |
| 12 | Diagnóstico y familia independientes | Agregar un familiar no cambia ficha ni genograma. Dos guardados del diagnóstico (upsert de `DiagnosticoService.guardar`) no cambian familiares ni versión | ✔ |
| 13 | Permisos | Consulta con la autorización de `verificarAcceso`: administración y terapeuta asignada ven la familia; terapeuta ajena y marketing no. Caso eliminado: no se ve, la familia sigue guardada | ✔ |
| 14 | Edad con referencia temporal | `edad_en`: día antes y día del cumpleaños, 29 de febrero, nacimiento hoy, fecha anterior al nacimiento y NULL | ✔ |

Comprobaciones adicionales:

- Migraciones 001–015 aplicadas junto con la 012 de FE-130 (rama abierta): sin errores.
- `datos-demo.mjs` contra una base local (Supabase Auth simulado): crea 8 familiares (carpeta 10: padre, madre, hermana,
  abuela materna; carpeta 1: hija, tío, tío, abuelo paterno) y la cabecera vacía de la carpeta 6, todas en versión 1.
  Una segunda ejecución no crea nada y `--borrar` limpia todo.

## Resultado

13 de 13 pruebas aprobadas, que cubren los 14 criterios (el 6 y el 7 van en la misma prueba); estables en 3 ejecuciones. Regresión: backend build, 240 pruebas unitarias y 302 de integración
(todas las suites PostgreSQL habilitadas, `--test-concurrency=1`) aprobadas; frontend lint, build y 156 pruebas aprobadas.

## Para FE-126

- GET: sin fila en `fichas_familiares` → familia sin registrar; con fila → `version` y familiares con `deleted_at is null`
  ordenados por `orden_registro`.
- PUT en una transacción (`db.transaction`): `insert into fichas_familiares ... on conflict do nothing` si es la primera vez;
  `select version ... for update`; versión distinta a la enviada → 409; altas, ediciones por `id` y bajas con `deleted_at = now()`.
  La versión sube sola una vez por transacción.
- Edad actual: `edad_en(fecha_nacimiento, <fecha de Bolivia>)`; la edad referida se muestra con su fecha.
- Errores: `23514` y `23502` → 400, `23503` → 404 (caso inexistente o ajeno), `23505` → 409.

## Pendiente

- La migración 015 no se aplicó en Supabase: se ejecuta en el SQL Editor después de la 014, cuando se integre la rama.
- Ratificar con la Fundación campos, catálogo de parentescos y límites (FE-123, pendiente) y el mínimo clínico (FE-123 §4).

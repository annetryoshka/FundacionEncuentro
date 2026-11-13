# FE-65 — Verificar estados y protección de la constancia

Historia FE-50 · Especificación [FE-61](../srs/sprint-2/FE-61-contexto-y-constancia.md) ·
Implementación FE-63 (API, PR #26) y FE-64 (base de datos) · Responsable: Emilia Crespo (QA)

## Base y alcance

Primera ejecución (2026-11-12): rama `feature/FE-65-verificacion-constancia` sobre `origin/main`
(`4c50218`) más `feature/FE-63-constancia-consentimiento` (`abaafdf`) y
`feature/FE-64-contexto-constancia` (`434194f`, incluye FE-60).

Repetición (2026-11-13): directamente sobre la rama de la HU `feature/FE-63-constancia-consentimiento`
(`8c77aa3`), que ya trae su propia migración `005_constancia_atencion.sql`. De la cadena de base de datos
solo se incorporó el helper de pruebas `test/helpers/pg-qa.mjs` (FE-60, copiado sin cambios).

Se verifican `GET` y `PUT /api/carpetas/:id/constancia` por HTTP real contra los ejemplos de FE-61:
campos exigidos, cambios de estado, recarga, correlativo inalterado y acceso a caso ajeno.
No se modificó código de producción. Archivos: `backend/test/constancia-verificacion-postgres.test.mjs`
y este documento.

## Entorno y comandos

NestJS HTTP real, guards y `ValidationPipe` reales, PostgreSQL 17 local desechable (locale ICU
`es-BO`) con todas las migraciones. Solo se simula la respuesta de Supabase Auth
(`test/helpers/casos.mjs`). La base `fe65_*` se crea con `test/helpers/pg-qa.mjs` y se borra al terminar.

```powershell
docker run -d --name fe65-qa-pg -e POSTGRES_HOST_AUTH_METHOD=trust `
  -e POSTGRES_INITDB_ARGS="--locale-provider=icu --icu-locale=es-BO --locale=C.UTF-8" `
  -p 127.0.0.1:55441:5432 postgres:17
cd backend
npm.cmd run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgresql://postgres@127.0.0.1:55441/postgres'
node --test test/constancia-verificacion-postgres.test.mjs
```

Sin esas variables las 9 pruebas se omiten (`skipped`), igual que el resto de suites PostgreSQL.

## Datos

| Dato | Valor ficticio |
|---|---|
| Caso A | Ana Ficticia QA, voluntario, asignado a T1 |
| Caso B | Beto Ficticio QA, derivado, asignado a T2 |
| Registrada | Fecha `2026-10-09`, referencia `EVIDENCIA-DEMO`, Juzgado Público de Familia N.º 1, contexto judicial con expediente `EXP-QA-1` |
| No aplica | Explicación «Caso ficticio sin intervención con menores» |
| Usuarios | Administración, T1, T2, marketing, sin token y token falso |

## Matriz de pruebas

| # | Criterio | Caso | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Consulta sin constancia | Admin consulta A | 200 `{ constancia: null }` | Pasa |
| 2 | Campos exigidos | Registrada sin referencia, con referencia en blanco, sin fecha, fecha `2026-02-30`, fecha `09/10/2026`, con explicación | 400 | Pasa |
| 2 | Campos exigidos | No aplica sin explicación, en blanco o con referencia; Pendiente con fecha; estado `firmado`; sin `origenJudicial` | 400 | Pasa |
| 2 | Contexto judicial (desde `8c77aa3`) | Origen judicial sin `contextoJudicial`; contexto sin juzgado | 400 | Pasa |
| 2 | Campos protegidos | Cuerpo con `numeroCorrelativo` o `tipo` | 400 | Pasa |
| 2 | Sin cambios tras error | Tras los 16 rechazos | Sigue Pendiente, 1 sola fila de auditoría | Pasa |
| 3 | Cambios de estado | Pendiente → Registrada → No aplica → Pendiente | 200; cada estado limpia los campos que no le corresponden; 1 fila, 4 auditorías | Pasa |
| 4 | Recarga | Guardar Registrada y volver a consultar | La consulta devuelve lo mismo que el guardado | Pasa (D1 corregido) |
| 5 | Correlativo inalterado | T2 guarda los tres estados en B | Número, origen, estado, clasificación y paciente sin cambio; sin filas nuevas | Pasa |
| 6 | Autoría | Admin crea, T1 actualiza | `creadoPor` admin, `actualizadoPor` T1; fecha de evidencia separada de `actualizadoEn` | Pasa |
| 7 | Caso ajeno | T1 consulta / guarda B | 404 sin datos | Pasa |
| 7 | Rol no permitido | Marketing consulta / guarda A | 403 | Pasa |
| 7 | Sin sesión | Sin token / token falso | 401 | Pasa |
| 7 | Inexistente / mal formado | UUID aleatorio / `no-es-uuid` | 404 / 400 | Pasa |
| 7 | Sin escritura | Después de los rechazos | Constancias y auditoría iguales | Pasa |
| 8 | Caso eliminado | `deleted_at` en A | 404 en consulta y guardado | Pasa |
| 9 | Reasignación | A pasa de T1 a T2 | T1 recibe 404; T2 ve el caso | Pasa |

Primera ejecución: 8 pasan y 1 falla por el defecto D1 (marcada `todo`).
Repetición sobre `8c77aa3`: **9 pasan, 0 fallan, 0 `todo`**, en dos ejecuciones consecutivas.
Se quitó el `todo` de la prueba 4 y se actualizó el cuerpo «Registrada» con `contextoJudicial`, que la API
exige desde `8c77aa3` cuando `origenJudicial` es verdadero.

## Defectos

### FE-65-D1 · La consulta devuelve la fecha de consentimiento con hora y zona — **Corregido**

- **Estado:** corregido por Adriana en `8c77aa3` («normalizar fechas de constancia»). La prueba 4
  pasa sin `todo` en la repetición del 2026-11-13.

- **Severidad:** media. Afecta la recarga, que es uno de los ejemplos de aceptación de FE-61.
- **Pasos:** `PUT /api/carpetas/{A}/constancia` con estado `registrado` y `fechaConsentimiento: "2026-10-09"`;
  luego `GET /api/carpetas/{A}/constancia`.
- **Esperado:** `"fechaConsentimiento": "2026-10-09"` en ambas respuestas.
- **Obtenido:** el `PUT` responde `"2026-10-09"`, pero el `GET` responde `"2026-10-09T04:00:00.000Z"`.
- **Causa probable:** `obtenerConstancia` (`casos.service.ts`) usa `select ca.*` y el driver `pg`
  convierte la columna `date` en un `Date` de JavaScript a medianoche **local** del servidor (La Paz,
  UTC−4). `actualizarConstancia` sí usa `to_char(fecha_consentimiento, 'YYYY-MM-DD')`.
- **Riesgo:** si el servidor corre en una zona con desfase positivo (UTC+1 en adelante) el valor pasa
  a ser `2026-10-08T…Z`, y una interfaz que corte los primeros 10 caracteres mostraría el día anterior.
  No se reprodujo en otra zona: Node en Windows ignora la variable `TZ`.
- **Corrección sugerida:** en `obtenerConstancia`, agregar
  `to_char(ca.fecha_consentimiento, 'YYYY-MM-DD') as fecha_consentimiento` igual que en el guardado.
  Al corregirlo se quita el `todo` de la prueba 4 y se repite la suite; según FE-65, Adriana revisa el cambio.

## Observaciones (no son defectos)

- El guardado reemplaza la sección completa (`PUT`): si se omite `procedencia`, queda en `null`. Es lo
  que documenta Swagger; la interfaz debe reenviar todos los campos.
- FE-61 deja pendiente definir qué evidencia se admite para datos reales; aquí solo se usó `EVIDENCIA-DEMO`.

## Pendiente

- Prueba de interfaz de la sección cuando exista el frontend de constancia.

# FE-168 — Categorías, consultas y correspondencia del paquete de investigación

Historia FE-115 (RF-21, RF-22; ADR-001) · Insumo [FE-167](../srs/sprint-3/FE-167-investigacion-atlasti.md) (rama `docs/andrea-sprint3-contratos`, propuesta) · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-168-investigacion-categorias` sobre `main` en `d554a6d`. Solo base de datos, datos ficticios y pruebas.
La API y la generación de DOCX/TXT son de FE-169 (Adriana); la pantalla, de FE-170 (Jorge); la prueba en Atlas.ti, de FE-171 (Emilia).

| Archivo | Cambio |
|---|---|
| `db/migrations/018_investigacion_categorias.sql` | Reutiliza `categorias_investigacion` y `caso_categorias` (001, sin uso) con código, vigencia y validaciones; selección y conteos por alcance; `exportaciones` tipo `atlas_ti` con revisión; tabla `exportacion_documentos`; manifiesto y contenido de cada documento; auditoría, RLS y permisos |
| `backend/test/investigacion-postgres.test.mjs` | 14 pruebas sobre PostgreSQL local |
| `backend/scripts/datos-demo.mjs` | QA-CAT-01 y QA-CAT-02 de FE-167 §2 en las carpetas 1 y 2 (solo si la 018 está aplicada) y su borrado |
| `db/migrations/README.md` | Modelo, flujo y errores para FE-169 |

## Decisiones (propuesta, pendiente de ratificar con la Fundación)

- **Alcance por rol:** administración, todos los casos activos; terapeuta, solo sus casos asignados; marketing o cuenta
  inactiva, ninguno. La base lo aplica en la selección, los conteos, la preparación y cada lectura del paquete: conocer
  el UUID de un caso ajeno no lo agrega.
- **Etiqueta:** una categoría en el caso, en su ficha de diagnóstico o en una sesión, siempre del mismo caso (FK compuesta).
  Una por categoría y destino. Una categoría usada no se borra (antes se borraban sus etiquetas en cascada): se retira.
- **Selección:** cualquiera de las categorías elegidas, con sus subcategorías; período = al menos una sesión entre las fechas;
  residencia del catálogo de FE-134 más `sin_registrar`.
- **Secciones exportables:** `diagnostico` (fuente vigente de FE-123), `seguimiento` (evolución por sesión) y `tareas` (con su
  sesión). Familia y genograma no se exportan: tienen nombres de terceros. Fechas de sesión reducidas al mes.
- **Seudónimos:** `INV-001…` por paquete, en un orden que no sigue el número de carpeta. El mismo caso recibe otro código en
  otro paquete; el vínculo con el caso queda solo en `exportacion_documentos`.
- **Revisión del texto libre:** la base no quita nombres de la evolución, fragmentos o notas. Se registra quién revisó
  (`revisado_por/en`) y el archivo del paquete solo se registra después de esa revisión.

## Entorno y comandos

PostgreSQL 17 local desechable (Docker, misma versión mayor que Supabase). Cada suite crea su base y la borra. No se usó Supabase.

```bash
cd backend
FE_PG_QA=1 FE_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:55432/postgres \
  node --test test/investigacion-postgres.test.mjs
```

Datos de prueba: casos A y B de una terapeuta, C de otra, D sin asignar y E dado de baja, con nombres, teléfono,
nacimiento, residencia, juzgado, expediente, familiar y pago reconocibles para buscarlos en el paquete.

## Matriz de pruebas

| # | Criterio (FE-167 §6 y FE-168) | Comprobación | Resultado |
|---|---|---|---|
| 1 | Migración sobre datos existentes | 001–017 con una categoría y una etiqueta → 018: la categoría recibe `CAT-001` y la etiqueta se conserva | ✔ |
| 2 | Categoría vacía o duplicada según jerarquía | Código y nombre normalizados; mismo nombre en el nivel (sin distinguir mayúsculas) o mismo código → `23505`; mismo nombre bajo otra categoría permitido; nombre vacío, código o color inválidos → `23514`; sin código → `23502` | ✔ |
| 3 | Jerarquía e historial | Ciclo (a sí misma o bajo su subcategoría) y cambio de código → `23514`; categoría con etiquetas o con subcategorías no se borra (`23503`); sin uso sí | ✔ |
| 4 | Sesión de B asignada a A | Sesión o diagnóstico de otro caso → `23503`; ambas fichas → `23514`; etiqueta repetida → `23505`; carpeta dada de baja, categoría retirada o cambio de destino → `23514`; autor y auditoría registrados | ✔ |
| 5 | Exclusión de casos ajenos | Selección: administración 5 casos, terapeuta 1 solo los suyos, terapeuta 2 solo el suyo, marketing, perfil inexistente o inactivo ninguno; la carpeta dada de baja nunca | ✔ |
| 6 | Filtros | Categoría con subcategorías, varias categorías (cualquiera), período de sesiones, residencias con `sin_registrar`; residencia desconocida o fechas invertidas → `22023` | ✔ |
| 7 | Conteos | Por categoría: casos y etiquetas de caso, diagnóstico y sesión; categoría sin uso en 0; la terapeuta cuenta solo sus casos; la sesión fuera del período no cuenta; la carpeta dada de baja no cuenta | ✔ |
| 8 | Dos casos y categorías seleccionados | Dos documentos `INV-001/002` y dos entradas de manifiesto (caso repetido una vez); categorías de cada entrada = las de su documento (A: QA-CAT-01 y QA-CAT-01-A; B: QA-CAT-02); catálogo con la categoría superior; el documento de A no contiene textos de B ni de C, y al revés | ✔ |
| 9 | Secciones, período y formato | Sin diagnóstico, su etiqueta no entra; octubre excluye la sesión de agosto y su etiqueta; tareas solo si se piden; `txt`; sección o formato no admitidos, tareas sin seguimiento o sin casos → `22023` | ✔ |
| 10 | Terapeuta pide caso ajeno | Caso de otra terapeuta, sin asignar, dado de baja o inexistente → `P0002` y ningún paquete creado; marketing o sin `app.usuario_id` → `42501`; documento agregado a mano con caso ajeno → `42501`, con archivo que no corresponde → `23514` | ✔ |
| 11 | Lectura protegida | Otra terapeuta o marketing → `P0002`; administración lee; si el caso se reasigna, quien preparó ya no lee ese documento ni el manifiesto | ✔ |
| 12 | Correspondencia manifiesto-documentos | Etiqueta agregada después de preparar → `FEX01` (DETAIL con el `idExportacion`) en manifiesto, documento y revisión; archivo antes de revisar, segunda revisión, cambiar parámetros, documentos o quitar uno → `23514`; el paquete completo se elimina con sus documentos; auditoría | ✔ |
| 13 | Sin identificadores directos | Manifiesto y documentos sin nombres, teléfono, nacimiento, localidad, juzgado, expediente, familiar, monto, nombres de personal ni UUID de paquete, casos, sesiones, fichas o perfiles; sin claves `nombreCompleto`, `telefono`, `numeroCorrelativo`, `fecha`, etc. El texto libre sale igual (se revisa antes de descargar) | ✔ |
| 14 | Permisos | RLS activa en las 4 tablas; funciones nuevas sin ejecución para `public` | ✔ |

Comprobación de las pruebas: se quitaron a propósito la condición de asignación, la FK compuesta de sesión, el control
`FEX01`, la reducción de la fecha al mes, el filtro de etiquetas de diagnóstico y el bloqueo de quitar un documento; en
cada caso falló la prueba correspondiente (5, 6, 7, 10, 11; 4, 5, 7, 8, 9; 12; 13; 9; 12).

Datos de demostración: las dos inserciones del script, repetidas dos veces sobre una base local, crean 2 categorías y
3 etiquetas y luego ninguna; sin ficha de diagnóstico la etiqueta de diagnóstico se omite; el borrado quita paquetes,
etiquetas y categorías de las carpetas de demostración.

## Resultado observado

| Comando | Resultado |
|---|---|
| `npm run build` (backend) | OK |
| `npm run test:unit` | 240/240 |
| `node --test --test-concurrency=1 test/*.test.mjs` con todas las suites de PostgreSQL | 346 pass, 0 fail, 1 skip (genograma de informes: requiere la 012 de FE-130) |
| `investigacion-postgres.test.mjs` | 14/14 |
| Frontend `lint`, `build`, `test` (sin cambios) | OK, OK, 156/156 |

## Pendiente

- **FE-167:** ratificar con la Fundación catálogo, perfil autorizado (¿terapeutas?), secciones y tratamiento de identificadores.
- **FE-169:** endpoints, generación de DOCX/TXT y `manifiesto.json` desde estas funciones, y descarga protegida (flujo en `db/migrations/README.md`).
- **FE-171:** abrir/importar los documentos en la versión de Atlas.ti de la Fundación; no se afirma importación de códigos.
- **FE-158:** comparte `exportaciones` (tipos `pdf`/`word`); sus reglas van en otra migración y no tocan las de `atlas_ti`.
- Supabase: 018 no aplicada (requiere respaldo y ensayo como la 017). No se probó con Supabase Auth real: el usuario se simula con `app.usuario_id`, como el backend.

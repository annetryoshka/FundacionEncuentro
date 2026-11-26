# FE-158 — Consulta consistente y registro de exportaciones

Historia FE-114 (RF-18) · Insumo [FE-156](../srs/sprint-3/FE-156-exportacion-documentos.md) (rama `docs/andrea-sprint3-contratos`, propuesta) · Requiere FE-152 · Responsable: Alejandro Bobarin

## Base y alcance

Rama `feature/FE-158-registro-exportaciones` sobre `main` en `963025d`. Solo base de datos y pruebas.
La generación de PDF/DOCX y la API son de FE-159 (Adriana, `origin/feature/FE-159-exportacion-pdf-docx`); la pantalla, de
FE-160 (Jorge); la verificación de archivos, de FE-161 (Emilia).

| Archivo | Cambio |
|---|---|
| `db/migrations/020_registro_exportaciones.sql` | `exportaciones` (001) para `pdf`/`word`: documento, versión del informe, datos exactos, estado, archivo y nombre; fotografía de ficha e historial reutilizando `fotografia_informe` (016); vista previa, preparación, lectura, registro del archivo o del fallo, descarga y trazabilidad por caso; RLS y permisos |
| `backend/test/exportaciones-postgres.test.mjs` | 12 pruebas sobre PostgreSQL local |
| `db/migrations/README.md` | Modelo, flujo y errores para FE-159/FE-160 |

Numeración: 019 ya la usa `origin/feature/FE-169-api-investigacion` (`019_revision_investigacion.sql`, sin fusionar); por eso 020.
Ambas agregan columnas distintas a `exportaciones` y se aplican juntas sin conflicto.

## Decisiones (propuesta, pendiente de ratificar con la Fundación)

- **Una fila por exportación** en `exportaciones` (tipos `pdf`/`word` de 001), siempre con caso. `informes.formato` y
  `archivo_path` (reservados en 016) quedan sin uso: un informe revisado puede exportarse varias veces y en ambos formatos.
- **Informe:** solo una versión revisada, exportada tal como se revisó (texto y fotografía de FE-152). Si el expediente cambia
  después, la exportación no se regenera; para datos nuevos se revisa otra versión (FE-153).
- **Ficha e historial:** se leen una sola vez, al preparar, en una misma instantánea; el archivo se genera desde esos datos
  guardados, no de una segunda lectura. La vista previa opcional se compara al preparar: si el expediente cambió, se rechaza.
- **Secciones** (claves de FE-156): ficha `identificacion`, `familia`, `diagnostico`; historial además `sesiones` (todas, con
  tareas). Constancia de atención no está en la lista de FE-156 y no se incluye.
- **Permisos:** administración, cualquier caso activo; terapeuta, sus casos asignados; marketing, ninguno. Pagos solo en el
  historial y solo administración. Una exportación la leen quien la preparó o administración, mientras el caso siga autorizado;
  una con pagos, solo administración. Informes para administración: se permiten (acceso actual), pendiente de política clínica.
- **Archivo privado:** la ruta la fija la base (`<caso_id>/<exportacion_id>.pdf|.docx`) y el nombre de descarga es
  `exportacion-<id>.<ext>`, sin datos personales. Se registran sha256 y tamaño; un archivo vacío no se registra.
- **Fallo del generador:** la exportación queda `fallida` con el mensaje; para reintentar se prepara otra. Nada se elimina.

## Entorno y comandos

PostgreSQL 17 local desechable (Docker, misma versión mayor que Supabase). La suite crea su base y la borra. No se usó Supabase.

```powershell
cd backend
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<clave>@localhost:55432/postgres'
node --test test/exportaciones-postgres.test.mjs
```

Datos de prueba: caso A (terapeuta 1) con ficha, dos sesiones registradas fuera de orden, tareas, familia y dos pagos; caso B
(terapeuta 2, derivado) con diagnóstico del alta, juzgado, una sesión y un pago; informes revisados de A y B y un borrador de A;
un paquete `atlas_ti` (018). Se cargan con 001–018 y después se aplica la 020.

## Matriz de pruebas

| # | Criterio (FE-156 §6 y FE-158) | Comprobación | Resultado |
|---|---|---|---|
| 1 | Migración sobre datos existentes | 020 sobre una base con informes y un paquete `atlas_ti`: el paquete queda sin campos de documento, se revisa, registra su archivo y da su manifiesto; un `atlas_ti` no acepta `estado` (`23514`) | ✔ |
| 2 | Historial consistente | Administración con pagos: parámetros canónicos, cuatro secciones, sesiones por fecha con sus tareas, pagos `50.50`/`40.00` de sesiones de A; sesiones, diagnóstico y familia iguales a `fotografia_informe`; nada de B (UUID, nombre, juzgado, monto) | ✔ |
| 3 | Ficha y secciones | Terapeuta asignada, `docx` → tipo `word`; por defecto identificación y diagnóstico, sin sesiones, familia ni pagos; secciones repetidas o desordenadas se normalizan | ✔ |
| 4 | Reutilizar la versión revisada | Texto y fotografía iguales a la versión; tras cambiar el diagnóstico, la nueva exportación del informe es idéntica y la ficha muestra el cambio; borrador → `23514`; versión de B en A (también administración) o inexistente → `P0002` | ✔ |
| 5 | Permisos | Terapeuta en caso ajeno, caso inexistente o dado de baja → `P0002`; marketing o sin `app.usuario_id` → `42501`; terapeuta con `incluirPagos` → `42501` (también en vista previa) | ✔ |
| 6 | Parámetros | 18 solicitudes inválidas (documento, formato, sección ajena o vacía, pagos fuera del historial, clave desconocida, tipos, versión inválida, informe con secciones o genograma) → `22023` | ✔ |
| 7 | Lo mostrado es lo registrado | Vista previa = datos guardados; vista previa alterada, de B o anterior a una sesión nueva → `23514` | ✔ |
| 8 | Dos casos no se mezclan | Insert directo con caso B y datos de A → `23514`; tipo distinto del formato → `22023`; versión de otro caso → `P0002`; archivo al preparar → `23514`; sin caso → `P0002`; el autor lo pone la base | ✔ |
| 9 | Archivo y fallo | Ruta `<caso>/<id>.pdf`; antes de registrar, descarga → `55000`; sha256 inválido o tamaño 0 → `22023`; ruta de otro caso → `23514`; registrar una vez; después no cambia caso, datos, parámetros, autor ni ruta y no se elimina (`23514`); sin trigger, datos de otro caso → `23514`; fallo con mensaje vacío → «Error del generador», sin archivo ni reintento; auditoría con autor | ✔ |
| 10 | Token/caso sin permiso al descargar | Otra terapeuta o marketing → `P0002`; con pagos, la terapeuta no la ve aunque sea su caso, ni quien la preparó si deja de ser administración; un `atlas_ti` no se lee por aquí; tras reasignar A, quien preparó ya no la ve | ✔ |
| 11 | Trazabilidad por caso | Administración ve todas las de A (documento, formato, versión, autor, estado); terapeuta solo las suyas; otra terapeuta → `P0002`; marketing → `42501`; B no lista las de A | ✔ |
| 12 | Genograma y permisos | Sin la 012, `incluirGenograma` → `0A000`; funciones nuevas sin ejecución para `public` (y sin acceso para `anon`/`authenticated` si existen) | ✔ |

Comprobación de las pruebas: se quitaron a propósito, una por vez, la ruta fija del caso, el control de pagos por rol, la
condición de caso autorizado al leer, la comparación con la vista previa, el control de versión revisada, el cierre de
estado, la exclusión de pagos para terapeutas, el control de caso en los datos, el filtro de caso de la versión, el bloqueo
de borrado y el rechazo de claves desconocidas: las 11 mutaciones hicieron fallar al menos una prueba.

## Resultado observado

| Comando | Resultado |
|---|---|
| `npm run build` (backend) | OK |
| `npm run test:unit` | 240/240 |
| `node --test --test-concurrency=1 test/*.test.mjs` con todas las suites de PostgreSQL | 358 pass, 0 fail, 1 skip (genograma de informes: requiere la 012 de FE-130) |
| `exportaciones-postgres.test.mjs` | 12/12 |
| Frontend `lint`, `build`, `test` (sin cambios) | OK, OK, 156/156 |

## Pendiente

- **FE-156:** ratificar con la Fundación contenido, secciones y si administración exporta informes clínicos.
- **FE-159:** convertir `datos` en `DocumentoExportable`, guardar el archivo en `archivoPath` y llamar al registro (flujo en
  `db/migrations/README.md`). Hoy su servicio recibe el documento ya armado y no toca la base.
- **FE-160:** opciones de secciones/pagos según rol y descarga por `archivo_exportacion`.
- **012 (FE-130/FE-131):** sin ella, `incluirGenograma` responde `0A000`.
- Supabase: 020 no aplicada (requiere respaldo y ensayo como la 018; comprobar antes que no haya filas `pdf`/`word`). No se
  probó con Supabase Auth real: el usuario se simula con `app.usuario_id`, como el backend.

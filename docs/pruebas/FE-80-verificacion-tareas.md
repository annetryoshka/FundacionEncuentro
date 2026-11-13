# FE-80 — Verificar tareas y apoyar correcciones backend

Historia FE-56 · Implementación FE-78 (API) y FE-79 (persistencia) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama `feature/FE-80-verificacion-tareas`, creada desde
`origin/feature/FE-78-api-tareas-terapeuticas` (`db7bdd3`), que integra diagnóstico (FE-68),
sesiones (FE-73) y la migración `009_tareas_por_sesion.sql` de FE-79.
Se verifica el backend de tareas terapéuticas (`POST` y `GET /api/carpetas/:id/tareas`,
`PATCH /api/carpetas/:id/tareas/:tareaId/cumplimiento`) contra los ejemplos de
[FE-76](../srs/sprint-2/FE-76-tareas-terapeuticas.md). La interfaz (FE-77) está en otra rama
sin integrar; su prueba queda pendiente.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/tareas-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU `es-BO`,
todas las migraciones (001–004, 006, 008 y 009) y datos ficticios. Solo se simula la respuesta
de Supabase Auth (`test/helpers/casos.mjs`). La suite crea una base aleatoria `fe80_run_*` y
la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/tareas-api-postgres.test.mjs
```

## Matriz de pruebas

| #   | Criterio                        | Comprobación                                                                                                                                                                                                                       | Resultado |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Sin tareas ≠ error              | `GET` responde 200 con `{ tareas: [] }`                                                                                                                                                                                            | ✔         |
| 2   | Crear (ejemplo 1)               | T1 agrega «Actividad de prueba» a S-A1 → 201, Pendiente, descripción recortada, `sesionId` y `numeroSesion`, `creadoPor` T1, cumplimiento sin cambios; visible en el listado                                                       | ✔         |
| 3   | Realizada y recarga (ejemplo 2) | `PATCH` a realizada → 200 con quién y cuándo cambió; la autoría de creación no cambia; el listado recargado conserva el estado                                                                                                     | ✔         |
| 4   | Volver a Pendiente y auditoría  | Repetir el mismo estado no reescribe; el administrador vuelve a pendiente con fecha posterior; la auditoría registra INSERT de T1, UPDATE de T1 y UPDATE del administrador                                                         | ✔         |
| 5   | Validaciones (ejemplo 3)        | 8 cuerpos inválidos al crear (descripción vacía, de espacios, ausente o > 10 000; sin sesión o con UUID inválido; `estado` o `casoId` enviados por el cliente) y 5 estados fuera del catálogo → 400; la tarea anterior se conserva | ✔         |
| 6   | Sesión ajena (ejemplo 4)        | Sesión del caso B o inexistente asociada desde A → 400, como terapeuta y como administrador; no se crean tareas                                                                                                                    | ✔         |
| 7   | Ruta cruzada                    | Cambiar una tarea de B por la ruta de A → 404; la tarea de B no cambia                                                                                                                                                             | ✔         |
| 8   | Acceso ajeno                    | Terapeuta no asignada → 404; marketing → 403; sin token o con token falso → 401; caso inexistente o eliminado → 404; tareas de B sin cambios                                                                                       | ✔         |
| 9   | Orden                           | Las tareas se listan según la fecha y el número de su sesión                                                                                                                                                                       | ✔         |
| 10  | Error de guardado               | Fallo simulado de base al crear y al cambiar el cumplimiento → 500 con rollback; la tarea sigue Pendiente y sin registro de cambio                                                                                                 | ✔         |
| 11  | Reasignación                    | La terapeuta anterior pierde el acceso; la nueva puede cambiar el cumplimiento; se conserva quién creó la tarea                                                                                                                    | ✔         |

## Resultado

11 pruebas aprobadas, 0 fallidas y 0 omitidas (≈ 18 s), en varias ejecuciones. Regresión:
las 134 pruebas unitarias de `src/modules/casos` siguen aprobadas.

## Defectos y correcciones

Ninguno encontrado en la API, así que no hubo correcciones de backend que revisar con Adriana.

## Observaciones

- **O1 (no bloqueante):** `creadoPor` y `cumplimientoActualizadoPor` devuelven solo el UUID.
  Para mostrar «el responsable del cambio» (ejemplo 2 de FE-76), la interfaz debe resolver el
  nombre, o la API podría incluirlo como ya hace sesiones con `responsable.nombreCompleto`.
- **Entorno:** una ejecución falló en el `before` sin llegar a conectarse a PostgreSQL (no quedó
  registro en el log del servidor). Al repetirla con las mismas variables pasó 11/11. No es un
  defecto del sistema.

## Pendiente

- Probar la interfaz de tareas (FE-77) cuando se integre con esta API.

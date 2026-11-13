# FE-75 — Probar integridad y cronología de sesiones

Historia FE-55 · Implementación FE-73 (API) y FE-74 (persistencia) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama `feature/FE-75-verificacion-sesiones`, creada desde
`origin/feature/FE-73-api-sesiones-seguimiento` (`7addced`), que parte de `origin/main` (`4c50218`)
e incluye las migraciones `008_00_funcion_autor_sesiones.sql` y `008_sesiones.sql` de FE-74.
Se verifica el backend de sesiones (`POST`, `GET` y `GET /:sesionId` sobre
`/api/carpetas/:id/sesiones`) contra los ejemplos de
[FE-71](../srs/sprint-2/FE-71-ficha-y-recorrido-de-sesion.md). La interfaz (FE-72) está en otra
rama sin integrar; su prueba queda pendiente.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/sesiones-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU `es-BO`,
todas las migraciones (001–004 y 008) y datos ficticios. Solo se simula la respuesta de
Supabase Auth (`test/helpers/casos.mjs`). La suite crea una base aleatoria `fe75_run_*` y
la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/sesiones-api-postgres.test.mjs
```

## Matriz de pruebas

| #   | Criterio                   | Comprobación                                                                                                                                                                                                          | Resultado |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Sin sesiones ≠ error       | `GET` responde 200 con `{ sesiones: [] }`                                                                                                                                                                             | ✔         |
| 2   | Persistencia               | Registro 201, número 1, fecha `AAAA-MM-DD`, evolución recortada, responsable y autoría; el detalle recargado es idéntico                                                                                              | ✔         |
| 3   | Orden                      | Fechas 10, 10 y 01 → listado 3, 1, 2; el listado no expone la evolución; abrir la 2 muestra su propia evolución                                                                                                       | ✔         |
| 4   | Validaciones               | 10 cuerpos inválidos (fecha imposible, formato, vacía o ausente; evolución vacía, de espacios, ausente o > 10 000; `numero` y `responsableId` enviados por el cliente) y UUID mal formado → 400; 0 filas creadas      | ✔         |
| 5   | Caso incorrecto            | Sesión de B abierta por la ruta de A → 404, incluso como administrador; sesión inexistente → 404                                                                                                                      | ✔         |
| 6   | Acceso ajeno               | Terapeuta no asignada → 404; marketing → 403; sin token o con token falso → 401; caso inexistente o eliminado → 404; datos de B sin cambios                                                                           | ✔         |
| 7   | Error de guardado          | Caso sin terapeuta → 400 sin filas; fallo simulado de base tras el `INSERT` → 500 y rollback completo; el siguiente registro recibe el número 1                                                                       | ✔         |
| 8   | Sesión 17                  | Con 16 sesiones registradas, la 17 se guarda; el listado muestra 1–17                                                                                                                                                 | ✔         |
| 9   | Concurrencia               | 5 altas simultáneas → números 1–5 sin repetir                                                                                                                                                                         | ✔         |
| 10  | Responsable y reasignación | Alta del administrador: `creadoPor` = administrador, responsable = terapeuta asignada; tras reasignar, la anterior pierde acceso y el responsable histórico se conserva; la nueva sesión queda con la nueva terapeuta | ✔         |

## Resultado

10 pruebas aprobadas, 0 fallidas y 0 omitidas, en dos ejecuciones consecutivas (≈ 16 s).

## Defectos

Ninguno encontrado en la API.

## Pendiente

- Probar la interfaz de registro, listado y detalle (FE-72) cuando se integre con esta API.

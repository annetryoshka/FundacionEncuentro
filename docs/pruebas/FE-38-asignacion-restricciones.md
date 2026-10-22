# FE-38 — Verificar asignación y restricciones

## Base y requisitos

Rama `feature/FE-38-verificacion-asignacion-restricciones`, base
`3847c209bd334829333d872ae47a1485a32e9bb3` de FE-41. Contiene FE-34 y FE-40;
tras fetch, origin/main aún no contenía FE-41. Se conservó main y el trabajo anterior.
No se encontraron AGENTS.md en el repositorio. FE-41 se subió antes de iniciar esta
subtarea, con autorización del usuario; FE-38 se guarda solo en un commit local.

Se consultaron Jira [FE-38](https://andreanarvaezort-1786202493806.atlassian.net/browse/FE-38)
y su historia padre [FE-35](https://andreanarvaezort-1786202493806.atlassian.net/browse/FE-35).
Requieren asignar/sustituir terapeuta activa, distinguir propio/ajeno/sin asignar,
restringir marketing, retirar acceso anterior en la siguiente solicitud y registrar
autor/fecha. FE-38 admite API real o simulada identificada y exige documentar bloqueos.
El contrato del repositorio complementa estos criterios. FE-52 no se modifica.

## Inspección y cobertura reutilizada

- `AsignacionesService.asignar`: usa DatabaseService.transaction(adminId), bloquea
  el caso con FOR UPDATE, valida perfil/rol/actividad, rechaza repetición con 409 y
  sustituye DELETE + INSERT en el mismo PoolClient. La 002 garantiza unicidad por caso.
- `CarpetasController.asignarTerapeuta`: PUT devuelve el detalle autorizado después
  de asignar. `AsignacionesController` también expone GET/POST/DELETE relacionados,
  restringidos a administrador. DTO valida UUID; guards globales permanecen reales.
- Pruebas unitarias FE-37: `asignaciones.service.spec.ts` (4),
  `carpetas.controller.spec.ts` (1), `carpetas.roles.spec.ts` (4),
  `casos.autorizacion.spec.ts` y `dto/asignar-terapeuta.dto.spec.ts` (3).
  Son dobles de DB/contexto: no prueban por sí solos HTTP, persistencia ni rollback.
- Se reutilizan sin copiar las 13 pruebas PG de FE-40/41 y las 6 UI existentes de
  `AsignacionTerapeuta.test.tsx` (FE-36). Las nuevas pruebas amplían esas suites.

## Matriz de pruebas nuevas

PG = `backend/test/listado-carpetas-postgres.test.mjs`. Todas sus pruebas nuevas
tienen prefijo `FE-38 PG:` y se ejecutan con el mismo comando reproducible de abajo.
UI = `frontend/src/features/carpetas/AsignacionTerapeuta.test.tsx`.

| Criterio | Prueba concreta | Entorno / resultado |
| --- | --- | --- |
| Admin asigna A y transfiere a B; respuesta, propio/ajeno, listado, sin asignar y acceso admin | `alta y transferencia HTTP actualizan detalle, listado y auditoría` | PG, pasa; 404 antes de asignar y para antigua responsable; 200 para actual/admin; marketing 403 |
| Impedir asignación/reasignación directa a terapeutas/marketing; sin sesión/inválida | `peticiones directas de terapeutas/marketing y sin sesión no alteran responsable` | PG, pasa; PUT y GET/POST/DELETE relacionados; 403 o 401 y responsable anterior intacta |
| UUID/cuerpo inválido, extra campos, caso inexistente/borrado | `UUID/cuerpos inválidos se rechazan sin cambios persistidos` | PG, pasa; 400/404, sin alterar asignación ni auditoría |
| Perfil inexistente/inactivo/otro rol | `inexistente, inactiva y otros roles conservan la asignación anterior` | PG, pasa; 404 Usuario no encontrado o 400 Solo se puede asignar a terapeutas activos |
| Exactamente una responsable y repetición sin duplicados | `repetir asignación devuelve 409 y no duplica responsable ni auditoría` | PG, pasa; contrato actual no idempotente, 409 Ese terapeuta ya está asignado al caso |
| Fallo durante sustitución revierte DELETE e INSERT y auditoría | `fallo real de INSERT revierte DELETE y auditoría de la sustitución` | PG, pasa; 500 y antigua responsable conserva acceso |
| Rutas relacionadas de administración | `rutas relacionadas permiten a admin listar, asignar y quitar` | PG, pasa; POST 201, GET 200, DELETE 204 y pérdida de acceso |
| Dos solicitudes simultáneas conservan unicidad | `dos asignaciones HTTP bloqueadas conservan una sola responsable` | PG, pasa; dos conexiones observadas esperando Lock; ambas PUT 200, una fila final, sin imponer ganadora |
| Auditoría y autor/fecha | Prueba de transferencia y respuesta PUT | PG, pasa; INSERT A, DELETE A, INSERT B con usuario_id admin; asignadoPor/asignadoEn correctos |
| Mensajes de error sin cambio visual indebido y nuevo intento | `muestra error 400/500 sin cambiar responsable y permite volver a guardar` | UI, pasan 2 casos nuevos; PUT fallido seguido de PUT exitoso |
| Protección de doble envío y bloqueo del selector | `bloquea doble clic y selector mientras la asignación está pendiente` | UI, pasa; respuesta diferida, un único PUT para doble clic |

Las seis pruebas UI previas cubren: carpeta sin asignar accesible a dirección,
selector de activas, responsable/autor después de guardar, transferencia y rechazo
de antigua responsable, ausencia de controles para terapeuta y URL de carpeta ajena.
Las PG reutilizadas cubren además totales autorizados, detalle/resumen y búsqueda sin
filtración; sus nombres y matriz están en el documento FE-41 de este directorio.

## Entornos y ejecución real

PostgreSQL 16 en contenedor exclusivo `fe38-qa-20261022`, puerto loopback 55438,
base administrativa local `fe40_qa`. Se conserva el opt-in FE-40 para reutilizar
infraestructura: la suite crea una base aleatoria `fe40_run_*`, aplica 001–003 y la
elimina al finalizar. El contenedor y sus volúmenes se eliminan después de ejecutar.
No se usa DATABASE_URL, no se carga .env, no se alteran bases compartidas.

NestJS, DatabaseService, SQL y guards AuthGuard/RolesGuard son reales. El helper
`test/helpers/casos.mjs` intercepta únicamente la consulta remota a
`https://auth.invalid/auth/v1/user`, asociando tokens ficticios a UUID de perfiles;
AuthService carga rol/actividad desde PostgreSQL. `auth.users` es solo soporte mínimo
de FK. Esto NO verifica Supabase Auth real. La UI usa jsdom, Testing Library y API
simulada en memoria, sin PostgreSQL ni Supabase.

Para provocar fallo tardío se añade exclusivamente en la base desechable una CHECK
NOT VALID que rechaza el nuevo INSERT de B; se retira en finally. No hay mecanismo
de fallos añadido al código de producción. La prueba concurrente bloquea el caso
desde una tercera conexión y consulta pg_stat_activity antes de soltarlo; no se basa
solo en Promise.all ni en un mock del servicio.

Comandos ejecutados desde backend:

```powershell
npm.cmd run build
npm.cmd run test:unit
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55438/fe40_qa'
node --test test/listado-carpetas-postgres.test.mjs
node --test test/altas.test.mjs
```

Resultados: build aprobado; 27 unitarias aprobadas; 21 PG aprobadas (13 previas y
8 nuevas), cero fallidas/omitidas; 25 altas con DB simulada aprobadas por regresión
del helper HTTP ampliado. No se repite la suite de concurrencia de altas: no se
modificó su lógica ni las migraciones. No existe script de lint backend.

Desde frontend:

```powershell
npm.cmd run test -- src/features/carpetas/AsignacionTerapeuta.test.tsx
npm.cmd run lint
npm.cmd run build
```

Resultados: 9 UI aprobadas (6 previas, 3 nuevas), lint y build aprobados.
`git diff --check` desde raíz: aprobado.

## Cambios, defectos y pendientes

Archivos: helper HTTP (`solicitar` permite variar método/ruta/token/cuerpo), suite PG
(perfil inactivo ficticio y ocho casos de asignación), suite UI (tres casos) y este
documento. No se detectaron defectos que requieran cambiar producción. Se conserva
el comportamiento 409 al repetir y 404 para perfil inexistente; no se redefine la
política ni se cambian rutas existentes. Auditoría identifica actor y caso mediante
datos_nuevos/datos_anteriores; la tabla de asignaciones no tiene columna id propia.

Pendiente recorrido con navegador y Supabase QA real: no hay navegador conectado
en las herramientas ni archivos .env QA preparados (solo ejemplos). En QA autorizado,
entrar como admin, asignar una carpeta ficticia sin responsable a A, comprobar detalle
y listado con A/B, transferir a B y repetir; A debe recibir 404 en su siguiente GET.
Comprobar marketing denegado y autor/fecha. No guardar credenciales o tokens en evidencia.

Los criterios automatizados consultados en FE-38/FE-35 quedan demostrados con API
NestJS/PostgreSQL reales y Auth simulado identificado. Lista para revisión; la
comprobación manual con Supabase permanece pendiente y no se presenta como ejecutada.

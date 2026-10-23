# FE-30 — Verificación de cuentas y restricciones

Fecha: 2026-10-16 (America/La_Paz). Rama comprobada: `feature/FE-30-verificacion-cuentas-roles`.

## Alcance y fuentes inspeccionadas

- Backend: módulos `usuarios`, `auth` y `casos`; clientes Supabase de Auth/administración, DTO de creación/edición/login, guards globales, registro de módulos y ValidationPipe de `main.ts`.
- Frontend: rutas de `App.tsx`, `RutaProtegida`, menú de `Plantilla`, formulario/listado de usuarios, validaciones y adaptadores API; pruebas existentes de login, sesión, navegación y usuarios.
- Migración disponible: `db/migrations/001_esquema_base.sql`. `perfiles.id` referencia `auth.users`; `perfiles.rol` tiene CHECK con tres valores; `activo` es NOT NULL y por defecto true. La migración local no define un índice de unicidad del correo en `auth.users`: ese esquema pertenece a Supabase Auth. No se ejecutó ninguna migración ni se inspeccionó/modificó una base real.
- Contrato de referencia: `docs/api/contrato-frontend-backend.md`, que todavía marca varios endpoints como pendientes. Se contrastó con el código actual, sin tomar ese documento como prueba de implementación.

Los roles reales, coincidentes en tipos backend/frontend, DTO y CHECK SQL, son **administrador**, **terapeuta** y **marketing**. Las etiquetas visuales Dirección y Apoyo / marketing no son roles adicionales.

## Qué se ejecutó realmente

1. Backend por HTTP local: módulos AuthModule, UsuariosModule y CasosModule reales, con sus controladores, servicios, guards globales y validación. Las respuestas HTTP de Supabase y DatabaseService se simulan. No se usaron contraseñas, claves ni tokens reales. No se verificó criptografía JWT contra Supabase: el proveedor simulado decide si acepta la credencial inventada.
2. Frontend: suite existente de FE-25/FE-28 y pruebas nuevas de FE-30 en jsdom, MemoryRouter y fetch simulado. Las pruebas no constituyen un navegador real ni una conexión React → Nest → Supabase de extremo a extremo.
3. Supabase/PostgreSQL reales: **no ejecutado**. Solo se encontró `.env.example`, sin variables SUPABASE/DATABASE_URL disponibles en esta sesión. Tampoco se ejecutaron SQL, índices, triggers o políticas RLS en un PostgreSQL temporal.

La suite verde prueba los resultados descritos dentro de estos límites. Las pruebas de caracterización de un defecto pasan cuando reproducen el resultado incorrecto; no lo validan como aceptable.

## Permisos actuales encontrados

| Operación | administrador | terapeuta | marketing | Sin autenticación |
|---|---|---|---|---|
| Login, si existe perfil activo y Auth acepta las credenciales | 200 | 200 | 200 | Login es público; no requiere sesión previa |
| Consultar identidad propia, GET `/api/auth/me` | Permitido | Permitido | Permitido | 401 |
| Listar/consultar/crear/editar cuentas en `/api/usuarios` | Permitido; autodesactivación y pérdida del rol propio: 400 | 403 | 403 | 401 |
| GET/POST `/api/casos`, GET `/api/casos/:id` | Guard permite; listado 200 comprobado con DB simulada | 403 | 403 | 401 |
| Interfaz `/usuarios` | Permitido | Bloqueado | Bloqueado | Login |
| Interfaz `/carpetas` y detalle | Permitido | Permitido en UI/simulador; backend clínico actual no ofrece esa autorización | Bloqueado | Login |
| Interfaz `/carpetas/nueva` | Permitido | Bloqueado | Bloqueado | Login |

El éxito de registro clínico de administrador no se ha probado: POST con un DTO inválido y roles no autorizados solo verifica el rechazo del guard, no la lógica de pacientes. La autorización clínica de terapeutas está anunciada como pendiente de FE-37 en el propio controlador; no se inventó una política de acceso ya implementada.

## Matriz de verificaciones y resultados

| # | Verificación | Resultado observado | Evidencia y límite |
|---|---|---|---|
| 1 | Unicidad de correo exacto, mayúsculas y mezcla | 409, sin nueva cuenta/perfil en el doble | Backend HTTP con proveedor simulado; UI existente también prueba correo en mayúsculas. Unicidad real y concurrencia pendientes |
| 2 | Creación válida y duplicidad | 201 para cada rol; errores 409/422 con `email_exists` o `user_already_exists` se traducen a 409 | Servicios y cliente admin reales; Supabase/DB simulados. Se comprueba ausencia de contraseña en la respuesta |
| 3 | Inicio de sesión de cada rol | 200 con el rol del perfil y acceso a identidad propia | Se crea y luego autentica cada rol; proveedor simulado. Las pruebas previas de Plantilla ya ejercitan login de los tres roles en UI |
| 4 | Operaciones autorizadas | Admin lista/consulta/crea/edita/desactiva otras cuentas y lista casos; demás roles quedan restringidos | HTTP local. Operaciones no implementadas no se declaran verificadas |
| 5 | Rol sin permiso | 403 para terapeuta/marketing en GET/POST/PATCH usuarios y GET/POST casos/detalle | Guards reales; sin escrituras de perfiles ni llamadas al cliente admin de Supabase |
| 6 | Petición sin autenticación | 401 en las siete operaciones protegidas de la matriz HTTP | Sin consultas externas ni escrituras del doble de perfiles |
| 7 | Coincidencia frontend/backend | Parcial: cuentas coincide en roles; discrepancias de contraseña/listado; consultas clínicas de terapeuta pendientes de integración | Pruebas de caracterización y comparación de código/contrato; ver hallazgos |
| 8 | Elevación mediante petición manipulada | Rechazada: header de rol no supera guards; PATCH para asignarse admin devuelve 403; metadata externa hostil no determina rol; token inventado alterado recibe 401; campos extra en login/creación/edición y roles desconocidos: 400 | Credenciales ficticias y proveedor simulado; no es un pentest criptográfico de Supabase |
| 9 | Cuentas inactivas | Login, refresh y petición con credencial anterior reciben 403; perfil inexistente también impide acceso | Backend lee perfil en cada petición. UI existente muestra Inactiva y traduce 403 de login a mensaje genérico |
| 10 | Cobertura faltante | Añadidas 45 pruebas backend y 7 frontend; suites previas reutilizadas sin copiarlas | Backend no tenía archivos de prueba ni script test en esta rama al iniciar |
| Adicional | Compensación al fallar perfil | Creación devuelve 500 y se llama a eliminación de la cuenta ficticia | No verifica transacciones, triggers ni compensación real en Supabase |
| Adicional | Admin conserva acceso propio | Autodesactivación y cambio de su rol a terapeuta devuelven 400 | Servicio Usuarios real, sin escritura de perfil |

## Hallazgos: defectos de integración

### FE30-01 — Listado de cuentas incompatible (bloquea la integración)

`UsuariosController.listar` devuelve directamente el arreglo de `UsuariosService.listar`. `frontend/src/features/usuarios/usuariosApi.ts` desestructura `{ usuarios }`. Con la respuesta actual del backend, `listarUsuarios()` devuelve undefined; la pantalla no llega a mostrar las cuentas. El simulador entrega el envoltorio y oculta el problema.

Reproducción: prueba backend de caracterización comprueba que GET usuarios es un arreglo; prueba frontend alimenta ese arreglo al adaptador y obtiene undefined. Son verificaciones complementarias con mocks, no una sesión real de navegador contra Nest.

Propuesta: responsables de FE-28/FE-29 deben acordar un único formato (el contrato escrito propone `{ usuarios: [...] }`) y actualizar la parte correspondiente y sus pruebas. No corregido en FE-30.

### FE30-02 — Política de contraseña inconsistente (bloquea altas válidas según la UI)

UI y simulador permiten 8 caracteres con letras y números; `CrearUsuarioDto` exige mínimo 10 y máximo 72. El formulario puede enviar datos que considera válidos y recibir 400. La prueba frontend confirma el envío y manejo del rechazo; la prueba HTTP backend confirma que ese tamaño se rechaza antes de llamar a administración Supabase.

Propuesta: acordar la política y alinear formulario, DTO, simulador, documentación y pruebas. No se rebajó ni amplió ninguna política en esta subtarea.

## Funcionalidades pendientes y límites (distintos de los defectos anteriores)

- Acceso clínico de terapeuta: UI/simulador lo permiten para casos asignados, pero `CasosController` tiene `@Roles('administrador')` y declara pendiente FE-37. Además, frontend usa `/api/carpetas`, mientras el controlador actual expone `/api/casos`. La falta de esa integración bloquea afirmar coincidencia completa, pero no se observó una elevación de privilegios: el backend restringe el acceso.
- Gestión de estado de cuentas: backend permite PATCH de rol/activo; la UI actual muestra estado y crea cuentas, sin formulario de edición/desactivación. Se clasifica como interfaz no implementada, sin agregarla a FE-30.
- El filtro de terapeutas activos solicitado por frontend no es procesado por el controlador/servicio actual de listado, que devuelve todas las cuentas. Es parte de la integración pendiente de asignaciones y no se probó contra un servidor real.
- Correo: el formulario hace trim y lowercase; el backend pasa el correo del DTO a Supabase sin normalización local ni comprobación SQL previa. La unicidad se delega al proveedor. El doble modela comparación sin distinguir mayúsculas, conforme al comportamiento del simulador existente; no demuestra la restricción desplegada ni una regla universal sobre direcciones de correo.
- El CHECK de roles y `activo NOT NULL` se inspeccionaron estáticamente; la suite con DB simulada no demuestra su aplicación, RLS ni la auditoría real de triggers.
- Queda pendiente comprobar creación concurrente del mismo correo (también variantes), login por variante de mayúsculas y compensación de fallos usando un proyecto Supabase/PostgreSQL de QA. No se usaron datos ni credenciales de producción.

## Evidencias de ejecución

| Directorio | Comando | Resultado |
|---|---|---|
| backend | `npm.cmd run test` | Exit 0; compila con Nest y ejecuta node:test; 45 aprobadas, 0 fallidas/omitidas; runner 5831.56 ms |
| backend | `npm.cmd run build` | Exit 0 tanto dentro de test como en ejecución independiente |
| frontend | `npm.cmd run test` | Exit 0; 9 archivos, 72 pruebas aprobadas; 55.27 s |
| frontend | `npm.cmd run lint` | Exit 0 |
| frontend | `npm.cmd run build` | Exit 0; 126 módulos transformados |
| raíz | `git diff --check` | Exit 0, sin errores |

Backend no tiene script lint ni configuración de linter propia disponible. No se añadió una dependencia solo para esta verificación. Los valores de autenticación de los fixtures son inventados y no se reproducen en estas evidencias.

Archivos creados o modificados:

- `backend/package.json`: añade únicamente el comando test con el runner integrado de Node, sin dependencias nuevas.
- `backend/test/cuentas-roles.test.mjs`: integración local HTTP y caracterizaciones del backend.
- `frontend/src/features/usuarios/CuentasRoles.test.tsx`: casos de rutas no cubiertos, errores remotos del formulario y formato de listado.
- `docs/FE-30-verificacion-cuentas-roles.md`: este informe.

No se modificó código de producción en `backend/src`, `frontend/src`, migraciones o reglas de negocio. Solo se agregó un archivo de pruebas en frontend/src. No se modificó el lockfile. No se hicieron commit, push, merge ni cambios en Jira.

## Recomendación

**No marcar FE-30 como Listo todavía.** Los guards y flujos probados responden correctamente dentro del entorno simulado, pero FE30-01 y FE30-02 impiden declarar integrada la gestión de cuentas. La coincidencia clínica frontend/backend sigue pendiente y no hay evidencia real de unicidad del proveedor.

Para cerrar: resolver o acordar formalmente los defectos con sus responsables; invertir las pruebas de caracterización para exigir el contrato correcto; documentar el alcance aceptado de FE-37 y completar las verificaciones de correo/roles en un entorno QA aislado, sin registrar credenciales o tokens ni modificar la base real. Repetir las validaciones tras cualquier corrección.

## Seguimiento tras la integración (2026-10-23)

- FE30-01 corregido en `93d18e4` (FE-29): `GET /api/usuarios` devuelve `{ usuarios }` y acepta los filtros `rol` y `activo`.
- FE30-02 corregido en `d4678b5` (FE-28, FE-46): formulario y simulador exigen de 10 a 72 caracteres, igual que `CrearUsuarioDto`.
- Las pruebas de caracterización se invirtieron para exigir el contrato correcto.
- El acceso de terapeuta a sus carpetas asignadas ya está en `/api/carpetas` (FE-37, FE-40).

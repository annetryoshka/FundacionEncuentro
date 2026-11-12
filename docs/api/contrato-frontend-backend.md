# Contrato frontend ↔ backend · Sprint 1

Qué espera el frontend (`frontend/`) de cada endpoint del backend (`backend/`). Lo que ya existe se
documenta tal como está implementado; lo pendiente es la propuesta que el frontend ya usa. Si el backend
necesita cambiar algo, actualicen este archivo y el `tipos.ts` correspondiente del frontend en el mismo PR.

| Endpoint | Backend (Jira) | Frontend (Jira) | Estado |
| --- | --- | --- | --- |
| `POST /api/auth/login` | FE-22 | FE-21 | ✅ implementado; validación manual con Supabase real pendiente en FE-34 |
| `POST /api/auth/refresh` | FE-22 | sesión | ✅ implementado; FE-34 no verifica Supabase real |
| `POST /api/auth/logout` | FE-26 | FE-24 / FE-25 | ✅ implementado; revocación real fuera de la verificación FE-34 |
| `GET /api/auth/me` | FE-22 | — | ✅ implementado (el frontend aún no lo necesita) |
| `GET` / `POST /api/usuarios` | FE-29 | FE-28 | ✅ implementado |
| `POST /api/casos` | FE-32, FE-33 | FE-31 | ✅ alta integral y pruebas FE-34 |
| `GET /api/carpetas/:id` | FE-37 | FE-31, FE-36 | ✅ implementado; consulta posterior al alta |
| `PUT /api/carpetas/:id/terapeuta` | FE-37 | FE-36 | ✅ implementado |
| `GET /api/carpetas` | FE-40 | FE-39 | ✅ implementado; SQL probado con PostgreSQL real y Auth simulado |
| `PATCH /api/carpetas/:id` | FE-52 | FE-52 | ⚠️ implementado; respuesta de asignación pendiente de corregir |

"Probado de punta a punta": el backend NestJS real, con la migración 001 en PostgreSQL y un Supabase Auth de
prueba, recorrido desde el navegador con el frontend en `npm run dev`.

FE-34 no aporta esa comprobación manual: sus pruebas HTTP utilizan Auth simulado.
La concurrencia y persistencia sí se ejecutaron en PostgreSQL 16 desechable con las
migraciones 001 y 002. Esto no equivale a validar Supabase Auth real ni el navegador.

## Reglas generales (las que ya usa el backend)

- Prefijo `/api`. JSON con claves en camelCase.
- Guard global (`AuthGuard`): todo exige `Authorization: Bearer <accessToken>` salvo lo marcado con `@Public()`.
- Errores con el formato de NestJS: `{ "statusCode": 400, "message": "texto" | ["textos"], "error": "Bad Request" }`.
- **401** → el frontend intenta **una** renovación con `/auth/refresh`; si falla, cierra la sesión y vuelve al login.
- **403** → falta de permiso. El frontend muestra un aviso y no cierra la sesión.
- **404 `Cannot GET /api/…`** (ruta inexistente) → el frontend muestra "todavía no está disponible en el servidor".
- **404 en una carpeta ajena:** una terapeuta que pide un caso no asignado debe recibir lo mismo que si no existiera.
- Fechas sin hora: `"AAAA-MM-DD"`. Momentos: ISO 8601.
- Nunca devolver contraseñas, hashes ni tokens de otras personas.
- Toda escritura dentro de `db.transaction(usuarioId, …)` (auditoría).

## Permisos de carpetas

| | `administrador` | `terapeuta` | `marketing` |
| --- | --- | --- | --- |
| Listar / crear cuentas | ✅ | 403 | 403 |
| Listar / buscar carpetas | todas | solo asignadas | 403 |
| Ver una carpeta | todas | solo asignadas (si no, 404) | 403 |
| Registrar paciente | ✅ | 403 | 403 |
| Asignar terapeuta | ✅ | 403 | 403 |

AuthGuard y RolesGuard ya son globales. Los permisos del alta y del detalle descritos
abajo se aplican en backend, independientemente del frontend.

---

## ✅ Autenticación (ya implementada en `backend/src/modules/auth`)

`POST /api/auth/login` · `@Public()`

```json
{ "email": "laura@fundacion.org", "password": "••••••••" }
```

200 (`RespuestaSesion`):

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 3600,
  "usuario": { "id": "uuid", "nombreCompleto": "Laura Quiroga", "rol": "administrador" }
}
```

| Caso | Respuesta real | Qué muestra el frontend |
| --- | --- | --- |
| Correo con formato inválido | 400 `["El correo no tiene un formato válido"]` | Mensaje genérico (el formulario ya lo valida antes) |
| Credenciales incorrectas | 401 `Correo o contraseña incorrectos` | Mensaje genérico |
| Sin perfil o `activo = false` | 403 `Tu usuario no tiene acceso al sistema` | **El mismo** mensaje genérico (FE-20) |
| Demasiados intentos | 429 | "Hubo demasiados intentos…" |
| Supabase caído | 503 | "El servicio de inicio de sesión no responde…" |

`POST /api/auth/refresh` · `@Public()` → `{ "refreshToken": "…" }` → misma respuesta que el login; 401 si ya no sirve.

`POST /api/auth/logout` → 204 cuando el servicio termina sin error. La revocación del
refresh token en Supabase real no está comprobada por FE-34; corresponde a FE-26/FE-27.

`GET /api/auth/me` → `{ id, nombreCompleto, rol }`.

**Observación para FE-22:** si el perfil está inactivo, `login` lanza 403 **después** de abrir la sesión en
Supabase, y esa sesión queda abierta. Conviene llamar a `supabase.cerrarSesion(sesion.access_token)` antes del 403.

---

## ✅ `GET /api/usuarios` (FE-29)

Filtros opcionales: `?rol=terapeuta&activo=true` (la asignación los usa para listar terapeutas activas).

```json
{
  "usuarios": [
    {
      "id": "uuid",
      "nombreCompleto": "Sofía Mamani",
      "email": "sofia@fundacion.org",
      "rol": "terapeuta",
      "activo": true,
      "creadoEn": "2026-10-06T14:00:00.000Z"
    }
  ]
}
```

Orden alfabético. `perfiles` no tiene correo: sale de `auth.users` (`join auth.users u on u.id = perfiles.id`).

## ✅ `POST /api/usuarios` (FE-29)

```json
{ "nombreCompleto": "Ana Pérez", "email": "ana@fundacion.org", "rol": "terapeuta", "password": "Segura12345" }
```

Se usan `email` y `password`, igual que en el login.

- `rol`: `administrador` | `terapeuta` | `marketing`. `password`: de 10 a 72 caracteres (`CrearUsuarioDto`);
  el frontend además pide letras y números y valida lo mismo antes de enviar (FE-46).
- **201**: el usuario creado, con la misma forma que en el listado. **400** campos inválidos.
  **409** correo ya registrado: Supabase responde 422 `email_exists` y hay que traducirlo a 409.
- Implementación sugerida: Admin API de Supabase (`POST {SUPABASE_URL}/auth/v1/admin/users` con la
  `SUPABASE_SERVICE_ROLE_KEY`, `email_confirm: true`) y luego `insert into perfiles` dentro de `transaction()`.
  Si falla el insert, borrar el usuario de Auth.

## ✅ `GET /api/carpetas` (FE-40)

`?busqueda=&pagina=1&tamano=10`

- `busqueda` opcional, máximo 150 caracteres. Vacía o solo espacios lista todas las
  carpetas autorizadas. Cada palabra del texto debe aparecer en el nombre, sin
  distinguir orden, tildes ni mayúsculas; `%` y `_` se tratan como texto literal.
- Solo dígitos → número exacto, admitiendo ceros iniciales. Puede devolver un
  voluntario y un derivado con el mismo número. Un número fuera del rango `integer`
  devuelve cero resultados, sin intentar convertirlo en SQL.
- `pagina`: entero de 1 a 2147483647, predeterminado 1. `tamano`: entero de 1 a 100,
  predeterminado 10 (mismo máximo del listado existente de casos). Valores inválidos,
  parámetros repetidos o desconocidos: 400. Página sin filas: arreglo vacío y total
  autorizado conservado. El desplazamiento máximo cabe en un entero SQL de 64 bits.
- Administrador: todas las carpetas vigentes, incluidas las no asignadas. Terapeuta:
  solo las actualmente asignadas a su perfil. Marketing: 403. Sin sesión o token
  inválido: 401. El rol y el perfil proceden de los guards, nunca de la consulta.
- Asignación, búsqueda y exclusión de casos o pacientes borrados lógicamente se
  aplican **en SQL antes de paginar**, con el mismo fragmento de filtros para el total.
- Orden: fecha de ingreso descendente, número descendente e UUID del caso ascendente
  como desempate estable. `id` es `casos.id`; las fechas son AAAA-MM-DD.
- Solo campos de resumen; no devuelve diagnóstico, comentarios, teléfonos ni otros
  datos clínicos. `terapeuta` es `null` cuando no hay responsable.
- Requiere aplicar `003_busqueda_carpetas_unaccent.sql` después de 001 y 002.
  La 003 instala `unaccent` en `extensions`; no altera migraciones anteriores.
- `GET /api/casos` mantiene su contrato previo independiente (`datos`, `limite`,
  `desplazamiento`). El alta y el detalle de FE-34/FE-37 no cambian.

```json
{
  "carpetas": [
    {
      "id": "uuid de casos.id",
      "numero": 12,
      "tipo": "voluntario",
      "estado": "en_proceso",
      "fechaIngreso": "2026-09-09",
      "paciente": { "id": "uuid", "nombreCompleto": "Familia Nina Calle" },
      "terapeuta": { "id": "uuid", "nombreCompleto": "Sofía Mamani" }
    }
  ],
  "total": 14,
  "pagina": 1,
  "tamano": 10
}
```

## ✅ `POST /api/casos` (FE-32, FE-33; verificación FE-34)

Ruta de alta real; no existe `POST /api/carpetas`. Solo administración puede crear
un paciente y abrir su carpeta. El frontend conserva su formulario y transforma los
campos al DTO anidado mediante `registrarCarpeta()`.

Paciente nuevo:

```json
{
  "paciente": { "nombreCompleto": "Paciente ficticio QA" },
  "caso": { "tipo": "voluntario", "fechaIngreso": "2026-10-01" }
}
```

Paciente existente, para abrir otra carpeta sin crear otro paciente:

```json
{
  "pacienteId": "00000000-0000-4000-8000-000000000010",
  "caso": { "tipo": "derivado", "numeroCorrelativo": 42, "fechaIngreso": "2026-10-01" }
}
```

- Enviar exactamente uno entre `paciente` y `pacienteId`; ambos o ninguno: 400.
  `pacienteId` debe ser UUID y referir un paciente no borrado; si no existe: 404.
- `paciente.nombreCompleto` es obligatorio, máximo 150 caracteres; vacío o solo
  espacios se rechaza. Se admiten opcionalmente `fechaNacimiento`, `edadAlIngreso`
  entre 0 y 120 y `telefono` de hasta 30 caracteres.
- `caso.tipo` es obligatorio: `voluntario` o `derivado`. `estado` es opcional:
  `iniciado`, `en_proceso` o `concluido`; por defecto `iniciado`.
- `caso.fechaIngreso` es opcional; si se omite toma `current_date` de PostgreSQL.
  Las fechas suministradas deben ser reales con formato AAAA-MM-DD. No se permite
  ingreso futuro ni nacimiento posterior al ingreso de un paciente nuevo.
- `caso.numeroCorrelativo` es opcional, entero de 1 a 999999, para carpetas históricas.
  Si se omite se asigna automáticamente. La unicidad es por `(tipo, numero)`; no es
  una numeración global ni se exige ausencia de huecos por importaciones manuales.
- Se admiten `diagnosticoIngreso`, `hipotesisRelacional` y `comentariosClinicos`
  opcionales en `caso`, hasta 5000 caracteres cada uno.
- `contextoJudicial` es opcional y solo se admite para derivados. Sus campos son
  `juzgado`, `nroExpediente`, `fechaDerivacion` y `observaciones`.
- Campos no contemplados por los DTO se rechazan con 400. Sin autenticación: 401;
  terapeuta o marketing autenticados: 403.
- Paciente, caso, contexto opcional y lecturas para preparar la respuesta usan el
  mismo PoolClient de `DatabaseService.transaction()`. El COMMIT ocurre después
  de construir la respuesta. Fallos en esas operaciones provocan rollback.

Respuesta **201** con el contrato de CasosService, distinto del detalle de FE-37:

```json
{
  "id": "00000000-0000-4000-8000-000000000020",
  "tipo": "voluntario",
  "numeroCorrelativo": 12,
  "estado": "iniciado",
  "fechaIngreso": "2026-10-01",
  "diagnosticoIngreso": null,
  "hipotesisRelacional": null,
  "comentariosClinicos": null,
  "creadoEn": "2026-10-22T12:00:00.000Z",
  "paciente": {
    "id": "00000000-0000-4000-8000-000000000010",
    "nombreCompleto": "Paciente ficticio QA",
    "fechaNacimiento": null,
    "edadAlIngreso": null,
    "telefono": null
  },
  "contextoJudicial": null,
  "posiblesDuplicados": []
}
```

**Conflicto de numeración:** 409 cuando se viola `uq_caso_numero`; no se conserva
ningún paciente nuevo de la transacción fallida. No significa nombre duplicado.

**Nombres similares:** el alta se permite y devuelve 201. `posiblesDuplicados`
contiene hasta cinco sugerencias con `pacienteId`, `nombreCompleto` y `similitud`
mayor a 0.6. Son UUID de pacientes, no de carpetas, y no deben usarse como enlaces
`/carpetas/:id`. Para un paciente existente este arreglo queda vacío. La UI muestra
una advertencia sin bloquear ni inventar unicidad por nombre.

### Continuación del frontend y recuperación del detalle

1. `/carpetas/nueva` ejecuta un POST mediante `registrarCarpeta()`. La referencia
   `envioEnCurso` y el botón deshabilitado impiden doble envío mientras está pendiente.
2. Después del 201, navega a `/carpetas/{id}` usando el UUID del caso recibido.
   `PaginaCarpeta` carga `GET /api/carpetas/{id}` mediante `useCarga`.
3. Si ese GET falla por red o HTTP 500, el UUID permanece en la URL y se indica que
   el registro ya se guardó. `ErrorDeCarga` permite reintentar la consulta del mismo
   detalle. Ese reintento ejecuta GET y no vuelve a ejecutar POST.
4. No existe idempotencia HTTP nueva: repetir deliberadamente una petición de alta
   puede crear otra carpeta. La advertencia por nombre no convierte el alta en 409.
   Si se pierde la respuesta del propio POST, no debe inferirse que el servidor no
   guardó: esta revisión distingue ese caso del POST confirmado seguido de GET fallido.

## ✅ `GET /api/carpetas/:id` (FE-37)

`:id` es el UUID del caso, no el UUID del paciente. Responde 200 para administración
o para la terapeuta asignada. Caso ajeno/inexistente: 404; marketing: 403; sin sesión:
401. La respuesta incluye `id`, `numero` (no `numeroCorrelativo`), `tipo`, `estado`,
`fechaIngreso`, `paciente: { id, nombreCompleto }` y `terapeuta` nullable, más:

```json
{
  "creadoPor": { "id": "uuid", "nombreCompleto": "Laura Quiroga" },
  "creadoEn": "2026-10-11T15:00:00.000Z",
  "asignadoPor": { "id": "uuid", "nombreCompleto": "Laura Quiroga" },
  "asignadoEn": "2026-10-11T15:05:00.000Z"
}
```

## ✅ `PUT /api/carpetas/:id/terapeuta` (FE-37)

`{ "perfilId": "uuid" }` → 200 con la carpeta actualizada. 400 si no es una terapeuta activa.
Una responsable por caso: borrar la asignación anterior e insertar la nueva en la misma transacción.
La terapeuta anterior recibe 404 en su siguiente petición a ese caso.

## ✅ Clasificación, estado y filtros (backend FE-48 · interfaz FE-47)

Reglas completas en `docs/srs/sprint-2/FE-59-clasificacion-y-filtros.md`. Requiere aplicar
`004_clasificacion_casos.sql` después de 001–003.

- `GET /api/carpetas` acepta además `clasificacion=social|privado` y
  `estado=iniciado|en_proceso|concluido`. Se combinan con `busqueda` y la paginación; un
  valor desconocido es 400. Cada carpeta del resumen trae `clasificacion` (`null` = sin
  clasificar). «Todos» significa no enviar el parámetro, así que incluye las sin clasificar.
- `GET /api/carpetas/:id` incluye `clasificacion`, `actualizadoPor` y `actualizadoEn`.
- `PATCH /api/carpetas/:id/clasificacion` `{ "clasificacion": "social" | "privado" }` →
  200 `{ id, clasificacion, actualizadoPor, actualizadoEn }` (`actualizadoPor` es el UUID).
- `PATCH /api/casos/:id/estado` `{ "estado": "iniciado" | "en_proceso" | "concluido" }` →
  200 `{ id, estado, actualizadoPor, actualizadoEn }`.
- Los dos PATCH: administración o la terapeuta asignada. Caso inexistente o no asignado: 404
  "Caso no encontrado". Marketing: 403. Valor inválido o campos extra: 400. No cambian número,
  origen, paciente ni terapeuta.

Uso en el frontend (FE-47):

- Listado: selectores «Clasificación» y «Estado» junto a la búsqueda. Se aplican al elegirlos,
  viven en la URL (`?q=&clasificacion=&estado=&pagina=`) y cualquier cambio vuelve a la
  página 1. Un valor desconocido en la URL se ignora (no se envía). Sin resultados, el mensaje
  nombra el filtro y ofrece «Quitar filtros».
- Carpeta: tarjeta «Clasificación y estado» con dos guardados independientes, cada uno con su
  carga y su resultado. Como el PATCH solo devuelve el campo guardado y el UUID de quien
  actualizó, después de guardar se vuelve a pedir `GET /api/carpetas/:id` para mostrar el
  nombre en «Última actualización». Un 404 se explica como pérdida de acceso (reasignación).
- No existe filtro «solo sin clasificar»: el backend no lo ofrece y FE-59 no lo pide.

## ✅ Expediente clínico del Sprint 2 (backend PR #26–#33 · interfaz FE-62, 67, 72, 77, 82, 87, 92)

Todas las rutas comprueban el acceso al caso: administración o la terapeuta asignada. Un caso ajeno o
inexistente responde 404 "Caso no encontrado"; marketing, 403. Fechas sin hora en `AAAA-MM-DD`.

| Interfaz | Endpoint | Notas para el frontend |
| --- | --- | --- |
| FE-72 | `GET /api/carpetas/:id/sesiones` → `{ sesiones }` | Orden por fecha y número. El listado **no** trae `evolucion`. |
| FE-72 | `POST /api/carpetas/:id/sesiones` `{ fecha, evolucion }` → 201 `{ sesion }` | El número lo asigna el servidor. 400 si el caso no tiene terapeuta activa asignada. |
| FE-72 | `GET /api/carpetas/:id/sesiones/:sesionId` → `{ sesion }` | `responsable` es `{ id, nombreCompleto }`. 404 "Sesión no encontrada". |
| FE-77 | `GET /api/carpetas/:id/tareas` → `{ tareas }` | Todas las del caso; la interfaz filtra por `sesionId`. |
| FE-77 | `POST /api/carpetas/:id/tareas` `{ sesionId, descripcion }` → 201 `{ tarea }` | Nace `pendiente`. 400 si la sesión es de otro caso. |
| FE-77 | `PATCH /api/carpetas/:id/tareas/:tareaId/cumplimiento` `{ estado: 'pendiente' \| 'realizada' }` → `{ tarea }` | Si el estado no cambia, no registra otra actualización. |
| FE-67 | `GET /api/carpetas/:id/diagnostico` → `{ diagnostico \| null }` | `null` = sin ficha (no es un error). |
| FE-67 | `PUT /api/carpetas/:id/diagnostico` `{ fecha, diagnosticoIngreso, hipotesisRelacional?, comentariosClinicos? }` | Crea o reemplaza la ficha única; conserva `id`, `creadoPor` y `creadoEn`. |
| FE-62 | `GET /api/carpetas/:id/constancia` → `{ constancia \| null }` | ⚠️ `fechaConsentimiento` llega como timestamp (`2026-11-10T04:00:00.000Z`); la interfaz toma la fecha calendario. |
| FE-62 | `PUT /api/carpetas/:id/constancia` `{ procedencia?, origenJudicial, estado, fechaConsentimiento?, referenciaEvidencia?, explicacion? }` | `pendiente`: sin fecha, evidencia ni explicación. `registrado`: fecha y evidencia. `no_aplica`: explicación. |
| FE-87 | `GET /api/carpetas/:id/pagos` → `{ pagos }` | Solo administración (403 para terapeutas). `monto` es texto decimal con punto. |
| FE-87 | `POST /api/carpetas/:id/pagos` `{ sesionId, monto, fecha, metodo: 'qr' \| 'transferencia', referencia? }` → 200 `{ pago, reutilizado }` | Un pago por sesión. Repetir los mismos datos devuelve el mismo pago con `reutilizado: true`; otros datos, 409. |
| FE-82 | `GET /api/carpetas/:id/historial` → `{ carpeta, contexto, constancia, diagnostico, sesiones[{ …, tareas }] }` | Sin montos. Los pagos se piden aparte (solo administración). |
| FE-92 | `GET /api/indicadores?desde&hasta` → `{ periodo, casosActuales, casosPorEstado, sesiones, pagosRecibidos }` | Solo administración. 400 si `desde > hasta`. |

Pendientes detectados al integrar (para backend):

1. `GET /constancia` devuelve `fechaConsentimiento` sin formatear (timestamp); `PUT` e historial la devuelven bien.
   Conviene usar `to_char(fecha_consentimiento, 'YYYY-MM-DD')` también en la consulta.
2. Sesiones, tareas, diagnóstico, constancia y pagos devuelven solo el UUID de quien registró o actualizó. La interfaz
   muestra el nombre cuando lo conoce (la propia cuenta, la terapeuta asignada, quien creó la carpeta) y, si no,
   "otra cuenta del personal". Devolver `{ id, nombreCompleto }`, como en `GET /carpetas/:id`, lo resolvería.
3. FE-61 pide juzgado y detalles judiciales, pero no hay endpoint para escribir `contexto_judicial`. El historial
   lo muestra si existe; la interfaz todavía no lo puede registrar.

## ⚠️ Edición `PATCH /api/carpetas/:id` (FE-52)

La ruta está implementada y recibe `nombreCompleto` y `fechaIngreso`, pero su
controlador construye la respuesta con `terapeuta`, `creadoPor`, `asignadoPor` y
`asignadoEn` nulos. No demuestra que se haya eliminado la asignación persistida.
Corregir esa respuesta corresponde a FE-52; FE-34 no altera el flujo de edición.

## Evidencia FE-34 y pendientes de integración

- Evidencia conservada de la revisión anterior: 27 pruebas unitarias del backend,
  25 HTTP con DB simulada y 9 con PostgreSQL 16 real; 73 pruebas frontend. Ambas
  compilaciones y lint frontend aprobados. Auth fue simulado, no Supabase real.
- PostgreSQL se probó en una base nueva desechable con migraciones 001 y 002. Se
  observaron dos conexiones esperando bloqueo en el INSERT; se verificaron unicidad,
  vínculos, conflictos manuales y rollback, incluida la preparación de la respuesta.
- El cierre añade comprobaciones enfocadas de conexión transaccional y de POST 201
  seguido de fallo de red/500 en GET, recuperando el mismo detalle sin otro POST.
- Verificaciones de cierre ejecutadas: `node --test test/altas.test.mjs` en backend,
  25 aprobadas; pruebas de `PaginaNuevaCarpeta.test.tsx` y
  `FormularioEditarPaciente.test.tsx` en frontend, 15 aprobadas; lint y build
  frontend aprobados. No se repitió la batería PostgreSQL porque no cambió su código
  ni la implementación transaccional ya verificada. `git diff --check` y la revisión
  de los cambios propios contra `origin/main` no detectaron errores.
- Comprobación manual desde navegador con Supabase QA real: pendiente. No se dispone
  en este cierre de credenciales QA ni de navegador conectado. No se usaron datos
  clínicos reales, contraseñas o tokens en las evidencias.
- En el cierre de FE-34 el listado `GET /api/carpetas` quedaba pendiente de FE-40;
  ahora está implementado según la sección FE-40 de este contrato.
  Para comprobar el alta manualmente, entrar como administrador y abrir directamente
  `/carpetas/nueva`, registrar datos ficticios y verificar la navegación al detalle.
- `PATCH /api/carpetas/:id` y su respuesta de asignación siguen siendo dependencia
  de FE-52. No confundir ese resultado con el detalle GET de FE-37.

---

## Hallazgos históricos de la base de datos y seguimiento

| Hallazgo | Afecta a | Propuesta |
| --- | --- | --- |
| `pg` devuelve las columnas `date` como `"2026-10-11T04:00:00.000Z"` | Fechas de FE-31 y FE-39 | `pg.types.setTypeParser(1082, (v) => v)` en `DatabaseService` |
| Buscar "gutierrez" no encuentra "Gutiérrez" | FE-16 / FE-40 | Extensión `unaccent` |
| La 001 permitía 2 terapeutas por caso | FE-35 / FE-37 | La 002 actual añade índice único por caso |
| La base por sí sola no impone que el asignado sea terapeuta | FE-35 / FE-37 | AsignacionesService valida rol y estado activo |
| Si `app.usuario_id` no es un perfil, **toda** escritura falla (FK de `auditoria`) | Todo | Pasar siempre el id del perfil autenticado |
| `perfiles` no tiene correo | FE-10 | Unir con `auth.users` |
| No hay datos de prueba en el repo | FE-42 / FE-45 | Script con cuentas (Auth + perfiles) y carpetas |

El índice sugerido históricamente ya forma parte de la migración 002. `unaccent`
se incorpora con la migración 003 de FE-40, sin modificar la 002:

```sql
create unique index uq_asignacion_un_responsable on public.asignaciones_caso (caso_id);
create extension if not exists unaccent with schema extensions;
```

## Evidencia FE-40

- Rama `feature/FE-40-listado-carpetas`, base `14f0b54` de `origin/main`, que ya
  contiene FE-34 (`894ef923e36d9fe1cbd3a03583f992da69ce58f7`). Jira no respondió;
  se utilizó el contrato del repositorio. FE-52 permanece fuera de este cambio.
- `npm.cmd run build` en backend: aprobado. No hay script de lint backend configurado.
- `npm.cmd run test:unit`: 27 aprobadas. `node --test test/altas.test.mjs`: 25 aprobadas
  con base simulada, para conservar el alta y la infraestructura HTTP existente.
- `node --test test/concurrencia-postgres.test.mjs`: 9 aprobadas con PostgreSQL
  desechable y migraciones 001–003; se conserva el alta y se observaron dos INSERT
  esperando bloqueo real. Auth simulado. `git diff --check`: aprobado.
- `node --test test/listado-carpetas-postgres.test.mjs`: 12 aprobadas, cero omitidas,
  con `FE40_PG_QA=1` y `FE40_PG_ADMIN_URL` apuntando a la base local `fe40_qa`.
  Se creó otra base exclusiva por ejecución, se aplicaron 001–003 y se eliminó al
  finalizar. PostgreSQL 16.15 real, NestJS real, Auth simulado y datos ficticios.
- Casos cubiertos: administrador, dos terapeutas, marketing, 401/403, total filtrado
  antes de paginar, reasignación, tildes/mayúsculas, número exacto en ambas series,
  ceros iniciales/números enormes, no asignadas, borrados, vacíos, orden con empates,
  páginas extremas, parámetros inválidos/repetidos y consultas de inyección literales.
- El frontend existente consume el contrato sin cambios; no se repitió su batería
  porque no se modificaron sus archivos ni su simulador.
- Ejecución QA reproducible: preparar PostgreSQL local desechable con base `fe40_qa`,
  definir `FE40_PG_QA=1` y `FE40_PG_ADMIN_URL` solo en el entorno de la terminal,
  compilar backend y ejecutar el archivo anterior. Requiere permiso de creación de
  bases y extensiones. No usa `DATABASE_URL`, no carga `.env` ni toca bases compartidas.
- Pendiente manual: aplicar migraciones en QA autorizado, iniciar backend y frontend
  con su configuración QA y API real (no `dev:simulado`), entrar en `/carpetas` como
  administrador, buscar por nombre sin tildes y por número, paginar y abrir un detalle.
  Repetir como dos terapeutas con asignaciones distintas y comprobar marketing 403
  en API. No se afirma verificación con Supabase Auth real ni navegador.

## Evidencia FE-46

Demostración integrada en navegador con frontend real, backend de `main` y PostgreSQL 16 con 001–003:
25 comprobaciones aprobadas (cuentas, alta, duplicados, asignación, búsqueda y permisos por rol).
Auth fue un Supabase de prueba local. Detalle, incidencias corregidas y guion en
`docs/pruebas/FE-46-demostracion-integrada.md`.

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

`POST /api/auth/logout` → devuelve 204 cuando Supabase confirma el cierre de la sesión actual (scope=local) y el backend registra la auditoría. Si Supabase devuelve una respuesta inesperada, falla la comunicación o vence el plazo, la API responde 502, 503 o 504, respectivamente. En esos casos el frontend conserva el cierre local y avisa que la revocación remota quedó sin confirmar. La vigencia del access token y el comportamiento del refresh token se comprueban por separado en Supabase de QA.

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
| FE-67 | `PUT /api/carpetas/:id/diagnostico` `{ fecha, evaluacionInicial, diagnosticoIngreso?, hipotesisRelacional?, comentariosClinicos? }` | Crea o actualiza la ficha única y conserva claves adicionales del JSON; conserva `id`, `creadoPor` y `creadoEn`. |
| FE-62 | `GET /api/carpetas/:id/constancia` → `{ constancia \| null }` | Incluye `contextoJudicial` (o `null`). Fechas en `AAAA-MM-DD` desde el commit 8c77aa3. |
| FE-62 | `PUT /api/carpetas/:id/constancia` `{ procedencia?, origenJudicial, estado, fechaConsentimiento?, referenciaEvidencia?, explicacion?, contextoJudicial? }` | `pendiente`: sin fecha, evidencia ni explicación. `registrado`: fecha y evidencia. `no_aplica`: explicación. `origenJudicial: true` exige `contextoJudicial` con `juzgado` (`nroExpediente`, `fechaDerivacion` y `observaciones` opcionales); `false` lo rechaza y borra el guardado. |
| FE-87 | `GET /api/carpetas/:id/pagos` → `{ pagos }` | Solo administración (403 para terapeutas). `monto` es texto decimal con punto. |
| FE-87 | `POST /api/carpetas/:id/pagos` `{ sesionId, monto, fecha, metodo: 'qr' \| 'transferencia', referencia? }` → 200 `{ pago, reutilizado }` | Un pago por sesión. Repetir los mismos datos devuelve el mismo pago con `reutilizado: true`; otros datos, 409. |
| FE-82 | `GET /api/carpetas/:id/historial` → `{ carpeta, contexto, constancia, diagnostico, sesiones[{ …, tareas }] }` | Sin montos. Los pagos se piden aparte (solo administración). |
| FE-92 | `GET /api/indicadores?desde&hasta` → `{ periodo, casosActuales, casosPorEstado, sesiones, pagosRecibidos }` | Solo administración. 400 si `desde > hasta`. |

Pendientes detectados al integrar (para backend):

1. ✅ Resuelto en 8c77aa3: `GET /constancia` devolvía `fechaConsentimiento` como timestamp.
2. Sesiones, tareas, diagnóstico, constancia y pagos devuelven solo el UUID de quien registró o actualizó. La interfaz
   muestra el nombre cuando lo conoce (la propia cuenta, la terapeuta asignada, quien creó la carpeta) y, si no,
   "otra cuenta del personal". Devolver `{ id, nombreCompleto }`, como en `GET /carpetas/:id`, lo resolvería.
3. ✅ Resuelto en 8c77aa3: el contexto judicial de FE-61 se guarda con la constancia y la interfaz ya lo registra.

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

## Residencia del paciente (FE-136)

- El alta de un paciente y la edición administrativa admiten
  `ciudadResidencia` (`la_paz`, `el_alto`, `otra` o `null`) y `otraLocalidad`.
  `otra` requiere una localidad. En la edición, omitir ambos campos conserva
  la residencia y enviar `ciudadResidencia: null` la limpia.
- El listado y el detalle de carpetas devuelven ambos campos dentro de `paciente`.
- `GET /api/carpetas` admite `residencia=la_paz|el_alto|otra|sin_registrar`.
  El filtro se combina con permisos y demás filtros antes de contar y paginar.
- `GET /api/indicadores/por-residencia?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`
  es exclusivo de administración. Devuelve `periodo` y `porResidencia`, con
  casos actuales, estados, sesiones y pagos en BOB para cada grupo.

## Exportación a PDF y Word (FE-159)

| Método y ruta | Resultado |
| --- | --- |
| `POST /api/carpetas/:casoId/exportaciones` | Genera el archivo y devuelve `201` con `{ "exportacionId": "..." }`. |
| `GET /api/carpetas/:casoId/exportaciones/:exportacionId/archivo` | Descarga el PDF o DOCX después de volver a comprobar el acceso y verificar la integridad del archivo. |

El POST recibe `documento` (`informe`, `ficha` o `historial`) y `formato`
(`pdf` o `docx`). Para un informe requiere `informeVersionId` de una versión
revisada del mismo caso. La ficha y el historial admiten `secciones`.
`incluirPagos` solo se admite para administración y en el historial.

El backend guarda los archivos fuera del directorio público, en la ruta
absoluta configurada con `EXPORTACIONES_DIR` (vacía: `backend/almacenamiento/exportaciones`,
ignorada por Git). En un despliegue, esa ruta debe apuntar a almacenamiento
persistente y privado; los respaldos de la base no incluyen estos archivos. Si falla la escritura,
la API devuelve `500` y registra la exportación como fallida.

La ficha y el historial admiten `incluirGenograma: true` para adjuntar su representación
visual. Un informe revisado conserva la selección y la clave del archivo de su fotografía:
no admite cambiar opciones al exportar ni tomar silenciosamente el genograma vigente.
El backend comprueba caso, acceso, tipo y SHA-256 antes de leer esa versión privada.
PNG/JPEG se normalizan a PNG; un PDF legible de hasta 20 páginas se inserta completo,
una página por anexo, manteniendo proporción. El texto y las tablas de DOCX siguen siendo
editables; el genograma es una imagen. Si no existe genograma, se conserva la ausencia
registrada; si el archivo no puede leerse/renderizarse, la exportación queda fallida y no
se entrega un archivo vacío. Se limita la imagen de entrada a 25 millones de píxeles y la
representación a un lado máximo de 3000 píxeles por página. La carga del genograma
mantiene sus límites de tamaño existentes.

## Importación histórica (FE-164)

Solo administración puede usar estas rutas.

| Método y ruta | Operación |
| --- | --- |
| `POST /api/importaciones` | Recibe `archivo` y, opcionalmente, `origen` en `multipart/form-data`. Devuelve `201` con la vista previa. |
| `GET /api/importaciones/:id` | Consulta el estado, la versión, el resumen y las filas del lote. |
| `PATCH /api/importaciones/:id/filas/:numeroFila/datos` | Recibe `version` y `datos`. Corrige las columnas enviadas y reclasifica el lote. |
| `PATCH /api/importaciones/:id/filas/:numeroFila` | Recibe `version` y `decision` (`crear`, `vincular` o `excluir`). Para vincular se envía un único destino. |
| `POST /api/importaciones/:id/confirmar` | Recibe `version` y, opcionalmente, `aceptaAvanceContador`. Devuelve el resultado de la confirmación. |

Se admite CSV UTF-8 separado por comas o por punto y coma, o XLSX, hasta
5 MiB. El XLSX debe tener la hoja `Importacion`. La primera fila lleva
columnas de la plantilla en cualquier orden; puede traer solo una parte
(por ejemplo, el formato de FE-162) y las que faltan quedan vacías. Una
columna desconocida o repetida devuelve `400`. En el XLSX no se admiten
fórmulas; los números se leen como texto (un teléfono guardado como número
pierde los ceros iniciales: conviene guardarlo como texto) y las fechas
deben ser fechas de Excel o texto AAAA-MM-DD.

La vista previa no crea pacientes ni casos. Una versión desactualizada
devuelve `409`; las filas sin resolver o un salto de contador sin aceptar
devuelven `422`. Si los datos cambiaron al confirmar, la API puede
responder `estado: "revisar"` sin aplicar el lote. Confirmar de nuevo un
lote ya aplicado devuelve el mismo resultado sin duplicar registros.

## Ficha familiar y diagnóstico vigente (FE-126)

Estas rutas requieren una sesión autenticada. Pueden usarlas
administración y la terapeuta asignada al caso.

| Método y ruta | Resultado |
| --- | --- |
| `GET /api/carpetas/:id/familia` | Devuelve `casoId`, `pacienteId`, `registrada`, `version` y `familiares`. |
| `PUT /api/carpetas/:id/familia` | Recibe `version`, `familiares` y, opcionalmente, `eliminarIds`. Devuelve la ficha actualizada. |
| `GET /api/carpetas/:id/diagnostico/vigente` | Devuelve `origen` (`ficha`, `alta` o `sin_datos`), los campos clínicos vigentes y los datos históricos en `alta`. |

### Guardado de familia

- Una ficha sin registrar devuelve `registrada: false`, `version: null` y
  `familiares: []`. Una ficha registrada puede tener la lista vacía.
- Enviar `version: null` al crear la ficha. En una edición, enviar la
  última versión recibida. Si quedó desactualizada, la API devuelve `409`.
- Un integrante sin `id` se crea. Con `id`, se edita el integrante del
  caso. Omitir un campo opcional conserva su valor; enviar `null` lo limpia.
- Para eliminar un integrante, incluir su ID en `eliminarIds`. Dejarlo
  fuera de `familiares` conserva su registro.
- Una solicitud inválida devuelve `400` y revierte todos sus cambios.
- Una terapeuta ajena recibe `404`. Un rol sin permiso clínico recibe `403`.

Si existe una ficha de diagnóstico, sus valores `null` se conservan.
Los datos del alta quedan disponibles como antecedente. El contrato de
`GET /api/carpetas/:id/diagnostico` se mantiene.

## Genograma del caso (FE-131)

Las operaciones requieren una sesión autenticada. El servidor comprueba
que la persona sea administradora o la terapeuta asignada al caso.

| Método y ruta | Solicitud | Respuesta exitosa |
| --- | --- | --- |
| `PUT /api/carpetas/:id/genograma` | Formulario `multipart/form-data` con el campo `archivo`. | `204` sin cuerpo. |
| `GET /api/carpetas/:id/genograma` | Sin cuerpo. | `200` con `nombre`, `tipo`, `tamanio` en bytes, `autorId` y `actualizadoEn` en formato ISO 8601. |
| `GET /api/carpetas/:id/genograma/archivo` | Sin cuerpo. | `200` con el archivo como adjunto. |

La carga admite PDF, PNG y JPEG. El límite actual es de 5 MiB, pendiente
de confirmación. Una carga sin archivo devuelve `400`. Si supera el
límite devuelve `413`. Si el formato no coincide con los bytes iniciales
o no está admitido, devuelve `415`.

El servidor devuelve `404` si el caso no existe o la terapeuta no tiene
acceso. La consulta y la descarga también devuelven `404` si el caso
accesible todavía no tiene genograma.

Un reemplazo inválido conserva el archivo vigente. Tras un `204`, el
frontend puede consultar de nuevo los metadatos para refrescar la ficha.

## Borradores de informes (FE-153)

Las cuatro rutas requieren una terapeuta autenticada y asignada al caso.
`versionId` es el `id` de la versión devuelta por el POST.

| Método y ruta | Cuerpo | Respuesta |
| --- | --- | --- |
| `POST /api/carpetas/:id/informes` | `tipo` (`intervencion_sistemica` o `judicial`). Opcionales: `sesionesIds`, `incluirFamilia`, `incluirGenograma` y `objeto`. | `201` con `id`, `informeId`, `nroVersion`, `estado` y `creadoPor`. |
| `GET /api/carpetas/:id/informes` | Sin cuerpo. | `200` con `informes`: las versiones del caso, la más reciente primero, con `id`, `informeId`, `tipo`, `nroVersion`, `estado`, `creadoPor`, `creadoEn`, `revisadoPor` y `revisadoEn` (sin las secciones). |
| `GET /api/carpetas/:id/informes/:versionId` | Sin cuerpo. | `200` con las secciones, el estado y la autoría de la versión. |
| `PATCH /api/carpetas/:id/informes/:versionId/revision` | `secciones`, una lista de objetos con `titulo` y `contenido`. | `200` con `id`, `estado`, `revisadoPor` y `revisadoEn`. |

El POST devuelve `422` con `camposFaltantes` si faltan los mínimos.
Para un informe judicial, se requiere un juzgado registrado y un `objeto`.
El servidor devuelve `404` si el caso o la versión no están disponibles
para la solicitante. Una segunda revisión de la misma versión devuelve `409`.

Al revisar, se conserva la copia original de los datos del expediente.

## Publicaciones de difusión (FE-143)

| Método y ruta | Qué hace |
| --- | --- |
| `GET /api/publico/publicaciones` | Lista publicaciones visibles. Admite `tipo`, `pagina` y `tamano`. |
| `GET /api/publico/publicaciones/:id` | Devuelve una publicación visible y su imagen, si tiene. Un borrador o una publicación retirada devuelve `404`. |
| `GET /api/difusion/publicaciones` | Lista publicaciones para administración y marketing. Admite también el filtro `estado`. |
| `GET /api/difusion/publicaciones/:id` | Devuelve el detalle privado, la autoría y `imagen` (o `null`). |
| `POST /api/difusion/publicaciones` | Crea un borrador. |
| `PUT /api/difusion/publicaciones/:id` | Reemplaza los campos de contenido y conserva el estado. |
| `PATCH /api/difusion/publicaciones/:id/estado` | Recibe `{ "estado": "publicado" }`, `"retirado"` o `"borrador"` según la transición. |
| `PUT /api/difusion/publicaciones/:id/imagen` | Sube o reemplaza la imagen (ver «Imágenes del portal»). |
| `PATCH /api/difusion/publicaciones/:id/imagen` | Cambia la descripción: `{ "textoAlternativo": "…" }`. |
| `DELETE /api/difusion/publicaciones/:id/imagen` | Quita la imagen y borra el archivo. `204`; sin imagen → `404`. |
| `GET /api/difusion/publicaciones/:id/imagen/archivo` | La imagen guardada, para la vista previa (también en borrador). |

Las rutas administrativas requieren una sesión de administración o marketing.
El flujo es `borrador → publicado → retirado → borrador`. Una transición
inválida devuelve `409`. Si falta el resumen al publicar, devuelve `422`
con `camposFaltantes`. Los mínimos adicionales por tipo siguen pendientes
de ratificación.

## Imágenes del portal (024)

Una imagen por publicación o artículo. Se guarda en la base (`imagenes_publicas`, migración 024), como los
genogramas, así que entra en el respaldo `pg_dump`. No hay bucket de Storage.

- **Subir:** `PUT …/:id/imagen` en `multipart/form-data` con `archivo` (JPEG, PNG o WebP, hasta 15 MB) y
  `textoAlternativo` (1–300). El servidor reconoce el formato por los bytes, respeta la orientación de la foto, la
  reduce a 1600 px en su lado mayor, la guarda como WebP y le quita los metadatos (EXIF, ubicación GPS).
  Responde `200` con `{ id, textoAlternativo, ancho, alto, tamanoBytes }`. La imagen anterior se borra.
- **Errores** (mensajes en español, listos para mostrar): sin archivo o sin texto → `400`; más de 15 MB → `413`;
  otro formato (HEIC, SVG, GIF, PDF…) → `415`; ilegible, menos de 200 px por lado o demasiados píxeles → `422`.
- **Portal:** las respuestas públicas traen `imagen: { id, textoAlternativo, ancho, alto }` o `null`. El archivo se
  pide a `GET /api/publico/imagenes/:id` (sin sesión), que responde solo si lo que la usa está publicado; si no, `404`.
  Cabeceras: `Cache-Control: public, no-cache` con `ETag` (`304` si no cambió), `nosniff` y
  `Cross-Origin-Resource-Policy: cross-origin`.
- El frontend arma la URL con `urlImagenPublica(id)` (`frontend/src/features/publico/imagenes.ts`).

## Investigación y exportación para Atlas.ti (FE-169)

| Método y ruta | Operación |
| --- | --- |
| `GET /api/investigacion/categorias` | Consulta el catálogo y los conteos dentro del alcance del perfil. |
| `POST /api/investigacion/categorias` | Crea una categoría. Solo administración. |
| `PUT /api/investigacion/categorias/:id` | Edita o retira una categoría con `activa: false`. Solo administración. |
| `GET /api/investigacion/seleccion` | Filtra casos autorizados por categorías, período y residencia. |
| `POST /api/investigacion/casos/:casoId/etiquetas` | Etiqueta el caso o una ficha de diagnóstico o seguimiento del mismo caso. |
| `POST /api/investigacion/exportaciones` | Recibe `casosIds`, `secciones`, `formato` (`txt` o `docx`) y, opcionalmente, `desde` y `hasta`. Devuelve `exportacionId`. |
| `GET /api/investigacion/exportaciones/:id/manifiesto` | Consulta el manifiesto del paquete autorizado. |
| `GET /api/investigacion/exportaciones/:id/documentos/:codigo` | Previsualiza un documento por su código `INV-…`. |
| `GET /api/investigacion/exportaciones/:id/revision` | Devuelve el contenido a revisar, su `huella`, `revisadoEn` (o `null`) y `revisionVigente` (la revisión corresponde al contenido actual). |
| `PATCH /api/investigacion/exportaciones/:id/revision` | Recibe `{ "huella": "..." }` y confirma la revisión si el contenido coincide. Repetirla con la misma huella devuelve la revisión existente. |
| `GET /api/investigacion/exportaciones/:id/descarga` | Devuelve un ZIP con `manifiesto.json` y un archivo por caso. Requiere revisión vigente. |

Administración y terapeutas acceden según su alcance. Una terapeuta solo
puede seleccionar sus casos asignados. Marketing recibe `403`. Si el
paquete incluye un caso ajeno, se rechaza la solicitud completa con `404`.

La descarga devuelve `409` antes de la revisión o si el contenido cambió.
Si el contenido cambió después de revisarlo, el PATCH también devuelve `409`:
hay que preparar un paquete nuevo.
La migración 019 conserva la huella revisada. El ZIP se genera en memoria
al descargar.

El texto libre puede contener identificadores y requiere revisión humana.
El uso con datos reales sigue sujeto a ratificación. La prueba de
importación en Atlas.ti corresponde a FE-171.

## Evaluación inicial obligatoria y diagnóstico opcional · FE-123/FE-126

Decisión de Andrea (PO), 26/11/2026: evaluación inicial obligatoria y diagnóstico de ingreso opcional. Implementada con apoyo de Andrea en FE-126/127/128; aplicar la migración 021 antes de desplegar esta versión.

El PUT recibe `fecha`, `evaluacionInicial` (texto con contenido, hasta 10000 caracteres) y diagnóstico/hipótesis/comentarios opcionales (string hasta 10000 o null). Guardar normaliza espacios y conserva claves adicionales del JSON. Es un formulario completo: omitir o vaciar un opcional lo deja en null. La evaluación no se obtiene automáticamente de comentarios históricos.

GET de diagnóstico, GET de fuente vigente e historial devuelven `evaluacionInicial` (null para fichas antiguas). Leer una ficha antigua sigue permitido; editar solicita completar la evaluación. Familia, genograma, ID y autoría se conservan. Un diagnóstico null de una ficha vigente no se completa desde el alta.

La 021 amplía la vista y las fotografías: incluye evaluación cuando existe, sin reescribir fichas ni informes/exportaciones anteriores. Los informes nuevos usan plantilla v2. PDF, DOCX y los documentos seleccionados de investigación conservan la evaluación; la revisión de textos de investigación y sus permisos permanecen vigentes. Ver [contrato FE-123](../srs/sprint-3/FE-123-ficha-familiar-y-diagnostico.md) y [evidencia de verificación](../pruebas/sprint-3/evaluacion-inicial.md).

## Investigaciones públicas: artículos sin comentarios (FE-184)

Alcance ratificado en [FE-182](../srs/sprint-3/FE-182-investigaciones-publicas.md): artículos públicos gestionados por administración o marketing, **sin comentarios**. Base de FE-183 (migración 023). Separado de lo clínico: no lee carpetas ni expedientes.

**Gestión** (administración o marketing; terapeuta → 403; sin sesión → 401):

| Método y ruta | Cuerpo | Resultado |
| --- | --- | --- |
| `GET /api/investigaciones/articulos?estado=&pagina=&tamano=` | — | `{ articulos, total, pagina, tamano }`, cualquier estado. |
| `GET /api/investigaciones/articulos/:id` | — | Artículo completo o `404`. |
| `POST /api/investigaciones/articulos` | `{ titulo, resumen?, contenido, autorVisible? }` | `201`, siempre en `borrador`. |
| `PUT /api/investigaciones/articulos/:id` | Mismo cuerpo (formulario completo; la imagen se conserva) | `200`. Un publicado que queda sin resumen → `422` `{ camposFaltantes: ['resumen'] }`. |
| `PATCH /api/investigaciones/articulos/:id/estado` | `{ estado }` | `borrador → publicado → retirado → borrador`. Otra transición → `409`. Publicar sin resumen → `422` `{ camposFaltantes: ['resumen'] }`. |
| `DELETE /api/investigaciones/articulos/:id` | — | `204` solo si nunca se publicó; si alguna vez se publicó → `409` (se retira). |
| `PUT`, `PATCH`, `DELETE /api/investigaciones/articulos/:id/imagen` y `GET …/imagen/archivo` | — | Igual que en difusión (ver «Imágenes del portal»). |

Artículo (gestión): `{ id, titulo, resumen, contenido, estado, autorVisible, imagen, creadoPor, creadoEn, actualizadoPor, actualizadoEn, publicadoEn, publicadoPor, retiradoEn, retiradoPor }`.

- `titulo` hasta 150 y `contenido` hasta 20000, ambos obligatorios y no en blanco; `resumen` hasta 500 (obligatorio para publicar); `autorVisible` hasta 150 o `null` si no se autorizó mostrarlo.
- `imagen`: `{ id, textoAlternativo, ancho, alto, tamanoBytes }` o `null`. No va en el cuerpo de POST/PUT: enviarla → `400`.
- Estado, autoría y fechas los pone el servidor; enviarlos → `400`.

**Portal** (sin sesión):

| Método y ruta | Resultado |
| --- | --- |
| `GET /api/publico/investigaciones?pagina=&tamano=` | `{ investigaciones: [{ id, titulo, resumen, autor, fechaPublicacion, imagen }], total, pagina, tamano }`, solo publicados, del más reciente al más antiguo. |
| `GET /api/publico/investigaciones/:id` | Lo mismo más `contenido`. Borrador, retirado o inexistente → `404`. |

`fechaPublicacion` es `AAAA-MM-DD` (fecha de Bolivia) y coincide con `InvestigacionPublica` de `frontend/src/features/publico/investigaciones.ts`; `imagen` usa la misma forma que difusión (`id`, no `url`). No hay rutas de comentarios.

Pruebas: `backend/src/modules/articulos/tests/articulos.service.spec.ts` (unitarias) y `backend/test/articulos-api-postgres.test.mjs` (API con PostgreSQL y los artículos de FE-185).
## Gastos de funcionamiento (FE-174)

Solo **administración** (terapeuta y marketing → 403; sin sesión → 401). Contrato de [FE-172](../srs/sprint-3/FE-172-control-administrativo.md) sobre la base de FE-173 (migración 022). Todas las respuestas llevan `Cache-Control: private, no-store`.

| Método y ruta | Cuerpo | Resultado |
| --- | --- | --- |
| `GET /api/gastos?mes=AAAA-MM` | — | `200` `{ mes, gastos: [gasto], totalMes, cantidadVigentes, cantidadAnulados, totalesPorCategoria: [{ categoria, cantidad, total }] }`. Sin `mes`, el mes actual en Bolivia. `mes` con otro formato → `400`. |
| `POST /api/gastos` | `{ categoria, fecha, monto, descripcion? }` | `201` con el gasto. |
| `PATCH /api/gastos/:id` | Los mismos cuatro campos (formulario completo) | `200` con el gasto corregido; `404` si no existe o no es un gasto; `409` si está anulado. |
| `POST /api/gastos/:id/anular` | `{ motivo? }` (hasta 200) | `200` con el gasto anulado. Repetir devuelve el mismo gasto sin volver a restar; `404` si no existe. |

Gasto: `{ id, fecha, categoria, descripcion, monto, anulado, anuladoEn, anuladoPor, motivoAnulacion, registradoPor, creadoEn, actualizadoPor, actualizadoEn }`.

- `categoria`: `internet` (Internet / Wi-Fi), `electricidad`, `alquiler`, `otros` (Otros gastos). Se permiten varios por categoría y mes.
- `fecha`: `AAAA-MM-DD`, válida, no futura (hora de Bolivia) y desde 2000. El mes del total sale de esta fecha: corregirla a otro mes mueve el gasto entre totales.
- `monto`: **texto** decimal en Bs con punto, positivo, hasta 8 enteros y 2 decimales (`"120.00"`, `"1500"`). Un número JSON, una coma o un tercer decimal → `400`; no se redondea. Las respuestas devuelven siempre dos decimales.
- `descripcion`: opcional (omitir o enviar `null`), hasta 200 caracteres. Si se envía texto, debe contener caracteres distintos de espacios; vacío o en blanco devuelve `400`. El servicio recorta el texto válido. **Obligatoria para `otros`.**
- Autoría, fechas de auditoría, tipo de movimiento y anulación los pone el servidor; enviarlos → `400`.
- Los anulados aparecen en `gastos` con `anulado: true`, pero no suman en `totalMes` ni en `totalesPorCategoria`. Las cuatro categorías aparecen siempre, aunque sea en `0.00`.
- Ejemplo de aceptación (FE-172 §5): internet 120.00 + electricidad 80.00 + alquiler 1500.00 = `1700.00`; corregir electricidad a 85.00 → `1705.00`; anular internet → `1585.00`.

Pruebas: `backend/src/modules/gastos/tests/gastos.service.spec.ts` (unitarias) y `backend/test/gastos-api-postgres.test.mjs` (API con PostgreSQL).

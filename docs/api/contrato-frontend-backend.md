# Contrato frontend ↔ backend · Sprint 1

Qué usa el frontend (`frontend/`) de cada endpoint del backend (`backend/`). Lo implementado se documenta
tal como está en el código; lo pendiente es la propuesta que el frontend ya sabe usar. Si el backend cambia
algo, actualicen este archivo y el `tipos.ts` correspondiente del frontend en el mismo PR.

| Endpoint | Backend (Jira) | Frontend (Jira) | Estado |
| --- | --- | --- | --- |
| `POST /api/auth/login` | FE-22 | FE-21 | ✅ conectado y probado de punta a punta |
| `POST /api/auth/refresh` | FE-22 | sesión | ✅ conectado y probado |
| `POST /api/auth/logout` | FE-26 | FE-24 / FE-25 | ✅ conectado y probado |
| `GET /api/auth/me` | FE-22 | — | ✅ existe (el frontend no lo necesita) |
| `GET /api/usuarios` | FE-29 | FE-28 | ✅ conectado y probado |
| `POST /api/usuarios` | FE-29 | FE-28 | ✅ conectado y probado |
| `PATCH /api/usuarios/:id` | FE-29 | FE-28 (activar / desactivar) | ✅ conectado y probado |
| `POST /api/casos` | FE-32 | FE-31 | ✅ conectado y probado |
| `GET /api/casos` | FE-32 | FE-39 | ✅ conectado y probado |
| `GET /api/casos/:id` | FE-32 | FE-31, FE-36 | ✅ conectado y probado |
| `PUT /api/casos/:id/terapeuta` | FE-37 | FE-36 | ⏳ pendiente en el backend |
| Acceso de terapeutas a sus casos | FE-37 | FE-39, FE-36 | ⏳ pendiente (hoy `/casos` es solo administración) |

"Probado de punta a punta": el backend NestJS real compilado, con la migración 001 en PostgreSQL y un Supabase
Auth de prueba (incluida la Admin API), recorrido desde el navegador con `npm run dev`.

## Reglas generales (las del backend)

- Prefijo `/api`. JSON con claves en camelCase.
- `AuthGuard` global: todo exige `Authorization: Bearer <accessToken>` salvo `@Public()`.
  Después corre `RolesGuard`: `@Roles('administrador')` responde **403** `No tienes permiso para realizar esta acción`.
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`: un campo que el DTO no declara → **400**.
  El frontend no envía campos vacíos.
- Errores con el formato de NestJS: `{ "statusCode": 400, "message": "texto" | ["textos"], "error": "Bad Request" }`.
- **401** → el frontend intenta **una** renovación con `/auth/refresh`; si falla, cierra la sesión y vuelve al login.
- **403** → el frontend muestra un aviso y no cierra la sesión.
- **404 `Cannot PUT /api/…`** (la ruta no existe) → el frontend dice "todavía no está disponible en el servidor".
- Fechas sin hora: `"AAAA-MM-DD"` (el backend usa `to_char`). Momentos: ISO 8601.

---

## ✅ Autenticación (`backend/src/modules/auth`)

`POST /api/auth/login` · `@Public()` → `{ "email": "…", "password": "…" }`

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 3600,
  "usuario": { "id": "uuid", "nombreCompleto": "Laura Quiroga", "rol": "administrador" }
}
```

| Caso | Respuesta | Qué muestra el frontend |
| --- | --- | --- |
| Correo con formato inválido | 400 | Mensaje genérico (el formulario ya lo valida antes) |
| Credenciales incorrectas | 401 `Correo o contraseña incorrectos` | Mensaje genérico |
| Sin perfil o `activo = false` | 403 `Tu usuario no tiene acceso al sistema` | **El mismo** mensaje genérico (FE-20) |
| Demasiados intentos | 429 | "Hubo demasiados intentos…" |
| Supabase caído | 503 | "El servicio de inicio de sesión no responde…" |

`POST /api/auth/refresh` · `@Public()` → `{ "refreshToken": "…" }` → misma respuesta; 401 si ya no sirve.
`POST /api/auth/logout` → 204; el refresh token anterior deja de servir.

**Observación para FE-22:** si el perfil está inactivo, `login` lanza 403 **después** de abrir la sesión en
Supabase, y esa sesión queda abierta. Conviene llamar a `supabase.cerrarSesion(sesion.access_token)` antes del 403.

---

## ✅ Usuarios (`backend/src/modules/usuarios`) · solo `administrador`

`GET /api/usuarios` → **lista** (sin envoltorio), ordenada por fecha de creación. El frontend la ordena por nombre
y, para la asignación, filtra `rol === 'terapeuta' && activo`.

```json
[{ "id": "uuid", "email": "sofia@fundacion.org", "nombreCompleto": "Sofía Mamani", "rol": "terapeuta", "activo": true, "creadoEn": "2026-10-06T14:00:00.000Z" }]
```

`POST /api/usuarios` → 201 con el usuario.

```json
{ "email": "ana@fundacion.org", "password": "Bienestar2026", "nombreCompleto": "Ana Pérez", "rol": "terapeuta" }
```

- `password` de **10 a 72** caracteres (el frontend además pide letras y números y ofrece generar una).
- **409** `Ya existe un usuario con ese correo` → el frontend lo marca en el campo Correo.
- **400** `La contraseña es demasiado débil` (Supabase) u otros → el frontend muestra el mensaje del servidor.

`PATCH /api/usuarios/:id` → `{ "nombreCompleto"?, "rol"?, "activo"? }` → 200 con el usuario.
El frontend lo usa para **Activar / Desactivar** y no ofrece el botón en la propia cuenta
(el backend igual lo impide con 400).

---

## ✅ Casos / carpetas (`backend/src/modules/casos`) · solo `administrador`

En la interfaz se llaman "carpetas"; las rutas del frontend siguen siendo `/carpetas…`.

### `POST /api/casos` — registro integral (FE-31 ↔ FE-32)

```json
{
  "paciente": { "nombreCompleto": "Rosa Apaza Limachi", "fechaNacimiento": "2012-04-15", "telefono": "77263336" },
  "caso": { "tipo": "derivado", "fechaIngreso": "2026-10-14", "diagnosticoIngreso": "…" },
  "contextoJudicial": { "juzgado": "Juzgado Público de Familia 3.º", "nroExpediente": "EXP-2026-118", "fechaDerivacion": "2026-10-01", "observaciones": "…" }
}
```

- Obligatorio: `paciente.nombreCompleto` y `caso.tipo`. `contextoJudicial` solo si es derivado (si no, 400).
- Fechas no futuras y nacimiento ≤ ingreso: el frontend lo valida antes, el backend también.
- **201**: la carpeta (forma de `GET /api/casos/:id`) **más** `posiblesDuplicados`:
  `[{ "pacienteId", "nombreCompleto", "similitud": 0.76 }]` (pg_trgm > 0.6). **No bloquea**: el frontend abre
  la carpeta y muestra un aviso con enlaces para buscar a esas personas.

### `GET /api/casos` — búsqueda (FE-39 ↔ FE-32)

`?q=&tipo=&estado=&limite=10&desplazamiento=0` → `{ "datos": [ … ], "total": 14, "limite": 10, "desplazamiento": 0 }`

Cada fila: `{ id, tipo, numeroCorrelativo, estado, fechaIngreso, paciente: { id, nombreCompleto } }`.
El frontend pagina de 10 en 10 (`desplazamiento = (página − 1) × 10`) y guarda búsqueda y filtros en la URL.

### `GET /api/casos/:id`

```json
{
  "id": "uuid", "tipo": "derivado", "numeroCorrelativo": 1, "estado": "iniciado", "fechaIngreso": "2026-10-14",
  "diagnosticoIngreso": null, "hipotesisRelacional": null, "comentariosClinicos": null, "creadoEn": "…",
  "paciente": { "id": "uuid", "nombreCompleto": "…", "fechaNacimiento": "2012-04-15", "edadAlIngreso": 14, "telefono": "…" },
  "contextoJudicial": { "juzgado": "…", "nroExpediente": "…", "fechaDerivacion": null, "observaciones": null }
}
```

Id que no es UUID → 400; inexistente → 404. El frontend muestra lo mismo en ambos casos ("No encontramos esta carpeta").

---

## ⏳ Pendiente en el backend

### `PUT /api/casos/:id/terapeuta` (FE-37)

`{ "perfilId": "uuid" }` → 200 con la carpeta, que además traiga:

```json
{ "terapeuta": { "id": "uuid", "nombreCompleto": "Sofía Mamani" }, "asignadoPor": { "id": "uuid", "nombreCompleto": "Laura Quiroga" }, "asignadoEn": "2026-10-14T15:05:00.000Z" }
```

- 400 si `perfilId` no es una terapeuta activa. Una responsable por caso: borrar la asignación anterior e insertar la
  nueva en la misma `transaction()`.
- Que `GET /api/casos/:id` también devuelva `terapeuta`, `asignadoPor` y `asignadoEn` (el frontend ya los muestra si llegan).
- Hoy responde 404 `Cannot PUT …` y la pantalla dice "todavía no está disponible en el servidor".

### Acceso de terapeutas (FE-37)

Hoy `GET /api/casos` y `GET /api/casos/:id` dan **403** a una terapeuta; el frontend le muestra
"Pronto verás aquí las carpetas que la dirección te asigne". Propuesta: `@Roles('administrador', 'terapeuta')` y,
para terapeutas, filtrar en el SQL **antes de paginar** con `exists (select 1 from asignaciones_caso a where a.caso_id = c.id and a.perfil_id = $n)`.
Un caso ajeno debe responder **404**, igual que uno inexistente.

### Búsqueda (FE-40)

- **Tildes:** `position(lower(q) in lower(nombre))` no encuentra "Gutiérrez" al escribir "gutierrez" (comprobado).
  Hace falta `unaccent` (migración 002).
- **Número de carpeta:** el criterio de FE-16 pide buscar por número; hoy `q` solo busca por nombre. Propuesta: si `q`
  son solo dígitos, filtrar `c.numero_correlativo = q` (puede devolver un voluntario y un derivado con el mismo número).

---

## Hallazgos de la base de datos (migración 001 ejecutada en PostgreSQL)

| Hallazgo | Afecta a | Propuesta |
| --- | --- | --- |
| Buscar "gutierrez" no encuentra "Gutiérrez" | FE-16 / FE-40 | Extensión `unaccent` |
| Se pueden asignar 2 terapeutas al mismo caso | FE-35 / FE-37 | Índice único en `asignaciones_caso (caso_id)` |
| Se puede asignar un caso a una cuenta de marketing | FE-35 / FE-37 | Validar el rol en el backend |
| Si `app.usuario_id` no es un perfil, **toda** escritura falla (FK de `auditoria`) | Todo | Pasar siempre el id del perfil autenticado (ya se hace) |
| No hay datos de prueba en el repo | FE-42 / FE-45 | Script con cuentas (Auth + perfiles) y carpetas |

Migración 002 sugerida:

```sql
create unique index uq_asignacion_un_responsable on public.asignaciones_caso (caso_id);
create extension if not exists unaccent with schema extensions;
```

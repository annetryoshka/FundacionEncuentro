# Contrato frontend ↔ backend · Sprint 1

Qué espera el frontend (`frontend/`) de cada endpoint del backend (`backend/`). Lo que ya existe se
documenta tal como está implementado; lo pendiente es la propuesta que el frontend ya usa. Si el backend
necesita cambiar algo, actualicen este archivo y el `tipos.ts` correspondiente del frontend en el mismo PR.

| Endpoint | Backend (Jira) | Frontend (Jira) | Estado |
| --- | --- | --- | --- |
| `POST /api/auth/login` | FE-22 | FE-21 | ✅ implementado y probado de punta a punta |
| `POST /api/auth/refresh` | FE-22 | sesión | ✅ implementado y probado |
| `POST /api/auth/logout` | FE-26 | FE-24 / FE-25 | ✅ implementado y probado |
| `GET /api/auth/me` | FE-22 | — | ✅ implementado (el frontend aún no lo necesita) |
| `GET` / `POST /api/usuarios` | FE-29 | FE-28 | ⏳ pendiente |
| `POST /api/carpetas` | FE-32, FE-33 | FE-31 | ⏳ pendiente |
| `GET /api/carpetas/:id` | FE-37 | FE-31, FE-36 | ⏳ pendiente |
| `PUT /api/carpetas/:id/terapeuta` | FE-37 | FE-36 | ⏳ pendiente |
| `GET /api/carpetas` | FE-40 | FE-39 | ⏳ pendiente |

"Probado de punta a punta": el backend NestJS real, con la migración 001 en PostgreSQL y un Supabase Auth de
prueba, recorrido desde el navegador con el frontend en `npm run dev`.

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

## Permisos esperados en los endpoints pendientes

| | `administrador` | `terapeuta` | `marketing` |
| --- | --- | --- | --- |
| Listar / crear cuentas | ✅ | 403 | 403 |
| Listar / buscar carpetas | todas | solo asignadas | 403 |
| Ver una carpeta | todas | solo asignadas (si no, 404) | 403 |
| Registrar paciente | ✅ | 403 | 403 |
| Asignar terapeuta | ✅ | 403 | 403 |

Hace falta un guard o decorador de roles (p. ej. `@Roles('administrador')`), que hoy no existe.

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

`POST /api/auth/logout` → 204. Después, el refresh token anterior responde 401 (comprobado).

`GET /api/auth/me` → `{ id, nombreCompleto, rol }`.

**Observación para FE-22:** si el perfil está inactivo, `login` lanza 403 **después** de abrir la sesión en
Supabase, y esa sesión queda abierta. Conviene llamar a `supabase.cerrarSesion(sesion.access_token)` antes del 403.

---

## ⏳ `GET /api/usuarios` (FE-29)

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

## ⏳ `POST /api/usuarios` (FE-29)

```json
{ "nombreCompleto": "Ana Pérez", "email": "ana@fundacion.org", "rol": "terapeuta", "password": "Segura123" }
```

Se usan `email` y `password`, igual que en el login.

- `rol`: `administrador` | `terapeuta` | `marketing`. `password`: 8+ caracteres, con letras y números.
- **201**: el usuario creado, con la misma forma que en el listado. **400** campos inválidos.
  **409** correo ya registrado: Supabase responde 422 `email_exists` y hay que traducirlo a 409.
- Implementación sugerida: Admin API de Supabase (`POST {SUPABASE_URL}/auth/v1/admin/users` con la
  `SUPABASE_SERVICE_ROLE_KEY`, `email_confirm: true`) y luego `insert into perfiles` dentro de `transaction()`.
  Si falla el insert, borrar el usuario de Auth.

## ⏳ `GET /api/carpetas` (FE-40)

`?busqueda=&pagina=1&tamano=10`

- Solo dígitos → número de carpeta exacto (puede salir uno voluntario y uno derivado con el mismo número).
- Texto → nombre del paciente, sin distinguir tildes ni mayúsculas. **`ilike` solo no basta** (comprobado):
  hace falta `unaccent` (ver migración 002).
- Filtro por asignación **en el SQL, antes de paginar**. Excluir `deleted_at is not null`.

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

## ⏳ `POST /api/carpetas` (FE-32, FE-33)

```json
{ "nombreCompleto": "Rosa Apaza Limachi", "fechaIngreso": "2026-10-11", "tipo": "voluntario" }
```

- `tipo` (`voluntario` | `derivado`) es obligatorio porque `casos.tipo` es `not null` y define la secuencia del número.
- `fechaIngreso` no puede ser futura. **La BD la acepta** (comprobado), así que hay que validarla en el DTO.
- `pacientes` + `casos` en **una** transacción. El número lo asigna el trigger `asignar_numero_caso`; un alta fallida
  no consume número (comprobado).
- **201**: la carpeta con la forma de `GET /api/carpetas/:id`.
- **409** si ya existe un paciente con el mismo nombre (puede usarse `v_posibles_duplicados` o `similarity`):

```json
{
  "statusCode": 409,
  "message": "Posible paciente duplicado",
  "posiblesDuplicados": [{ "id": "uuid del caso", "numero": 1, "tipo": "voluntario", "nombreCompleto": "Mariana Gutiérrez Paz" }]
}
```

## ⏳ `GET /api/carpetas/:id` (FE-37)

Una fila del listado más:

```json
{
  "creadoPor": { "id": "uuid", "nombreCompleto": "Laura Quiroga" },
  "creadoEn": "2026-10-11T15:00:00.000Z",
  "asignadoPor": { "id": "uuid", "nombreCompleto": "Laura Quiroga" },
  "asignadoEn": "2026-10-11T15:05:00.000Z"
}
```

## ⏳ `PUT /api/carpetas/:id/terapeuta` (FE-37)

`{ "perfilId": "uuid" }` → 200 con la carpeta actualizada. 400 si no es una terapeuta activa.
Una responsable por caso: borrar la asignación anterior e insertar la nueva en la misma transacción.
La terapeuta anterior recibe 404 en su siguiente petición a ese caso.

---

## Hallazgos de la base de datos (migración 001 ejecutada en PostgreSQL)

| Hallazgo | Afecta a | Propuesta |
| --- | --- | --- |
| `pg` devuelve las columnas `date` como `"2026-10-11T04:00:00.000Z"` | Fechas de FE-31 y FE-39 | `pg.types.setTypeParser(1082, (v) => v)` en `DatabaseService` |
| Buscar "gutierrez" no encuentra "Gutiérrez" | FE-16 / FE-40 | Extensión `unaccent` |
| Se pueden asignar 2 terapeutas al mismo caso | FE-35 | Índice único en `asignaciones_caso (caso_id)` |
| Se puede asignar un caso a una cuenta de marketing | FE-35 | Validar el rol en el backend |
| Si `app.usuario_id` no es un perfil, **toda** escritura falla (FK de `auditoria`) | Todo | Pasar siempre el id del perfil autenticado |
| `perfiles` no tiene correo | FE-10 | Unir con `auth.users` |
| No hay datos de prueba en el repo | FE-42 / FE-45 | Script con cuentas (Auth + perfiles) y carpetas |

Migración 002 sugerida:

```sql
create unique index uq_asignacion_un_responsable on public.asignaciones_caso (caso_id);
create extension if not exists unaccent with schema extensions;
```

# FE-46 — Verificar demostración integrada

## Qué se probó

Recorrido de punta a punta del Sprint 1 con el **frontend real** (`npm run dev`, sin `dev:simulado`)
contra el **backend real** de `main` (NestJS compilado) y **PostgreSQL 16.15** con las migraciones
001, 002 y 003 aplicadas en una base nueva y desechable. Datos ficticios únicamente.

Base: `origin/main` en `a4756ec` (incluye FE-34, FE-37, FE-38, FE-40, FE-41, FE-52 y FE-53) más
los cambios de esta rama.

**Limitación:** Supabase Auth fue un servidor de prueba local que implementa los mismos endpoints que usa
el backend (`/auth/v1/token`, `/auth/v1/user`, `/auth/v1/logout`, `/auth/v1/admin/users`). No se
usó el proyecto Supabase real ni sus credenciales. Antes de la demo con el cliente, repetir el guion de
abajo con Supabase QA real.

## Resultados (navegador Chromium, 1366×860)

| # | Paso | Historia / subtarea | Resultado |
| --- | --- | --- | --- |
| 1 | Login de administración | FE-20 / FE-21 | ✅ |
| 2 | Listado de cuentas desde `GET /api/usuarios` | FE-10 / FE-28 | ✅ |
| 3 | Contraseña de 9 caracteres: el formulario la frena antes de enviar | FE-28 | ✅ (antes de esta rama: ❌, ver incidencias) |
| 4 | Alta de cuenta de terapeuta | FE-28 / FE-29 | ✅ 201 |
| 5 | Correo repetido (en mayúsculas) → mensaje en el campo | FE-28 | ✅ 409 |
| 6 | Nombre vacío no se envía | FE-31 | ✅ |
| 7 | Alta de paciente → muestra el número asignado (Nº 1) | FE-11 / FE-31 | ✅ |
| 8 | Recargar conserva la carpeta | FE-31 | ✅ |
| 9 | Segunda alta voluntaria → Nº 2 | FE-11 | ✅ |
| 10 | Nombre parecido → advertencia con el nombre y enlace para buscarlo | FE-11 | ✅ (antes: aviso genérico) |
| 11 | La asignación solo ofrece terapeutas activas | FE-36 | ✅ |
| 12 | Asignar → confirmación y responsable real con fecha | FE-36 / FE-37 | ✅ |
| 13 | Listado de 5 carpetas | FE-39 / FE-40 | ✅ |
| 14 | "gutierrez" (sin tilde) encuentra "Gutiérrez" | FE-39 / FE-40 | ✅ 2 resultados |
| 15 | Búsqueda por número exacto ("1") | FE-39 / FE-40 | ✅ voluntario y derivado Nº 1 |
| 16 | Sin coincidencias → mensaje | FE-39 | ✅ |
| 17 | La terapeuta solo ve su carpeta asignada | FE-35 | ✅ |
| 18 | La terapeuta no ve "Cuentas del personal" | FE-10 | ✅ |
| 19 | Otra terapeuta abre la URL de un caso ajeno → "No encontramos esta carpeta" | FE-35 | ✅ 404 |
| 20 | Sustituir responsable → aviso | FE-36 | ✅ |
| 21 | La terapeuta anterior pierde el acceso en su siguiente solicitud | FE-35 | ✅ 404 |
| 22 | Marketing no tiene menú Carpetas | FE-35 | ✅ |
| 23 | Marketing abre `/carpetas` por URL → sin datos clínicos | FE-35 | ✅ |
| 24 | `/carpetas/nueva`, `/carpetas` y `/usuarios` a 390 px sin scroll horizontal | FE-31 | ✅ |

25 comprobaciones automáticas en el navegador, 0 errores de JavaScript en la página.
Los permisos se comprueban en el backend: los pasos 19, 21 y 23 reciben 403/404 de la API, no solo
un menú oculto.

Pruebas automatizadas en esta rama: frontend 81/81 (Vitest), lint sin avisos, build correcto;
backend 47/47 unitarias y 25 de integración aprobadas (las 30 de PostgreSQL se omiten sin
`FE40_PG_QA`).

## Incidencias encontradas y corregidas en esta rama

1. **Política de contraseña distinta (FE-28 ↔ FE-29).** El frontend aceptaba 8 caracteres y el backend
   exige de 10 a 72 (`CrearUsuarioDto`). Una contraseña de 8 o 9 llegaba al servidor y volvía con
   "El servidor rechazó los datos" sin decir por qué. Ahora el formulario valida 10–72, la ayuda lo
   dice y, si el servidor rechaza algo, se muestra su mensaje.
2. **Advertencia de duplicados poco útil (FE-11).** Decía "se encontraron pacientes con nombres
   similares" sin decir cuáles. Ahora lista los nombres con su porcentaje de parecido y enlaza a la
   búsqueda por ese nombre (no a `/carpetas/:id`, porque el backend devuelve ids de pacientes).
3. **Panel de marca del login** centrado, como pidió el equipo.

## Pendientes conocidos (no bloquean el Sprint 1)

- Repetir este guion con Supabase Auth real del proyecto (no disponible en esta verificación).
- `PATCH /api/carpetas/:id` (FE-52) sigue devolviendo la asignación en `null` en su respuesta, como
  ya documenta el contrato.

## Guion de demo (5 minutos)

1. Entrar como administración.
2. Cuentas del personal: crear una terapeuta (contraseña de 10+ caracteres).
3. Registrar paciente → mostrar el Nº de carpeta. Registrar otro con nombre casi igual → advertencia.
4. En la carpeta, asignar la terapeuta → confirmación con fecha.
5. Carpetas: buscar sin tilde y por número.
6. Cerrar sesión, entrar como la terapeuta → solo ve su carpeta.
7. Cerrar sesión, entrar como marketing → no ve información clínica.

# Fundación Encuentro · Frontend

Interfaz web del Sistema de Gestión Clínica y Administrativa (SIS-213, Grupo 7).
React 19 + Vite + TypeScript + Tailwind CSS 4, con la identidad visual de la fundación.

## Arrancar

```bash
cd frontend
npm install
npm run dev            # usa el backend real (levántalo antes: ver ../README.md)
npm run dev:simulado   # API simulada en el navegador, sin backend
```

Abre http://localhost:5173. En desarrollo, Vite reenvía `/api` a `http://localhost:3000`
(ver `vite.config.ts`), así que no hay problemas de CORS. Para cambiarlo, copia `.env.example` como `.env.local`.

## Con el backend real (`npm run dev`)

| Pantalla | Endpoint | Estado |
| --- | --- | --- |
| Iniciar sesión, mantener la sesión al recargar, cerrar sesión | `/api/auth/login`, `/refresh`, `/logout` | ✅ |
| Cuentas del personal: listar, crear, activar / desactivar | `GET`, `POST /api/usuarios`, `PATCH /api/usuarios/:id` | ✅ |
| Registrar paciente y abrir su carpeta (con contexto judicial si es derivado) | `POST /api/casos` | ✅ |
| Buscar carpetas por nombre, tipo y estado, de 10 en 10 | `GET /api/casos` | ✅ |
| Resumen de la carpeta | `GET /api/casos/:id` | ✅ |
| Asignar terapeuta | `PUT /api/casos/:id/terapeuta` | ⏳ falta en el backend (FE-37) |
| Una terapeuta ve sus carpetas | `GET /api/casos` con rol terapeuta | ⏳ hoy responde 403 (FE-37) |

Mientras falte algo, la pantalla lo dice ("todavía no está disponible en el servidor" o "Pronto verás aquí…")
en vez de romperse. El detalle de cada endpoint está en `../docs/api/contrato-frontend-backend.md`.

Para entrar hace falta una cuenta en Supabase Auth **con su fila en `perfiles` y `activo = true`**.
La primera cuenta de administración se crea a mano (ver `../README.md`); las demás, desde "Cuentas del personal".

## Modo simulado (`npm run dev:simulado`)

Una API falsa en el navegador que responde **igual que el backend real** (mismos campos, permisos y errores) con
14 carpetas ficticias. Lo único que agrega es la asignación de terapeuta, que el backend todavía no tiene.
Sirve para mostrar pantallas sin backend. Nunca entra al build de producción.

Contraseña de todas las cuentas: `Encuentro2026`

| Correo | Rol | Para probar |
| --- | --- | --- |
| `direccion@fundacion.test` | Dirección | Todo: cuentas, registrar, buscar, asignar |
| `terapeuta1@fundacion.test` | Terapeuta (Sofía) | Aviso "Pronto verás aquí tus carpetas" (igual que el backend hoy) |
| `terapeuta2@fundacion.test` | Terapeuta (Carla) | Ídem |
| `apoyo@fundacion.test` | Apoyo / marketing | Sin acceso a información clínica |
| `inactiva@fundacion.test` | Terapeuta inactiva | El login la rechaza con mensaje genérico |
| `caido@fundacion.test` | — | Simula que no hay conexión con el servidor |

## Sesión

- El `accessToken` vive solo en memoria; el `refreshToken` en `sessionStorage` de la pestaña (se borra al cerrarla).
- Al recargar, la sesión se recupera con `/auth/refresh`. El token se renueva un minuto antes de vencer,
  o al recibir un 401.
- Se cierra sola tras 30 minutos sin actividad (propuesta de FE-20, `MINUTOS_INACTIVIDAD` en `ProveedorSesion.tsx`).
- "Cerrar sesión" llama a `/auth/logout` y borra todo; el botón Atrás vuelve al login.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con el backend real |
| `npm run dev:simulado` | Servidor de desarrollo con la API simulada |
| `npm test` | Corre todas las pruebas una vez |
| `npm run lint` | Revisa el código con oxlint |
| `npm run format` | Da formato con Prettier |
| `npm run build` | Revisa tipos y genera `dist/` |

## Estructura

```
src/
  api/
    cliente.ts            fetch + token + renovación ante 401 + errores (ErrorApi)
    useCarga.ts           hook para cargar datos con estado de carga y error
    simulado/servidor.ts  API simulada (solo desarrollo y pruebas)
  componentes/
    Plantilla.tsx         cabecera con menú por rol, contenido y pie (FE-43)
    marca.tsx             logo, ondas, pie de contacto
    ui.tsx                botones, campos, avisos, insignias
    ErrorDeCarga.tsx      error al cargar (distingue "endpoint pendiente")
  features/
    auth/                 login (FE-21), sesión, rutas protegidas
    usuarios/             cuentas del personal (FE-28)
    carpetas/             búsqueda (FE-39), registro (FE-31), resumen y asignación (FE-36) con /api/casos
  paginas/                inicio, sin permiso, no encontrada
  test/montarApp.tsx      monta la app completa contra la API simulada
```

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

Funciona hoy con lo que ya tiene `backend/src/modules/auth`:

| Función | Endpoint | Estado |
| --- | --- | --- |
| Iniciar sesión | `POST /api/auth/login` | ✅ |
| Mantener la sesión al recargar y renovar el token | `POST /api/auth/refresh` | ✅ |
| Cerrar sesión | `POST /api/auth/logout` | ✅ |
| Cuentas del personal | `GET` y `POST /api/usuarios` | ⏳ falta en el backend |
| Carpetas: listado, registro, resumen y asignación | `/api/carpetas…` | ⏳ falta en el backend |

Mientras falte un endpoint, la pantalla lo dice ("todavía no está disponible en el servidor") en vez de romperse.
Lo que el frontend espera de cada endpoint pendiente está en `../docs/api/contrato-frontend-backend.md`.

Para entrar hace falta una cuenta en Supabase Auth **con su fila en `perfiles` y `activo = true`**.

## Modo simulado (`npm run dev:simulado`)

Una API falsa en el navegador: el login responde **igual que el backend real** (mismos campos y errores) y el
resto sigue el contrato, con permisos por rol y por caso y 14 carpetas ficticias. Sirve para mostrar y probar
pantallas cuyo endpoint aún no existe. Nunca entra al build de producción.

Contraseña de todas las cuentas: `Encuentro2026`

| Correo | Rol | Para probar |
| --- | --- | --- |
| `direccion@fundacion.test` | Dirección | Todo: cuentas, registrar, asignar, buscar |
| `terapeuta1@fundacion.test` | Terapeuta (Sofía) | Solo ve sus carpetas asignadas |
| `terapeuta2@fundacion.test` | Terapeuta (Carla) | Solo ve sus carpetas asignadas |
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
    carpetas/             búsqueda (FE-39), registro (FE-31), resumen y asignación (FE-36)
  paginas/                inicio, sin permiso, no encontrada
  test/montarApp.tsx      monta la app completa contra la API simulada
```

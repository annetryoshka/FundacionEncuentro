# Fundación Encuentro · API

Backend del Sistema Web de Gestión Clínica y Administrativa (SIS-213, Grupo 7).
NestJS + PostgreSQL (Supabase).

## Arrancar

1. Copia `.env.example` como `.env` y llena los valores reales.
2. `npm install`
3. `npm run start:dev`
4. Abre http://localhost:3000/api/health — debe decir `"baseDeDatos": "conectada"`.

## Estructura

- `src/config/` valida el `.env` al arrancar.
- `src/database/` conexión a la base (`DatabaseService`), disponible en todos los módulos.
- `src/health/` endpoint para comprobar que todo está vivo.
- `db/migrations/` scripts SQL versionados (001 = esquema base).

## Regla de oro para escribir datos

Toda operación que **cree, modifique o borre** datos usa `transaction(usuarioId, ...)`,
para que la tabla `auditoria` sepa quién hizo el cambio:

```ts
await this.db.transaction(usuarioId, (client) =>
  client.query('insert into pacientes (nombre_completo) values ($1)', [nombre]),
);
```

Las lecturas usan `this.db.query(...)`. Siempre con parámetros (`$1`, `$2`), nunca concatenando texto.

## Seguridad

- `.env` nunca se sube a Git (ya está en `.gitignore`).
- La llave `SUPABASE_SERVICE_ROLE_KEY` jamás va en el frontend.

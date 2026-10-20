   # Base de datos

   PostgreSQL en Supabase. Los scripts se ejecutan en orden numérico.

   | Script | Contenido |
   |---|---|
   | `migrations/001_esquema_base.sql` | Esquema base: pacientes, casos, fichas, pagos, auditoría y RLS |

   ## Cómo ejecutarlo
   1. Supabase → SQL Editor → New query
   2. Pegar el contenido del script y ejecutar con Run
   3. Revisar Advisors → Security Advisor

   ## Reglas
   - Un cambio de esquema = un script nuevo (002, 003...). No se edita uno ya ejecutado.
   - Nunca se desactiva RLS en las tablas.

## Reproducción en un entorno QA aislado (FE-23)

La migración 001 es de instalación inicial, no un script idempotente: se aplica
una vez sobre una base nueva. Reproducir significa aplicarla en otro entorno
vacío equivalente, no volver a ejecutarla sobre tablas existentes. Nunca usar
`DROP` o `TRUNCATE` para forzar su ejecución en una base compartida.

Requisitos: PostgreSQL 15 o posterior (por las vistas `security_invoker` y
`UNIQUE NULLS NOT DISTINCT`), Supabase Auth ya instalado con `auth.users`, esquema
`extensions` disponible y permisos para instalar `pg_trgm`. Un PostgreSQL vacío
sin Auth no es equivalente a Supabase. La 001 no crea usuarios de Auth ni almacena
contraseñas en `perfiles`.

En un proyecto Supabase de QA nuevo, comprobar antes el destino y aplicar los
archivos en orden numérico. Para evitar instalaciones parciales, usar una
transacción con parada ante el primer error. Con `psql` instalado, desde la raíz:

```powershell
# FE23_QA_DATABASE_URL se proporciona fuera de Git; no imprimir su valor.
psql "$env:FE23_QA_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/001_esquema_base.sql
```

Este comando no se ejecutó durante FE-23 por ausencia de servicios QA. No usar
la conexión de producción. No guardar la URL, contraseñas ni tokens en evidencia.

Verificar en QA que `perfiles.id` es PK/FK a `auth.users.id`, que se rechazan roles
ajenos a administrador/terapeuta/marketing y valores nulos en rol/activo, y que
`activo` inicia en true. Comprobar también los triggers de auditoría y que el rol
de conexión del backend tiene los permisos necesarios con RLS activado. La 001
activa RLS pero no define políticas de lectura/escritura para clientes directos;
no se debe desactivar RLS para hacer pasar las pruebas.

Las cuentas QA deben crearse con Supabase Auth o el flujo de administración ya
existente (FE-29), nunca insertando contraseñas en SQL. Cada cuenta necesita un
perfil con el mismo UUID, rol válido y estado activo. Para preparar el primer
administrador en un proyecto QA vacío, un operador autorizado puede crear el
usuario en Auth y asociar su perfil mediante una transacción auditada; después se
reutiliza POST `/api/usuarios`. Generar contraseñas temporales fuera de Git y no
copiar hashes. Las pruebas automatizadas de FE-23 generan sus credenciales
ficticias en memoria y no crean cuentas reales.

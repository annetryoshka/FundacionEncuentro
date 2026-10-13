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
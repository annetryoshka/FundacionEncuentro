# FE-194 · Aceptación del contrato de cierre

Andrea Carolina Narváez Ortega · 26/11/2026. Base integrada `18ae1cf` y ampliación frontend de Andrea. Se revisó la evidencia de Emilia, no se atribuye a Andrea su ejecución contra Supabase real.

## Decisión y evidencia

| Hallazgo | Decisión técnica | Evidencia |
|---|---|---|
| FE27-01: un 4xx remoto se trataba como éxito | Cerrado. Solo 204 confirma la revocación y genera LOGOUT. Otros estados generan error sin auditoría de éxito. | 23/23 pruebas HTTP ejecutadas por Andrea en `backend/test/logout.test.mjs`; R2/R4/R5 de Emilia. |
| FE27-03: solicitud remota sin límite | Cerrado. Timeout abortable de 5000 ms y respuesta 504, sin LOGOUT de éxito. | Prueba HTTP actual; R3 de Emilia midió 5325 ms con Supabase y fallo inyectado. |
| FE27-02: invalidación inmediata supuesta | Conducta caracterizada. En el entorno y commit de Emilia, R7 observó 401 con el access anterior; no se convierte en una propiedad universal de cualquier validación JWT. | `logout-supabase-resultados.json`, 12/12 resultados de la base `b608d59`. El guard y AuthModule conservan ese código en `18ae1cf`. |
| Limpieza local, Atrás y recarga | Aprobados en Chromium escritorio y móvil emulado con API simulada. No reaparecen los datos clínicos ni el refresh en sessionStorage. | [Navegador de aceptación](aceptacion-andrea/navegador-resultados.json), más pruebas `Sesion.test.tsx`. |
| 400–504 remoto y fallo de conexión | Conserva el cierre local y avisa que no pudo confirmar la revocación. | Pruebas automatizadas frontend; fallos controlados de backend. No se presenta como una sesión real en un navegador desconectado. |

La evidencia real de Supabase está en [FE-193](logout-supabase.md) y su [JSON](logout-supabase-resultados.json). No se volvió a ejecutar Supabase en esta sesión. El recorrido actual del navegador y la medición real del backend son comprobaciones separadas; no se declara una prueba integral nueva con Supabase desde el navegador.

El código de autenticación y autorización se contrastó con `b608d59`: sin cambios en `backend/src/modules/auth` ni en los guards. La compilación actual del backend y 23 pruebas HTTP aprobaron. Se acepta el contrato corregido y se actualiza el hallazgo histórico, sin pedir que Emilia repita su ejecución para documentar esta aceptación.

## Mejoras restantes

La auditoría y la revocación remota siguen sin transacción común: un fallo de base tras revocar puede responder 500. Es una mejora de recuperación/trazabilidad para Sprint 4, registrada sin reabrir el defecto de falso 204. Si cambia la validación del guard o la configuración de Auth, se debe volver a caracterizar R7. La prueba de navegador con el proveedor real y otros navegadores conserva su alcance propio de aceptación del entorno compartido.

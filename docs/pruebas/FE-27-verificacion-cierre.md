# FE-27 — Verificación de cierre completo

Fecha de revisión: 2026-10-16 (America/La_Paz).

## Alcance y clasificación de evidencia

- Frontend: React en jsdom, MemoryRouter y API simulada; reutiliza FE-25. No equivale a un navegador real.
- Backend: HTTP local contra módulos AuthModule y CasosModule reales, guards globales, servicios y controladores reales. Solo las llamadas a Supabase Auth y DatabaseService son dobles. No se conecta a PostgreSQL ni se escriben pacientes o auditorías reales.
- Supabase real: NO EJECUTADO. No hay `.env` del backend ni variables SUPABASE/DATABASE_URL disponibles en esta sesión. No se han solicitado ni usado credenciales reales en las pruebas automatizadas.
- Las cadenas de autenticación incluidas en los tests son inventadas. No se guardan tokens reales en este documento ni en las salidas.

## Matriz de verificación

| # | Escenario | Evidencia automatizada | Alcance / resultado |
|---|---|---|---|
| 1 | Limpieza inmediata de usuario, tokens y datos privados | Sesion.test.tsx: logout pendiente, respuestas privadas tardías y renovación pendiente | Aprobado con mock frontend |
| 2 | Redirección a `/login` y aviso posterior | Sesion.test.tsx y Plantilla.test.tsx | Aprobado con mock frontend |
| 3 | Atrás y recarga no reabren pantallas clínicas | Test de historial y remontaje de FE-25 | Aprobado en MemoryRouter; navegador/BFCache pendiente |
| 4 | Refresh anterior rechazado tras logout exitoso | Plantilla.test.tsx (simulador); logout.test.mjs verifica propagación de rechazo de refresh | Aprobado con mock; revocación real NO verificada |
| 5 | Reutilización del access token anterior | logout.test.mjs controla respuestas 200/401 de `/user` después de logout | Caracterización aprobada; depende de Supabase; vigencia real NO verificada |
| 6 | Solicitudes sin token o con token inválido | HTTP POST logout, GET me y rutas clínicas | Aprobado: 401, sin consultas clínicas ni auditoría; Nest real con dependencias simuladas |
| 7 | Autenticación de rutas clínicas | HTTP GET `/casos`, GET `/casos/:id`, POST `/casos`; admin y marketing | Aprobado: 401 sin sesión; listado 200 admin / 403 marketing; guards reales con DB/Auth simulados |
| 8 | Supabase 400, 401, 403 y 500 durante logout | logout.test.mjs: caracterización de respuestas y auditoría | 400/401/403: defecto detectado; 500: se traduce a 503 |
| 9 | Fallo remoto no restaura sesión local | FE-25 red interrumpida; nuevos casos HTTP 400/401/403/500/503 | Aprobado con mock frontend; no compensa falso 204 del backend |
| 10 | Auditoría LOGOUT cuando corresponde | logout.test.mjs: éxito, fallos remotos, token ausente/inválido y fallo de DB | DB simulada; persistencia real pendiente; falsos positivos para 4xx |

## Defectos y riesgos encontrados

### FE27-01 — Alta: logout 4xx tratado como revocación confirmada

Causa: `SupabaseAuthClient.cerrarSesion` solo comprueba `res.status >= 500`. Las respuestas 400, 401 y 403 se resuelven sin error. `AuthService.logout` escribe LOGOUT y el controlador devuelve 204. El frontend elimina entonces su aviso de revocación pendiente aunque el servidor externo no confirmó la operación.

Reproducción automatizada: configurar el doble de `/auth/v1/user` con 200 para superar el guard y `/auth/v1/logout?scope=local` con cada 4xx. El resultado actual es 204 y una llamada de auditoría LOGOUT. El error puede ocurrir entre la validación del guard y el logout; no basta con que el guard haya aceptado el token.

Propuesta para FE-26: aceptar como confirmación solo respuestas exitosas de Supabase; propagar o traducir los errores no exitosos sin registrar LOGOUT como éxito. Si se decide tratar algunos códigos como operación idempotente, exigir evidencia del estado de la sesión y distinguir explícitamente ese resultado de una revocación confirmada. Añadir pruebas de aceptación de ese contrato. No se ha modificado código de producción de FE-26.

Las pruebas etiquetadas DEFECTO son de caracterización: pasan cuando reproducen el comportamiento incorrecto. Una suite verde no resuelve este hallazgo; tras corregir FE-26 deben invertirse sus expectativas para exigir error y ausencia de auditoría de éxito.

### FE27-02 — Suposición incorrecta sobre invalidación inmediata del access token

El comentario de `supabase-auth.client.ts` afirma que logout invalida el token de acceso. El simulador también lo rechaza inmediatamente, pero esto no demuestra revocación real. Supabase documenta que los JWT pueden permanecer válidos hasta expirar ([signout](https://supabase.com/docs/guides/auth/signout)). Este backend consulta `/auth/v1/user` en cada petición; el resultado concreto de ese endpoint y del guard tras logout debe medirse en el entorno de prueba, sin deducirlo de una validación JWT local.

Propuesta: corregir la documentación de FE-26 tras validar el comportamiento real y definir el criterio de aceptación para tokens copiados fuera del frontend. No afirmar que el guard bloquea inmediatamente todo token previamente emitido.

### FE27-03 — Sin timeout en el cliente Supabase del backend

`llamar` no establece AbortSignal ni plazo máximo. Si Supabase no responde, logout puede permanecer pendiente en Nest. El frontend limita su fetch a 15 segundos y conserva el cierre local, pero el backend puede seguir ocupando recursos. Propuesta: un timeout acotado y error de servicio no disponible en FE-26, con prueba de conexión detenida. No cambiado en esta subtarea de QA.

### Auditoría no atómica con la revocación

Si Supabase confirma y luego falla la escritura de auditoría, el endpoint devuelve 500 aunque ya se hizo la llamada remota. Se prueba con DB simulada. El aviso conservador del frontend es correcto; verificar en un entorno de prueba la trazabilidad y política de recuperación de auditorías sin intentar revertir el cierre remoto.

## Validación reproducible

- `cd frontend`: `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`.
- `cd backend`: `npm.cmd run test` (compila y ejecuta `node --test test/*.test.mjs`). También ejecutar `npm.cmd run build` por separado.
- Backend no dispone de script lint; no se añadió una herramienta o dependencia solo para esta subtarea.
- Raíz: `git diff --check`.
- Backend `npm.cmd run test`: exit 0; 20 pruebas aprobadas, 0 fallidas, 0 omitidas; duración del runner 5232 ms. Incluye tres caracterizaciones que reproducen FE27-01 y NO representan aceptación del resultado inseguro.
- Backend `npm.cmd run build`: exit 0.
- Frontend `npm.cmd run lint`: exit 0; `npm.cmd run build`: exit 0 (126 módulos transformados).
- Frontend `npm.cmd run test`: exit 0; 8 archivos, 70 pruebas aprobadas; duración 88.09 s.
- `git diff --check`: exit 0, sin errores.
- Las dependencias del backend se instalaron con `npm.cmd ci --no-audit --no-fund` desde el lockfile existente (215 paquetes); no se añadieron dependencias ni se modificó el lockfile. El primer intento restringido falló al acceder a la caché de npm; el reintento autorizado terminó correctamente.

## Comprobaciones manuales reales pendientes

Usar exclusivamente una cuenta de QA autorizada y datos sintéticos, fuera de las pruebas automatizadas. Mantener cualquier token necesario solo en memoria de herramientas locales; no copiarlo a Jira, logs, capturas o archivos de evidencia.

1. Entrar en una carpeta sintética, cerrar sesión y comprobar desaparición inmediata de datos y URL `/login`. Usar Atrás/Adelante, recarga y restauración desde BFCache en los navegadores soportados.
2. Conservar temporalmente en memoria el par previo al cierre; ejecutar logout y anotar únicamente hora y código HTTP.
3. Después de un 204 confirmado, intentar refresh con el token anterior y registrar solo el código/error saneado. Verificar aislamiento de otra sesión porque se usa `scope=local`.
4. Intentar `/api/auth/me` y `/api/casos` con el access token anterior inmediatamente después del logout y después de su expiración. Registrar códigos y tiempos relativos, sin contenido clínico ni token. Esto determina si persiste la autorización efectiva del backend.
5. Confirmar rechazo de `/api/casos` sin token y con token inventado, sin registrar datos de pacientes.
6. Comprobar desde las herramientas de auditoría autorizadas que hay exactamente un LOGOUT atribuible a la cuenta QA tras éxito. No insertar, borrar ni corregir registros manualmente.
7. Comprobar el cierre local sin conexión y que la interfaz no afirme revocación confirmada. Los códigos externos se inyectan en mocks, no cambiando configuración o base de producción.

## Recomendación

NO marcar FE-27 como Listo todavía: FE27-01 bloquea la confirmación fiable y la auditoría, y falta la evidencia real de refresh/access token y navegador. Las comprobaciones automatizadas permiten reproducir el defecto sin modificar FE-26 ni datos reales.

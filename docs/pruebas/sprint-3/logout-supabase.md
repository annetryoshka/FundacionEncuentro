# FE-193 — Logout, tokens y permisos con Supabase QA real

- **Historia:** FE-118, corregir la confirmación de logout y acotar los fallos del servicio de autenticación.
- **Base probada:** FE-192 (Adriana), commit `b608d59`, rama `feature/FE-192-logout-timeout`.
- **Trazabilidad:** RNF-01, RNF-02; hallazgos FE27-01, FE27-02 y FE27-03 de `docs/pruebas/FE-27-verificacion-cierre.md`.
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución real:** 2026-11-26 17:28 (America/La_Paz) · **Commit probado:** `b608d59` (base de FE-192) · Node v22.20.0
- **Resultado global:** suite real 12/12 aprobadas (26,9 s); suite con dobles 23/23 aprobadas (8,7 s); frontend 17/17 aprobadas.
- **Evidencia:** `docs/pruebas/sprint-3/logout-supabase-resultados.json` (sin tokens, contraseñas ni correos).

## 1. Qué es real y qué es un doble

| Suite | Backend | Supabase Auth | PostgreSQL | Para qué sirve |
|---|---|---|---|---|
| `backend/test/logout.test.mjs` (de FE-192) | NestJS real | **Doble** (fetch simulado) | **Doble** | Reproducir 4xx/5xx/red/timeout sin depender de la red |
| `backend/test/logout-supabase-real.test.mjs` (FE-193) | NestJS real (AppModule completo) | **Real** (proyecto de `backend/.env`) | **Real** (auditoría) | Medir la conducta real de logout, refresh y access |
| `frontend/src/features/auth/Sesion.test.tsx` | API simulada | Doble | — | El frontend conserva el cierre local y avisa ante 400-504 |
| Recorrido manual (sección 5) | Real | Real | Real | Navegador real, móvil, Atrás y recarga |

En la suite real, R1, R2 y R3 usan un **token real**, pero el fallo del logout se **inyecta** desde un proxy local que está entre el backend y Supabase. El resto de las llamadas pasan sin cambios a Supabase real. Así se prueban 503, 502 y 504 sin tocar la configuración del proyecto Supabase.

No se guardan tokens, contraseñas ni correos en este documento ni en `logout-supabase-resultados.json`.

## 2. Cómo ejecutar

Prerrequisitos: `backend/.env` apunta al proyecto Supabase de QA, y las cuentas demo existen (`npm run datos:demo` en `backend`). Se usan `direccion@fundacion.test` (administrador) y `apoyo@fundacion.test` (marketing).

```powershell
cd backend
npm run build
node --test test/logout.test.mjs
$env:FE_SUPABASE_QA = '1'; $env:FE_QA_PASSWORD = '<contraseña demo>'
node --test test/logout-supabase-real.test.mjs
Remove-Item Env:FE_SUPABASE_QA, Env:FE_QA_PASSWORD
```

Frontend:

```powershell
cd frontend
npx vitest run src/features/auth/Sesion.test.tsx
```

La suite real tarda unos 20 s (R3 espera el plazo de 5 s) y escribe `docs/pruebas/sprint-3/logout-supabase-resultados.json` con la fecha, el commit y los códigos observados.

## 3. Matriz de escenarios

| # | Escenario | Fuente | Esperado | Observado | Resultado |
|---|---|---|---|---|---|
| R0 | Login real y `/auth/me` | Real | 200 | 200 | Aprobado |
| R1 | Supabase responde 500 al cerrar | Token real + fallo inyectado | 503, 0 LOGOUT, la sesión sigue viva | 503, 0 LOGOUT, `/auth/me` 200 | Aprobado |
| R2 | Supabase responde 4xx al cerrar | Token real + fallo inyectado | 502, 0 LOGOUT | 502, 0 LOGOUT | Aprobado |
| R3 | Conexión detenida en el logout | Token real + fallo inyectado | 504 en unos 5 s, 0 LOGOUT | 504 en 5325 ms, 0 LOGOUT | Aprobado |
| R4 | Cierre real | Real | 204, exactamente 1 LOGOUT | 204, 1 LOGOUT | Aprobado |
| R5 | Reintento de logout con el access anterior | Real | No 204, 0 LOGOUT | 401, 0 LOGOUT | Aprobado |
| R6 | Refresh anterior tras el cierre | Real | 401 | 401 | Aprobado |
| R7 | Access anterior en `/auth/me` y `/casos` | Real | Se registra la conducta (lo ideal es 401) | `/auth/me` 401, `/casos` 401 | Aprobado: rechazado de inmediato |
| R8 | Otra sesión de la misma cuenta (scope=local) | Real | `/auth/me` 200, refresh 200 | 200 y 200 | Aprobado |
| R9 | `/casos` sin token o con token inventado | Real | 401 / 401 | 401 / 401 | Aprobado |
| R10 | Marketing en `/casos` y su logout | Real | 403 y 204 | 403 y 204 | Aprobado |
| R11 | Cierre de la sesión B (limpieza) | Real | 204 | 204 | Aprobado |
| D1 | 200/400/401/403/429 remoto → 502 sin auditoría | Doble | 502, 0 LOGOUT | 23/23 en verde (26/11/2026) | Aprobado |
| D2 | 500 y red caída → 503 sin auditoría | Doble | 503 | Incluido arriba | Aprobado |
| D3 | Logout detenido → 504 y solicitud abortada | Doble | 504, `signal.aborted` | Incluido arriba | Aprobado |
| F1 | Frontend ante 400/401/403/500/502/503/504 | Doble | Cierre local, aviso "No se pudo confirmar la revocación", sin refresh | 17/17 en verde (26/11/2026) | Aprobado |

R7 no hace fallar la suite a propósito. El criterio de FE-118 pide **registrar** la conducta real del access token. Si sale `HALLAZGO`, se reporta en la sección 6.

## 4. Revisión del cambio de FE-192

- FE27-01 queda corregido en código: solo un `204` de Supabase se acepta como confirmación. Cualquier otro código da 502 y no se registra LOGOUT.
- FE27-03 queda corregido: todas las llamadas a Supabase Auth (login, refresh, `/user` y logout) tienen `AbortSignal.timeout(5000)`, y un plazo vencido da 504.
- El comentario que afirmaba que el logout invalida el access token se eliminó (FE27-02). Su comprobación real es R7.
- El contrato en `docs/api/contrato-frontend-backend.md` describe 204/502/503/504.
- Observaciones menores para Adriana (no bloquean):
  - `leerJson` tiene una sangría irregular.
  - Un `429` de Supabase durante el logout se reporta como 502. Es aceptable, pero el mensaje podría diferenciarlo.
  - Sigue abierto el riesgo de una auditoría no atómica: si Supabase confirma y luego falla la base, la respuesta es 500 (lo cubre la prueba con doble).

## 5. Recorrido manual en navegador (escritorio y móvil)

Usar solo cuentas demo y carpetas ficticias. No copiar tokens a capturas ni a Jira.

1. Iniciar sesión con la cuenta de dirección, abrir una carpeta y pulsar **Cerrar sesión**. Debe redirigir a `/login` y los datos deben desaparecer de inmediato.
2. Pulsar **Atrás** y luego **Recargar**: no debe reabrirse ninguna pantalla clínica.
3. En DevTools → Application, comprobar que `sessionStorage` no tiene `fundacion-encuentro:refresh`.
4. Con DevTools → Network en **Offline**, cerrar sesión: debe hacer el cierre local y mostrar el aviso "No se pudo confirmar la revocación".
5. Repetir los pasos 1 a 3 en vista móvil (DevTools, dispositivo de 375 px) o en un teléfono real.

| Paso | Escritorio | Móvil | Observaciones |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | — | | |

## 6. Hallazgos

La ejecución real no encontró defectos nuevos.

| Hallazgo | Estado tras FE-193 | Evidencia |
|---|---|---|
| FE27-01: logout 4xx tratado como revocación confirmada | **Cerrado.** Un 4xx da 502 y no se registra LOGOUT; solo el 204 audita. | R2, R4, R5; D1 |
| FE27-02: suposición de invalidación inmediata del access token | **Conducta real registrada.** Con este proyecto de Supabase, el access anterior se rechaza de inmediato (401 en `/auth/me` y `/casos`), porque el guard consulta `/auth/v1/user` en cada petición y la sesión ya no existe. El rechazo depende de esa consulta, no de que el JWT expire. | R7 |
| FE27-03: sin timeout hacia Supabase | **Cerrado.** Una conexión detenida termina en 504 dentro del plazo (5325 ms con un plazo de 5000 ms) y sin auditoría. | R3; D3 |

Notas:
- `scope=local` funciona como se espera: cerrar una sesión no afecta a otra sesión de la misma cuenta (R8).
- Si en el futuro el guard validara el JWT localmente sin consultar `/auth/v1/user`, R7 debería volver a ejecutarse, porque el access token podría seguir siendo válido hasta que expire.
- Las observaciones menores de la sección 4 siguen abiertas para Adriana. No bloquean el cierre.

## 7. Cierre

- [x] Suite real ejecutada y JSON de resultados adjunto (12/12, 2026-11-26).
- [ ] Recorrido manual completado.
- [x] Hallazgos FE27-01 y FE27-03 verificados como cerrados; FE27-02 con su conducta real registrada.
- [ ] Enlace al commit en FE-193 y aviso a Andrea para FE-194.

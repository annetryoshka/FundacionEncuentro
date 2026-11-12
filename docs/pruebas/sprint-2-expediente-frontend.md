# Sprint 2 — Interfaz del expediente clínico

Subtareas de frontend: **FE-72** (sesiones), **FE-77** (tareas), **FE-67** (diagnóstico), **FE-62** (origen y
consentimiento), **FE-87** (pagos), **FE-82** (historial) y **FE-92** (indicadores). Reglas de Andrea en
`docs/srs/sprint-2/` (FE-61, 66, 71, 76, 81, 86, 91); contrato en `docs/api/contrato-frontend-backend.md`.

## Qué se agregó

| Pantalla | Ruta | Quién |
| --- | --- | --- |
| Sesiones de la carpeta, con el estado de sus tareas | `/carpetas/:id/sesiones` | Administración y terapeuta asignada |
| Registrar sesión (fecha y evolución) | `/carpetas/:id/sesiones/nueva` | Administración y terapeuta asignada |
| Detalle de sesión + tareas (agregar, marcar realizada o pendiente) | `/carpetas/:id/sesiones/:sesionId` | Administración y terapeuta asignada |
| Ficha de diagnóstico (crear, editar, cancelar) | `/carpetas/:id/diagnostico` | Administración y terapeuta asignada |
| Origen y constancia de consentimiento | `/carpetas/:id/constancia` | Administración y terapeuta asignada |
| Pagos por sesión (listado, total y registro) | `/carpetas/:id/pagos` | Solo administración |
| Historial clínico consolidado | `/carpetas/:id/historial` | Administración (con pagos) y terapeuta asignada (sin pagos) |
| Indicadores con selector de período | `/indicadores` | Solo administración |

La carpeta tiene ahora una tarjeta "Expediente clínico" con accesos a cada apartado, y cada apartado una barra
para moverse entre ellos. La API simulada (`npm run dev:simulado`) incluye estos endpoints con datos de ejemplo
en la carpeta Nº 1 voluntario (Mariana, de Sofía).

## Verificación con el backend real

Frontend real (`npm run dev`) contra el backend de los PR #26, #32 y #33 (que incluyen #27–#30), sobre la rama de
FE-47, con PostgreSQL 16 y las migraciones 001–011 en una base nueva. Supabase Auth de prueba local. Datos
ficticios: casos A y B de Sofía, C y D de Carla, como en los ejemplos de FE-91.

| # | Ejemplo de aceptación | Resultado |
| --- | --- | --- |
| 72.1 | Carpeta sin sesiones → «Aún no hay sesiones» | ✅ |
| 72.2 | Evolución de solo espacios → error en el campo, sin registro | ✅ |
| 72.3 | Guardar → detalle de la sesión creada (Nº 1) | ✅ |
| 72.4 | Dos sesiones con la misma fecha → aparecen 1 y luego 2 | ✅ |
| 72.5 | Abrir la 2 muestra su propia evolución | ✅ |
| 77.1 | Descripción vacía → error, no se crea | ✅ |
| 77.2 | T1 agrega «Actividad de prueba» a S-A1 → Pendiente y visible en la sesión | ✅ |
| 77.3 | Cambia a Realizada y recarga → se mantiene y aparece quién la cambió | ✅ |
| 77.4 | Estado fuera del catálogo → la API lo rechaza | ✅ 400 |
| 77.5 | Desde B se intenta asociar una sesión de A → rechazado | ✅ 400 |
| 77.6 | El listado de sesiones muestra el estado de sus tareas | ✅ |
| 67.1 | Ficha ausente se distingue de un error de carga | ✅ |
| 67.2 | Diagnóstico de solo espacios → error | ✅ |
| 67.3 | Crear con los opcionales vacíos y recargar → misma ficha, «Sin registro» | ✅ |
| 67.4 | Cancelar una edición conserva los datos previos | ✅ |
| 67.5 | Modificar conserva ID y autoría de creación y registra quién actualizó | ✅ |
| 62.1 | Origen técnico de solo lectura y «Sin registro» | ✅ |
| 62.2 | Registrada sin referencia → error y no se guarda | ✅ |
| 62.3 | Fecha y `EVIDENCIA-DEMO` → Registrada tras recargar, con la fecha correcta | ✅ |
| 62.4 | Justificación vacía no permite guardar No aplica | ✅ |
| 62.5 | El caso B conserva su número y tipo | ✅ |
| 62.6 | La API protege la escritura de un caso ajeno | ✅ 404 |
| 87.1 | Sin pagos → mensaje | ✅ |
| 87.2 | Monto 0, con tres decimales o negativo → rechazado en el formulario | ✅ |
| 87.3 | Bs 75,50 para S-A1 por QR | ✅ |
| 87.4 | Repetir la misma solicitud → no duplica; el total sigue en Bs 75,50 | ✅ |
| 87.5 | Sesión de otro caso → rechazado | ✅ 400 |
| 87.6 | Terapeuta abre `/pagos` por URL → sin permiso | ✅ |
| 82.1 | Administración ve únicamente los pagos de A | ✅ |
| 82.2 | T1 ve las sesiones de A con cada tarea en su sesión, sin pagos | ✅ |
| 82.3 | La respuesta clínica para T1 no tiene montos | ✅ |
| 82.4 | Sin ficha → «Sin registro» en diagnóstico; las demás secciones se ven | ✅ |
| 82.5 | T2 consulta A por URL → denegado, sin datos de A | ✅ |
| 82.6 | Marketing consulta el historial por API | ✅ 403 |
| 92.1 | 12–19 oct 2026: 4 casos, 2/1/1, 3 sesiones, Bs 225,60 (con dos tareas extra en S-A1) | ✅ |
| 92.2 | El período queda en la URL | ✅ |
| 92.3 | 1–5 oct 2026: 4 casos, 0 sesiones, Bs 0,00 | ✅ |
| 92.4 | Desde posterior a hasta → error en el formulario | ✅ |
| 92.5 | La terapeuta no tiene el menú Indicadores | ✅ |
| 92.6 | La terapeuta abre `/indicadores` por URL → sin permiso; la API responde 403 | ✅ |
| M | Las 9 pantallas a 390 px sin scroll horizontal | ✅ |
| Z | Sin errores de JavaScript en la página | ✅ |

52/52 comprobaciones en el navegador (Chromium, 1366×900 y 390×844).

Pruebas automatizadas: Vitest **153/153** (41 nuevas en `src/features/expediente/*.test.tsx` y
`src/features/indicadores/Indicadores.test.tsx`), `tsc -b` sin errores, oxlint sin avisos, `npm run build` correcto.

## Pendientes

- Fusionar en `main` el PR de FE-47 (#25) y los PR del backend (#26–#33). Sin ellos, estas pantallas muestran
  "Esta función todavía no está disponible en el servidor".
- Aplicar en Supabase las migraciones 004 a 011 en orden. Ojo: las ramas de BD de Alejandro (FE-60 a FE-94)
  usan otros nombres para 005–008; hay que acordar cuáles quedan antes de aplicarlas.
- Para backend: ver «Pendientes detectados al integrar» en el contrato (fecha de la constancia, nombres de autoría
  y contexto judicial).
- Repetir los pasos 72.3, 62.3, 87.3 y 92.1 con Supabase Auth real.

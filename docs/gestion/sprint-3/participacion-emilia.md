# FE-209 — Participación de Emilia en los eventos del Sprint 3

Tarea padre: FE-119, coordinar, integrar y aceptar la entrega funcional del Sprint 3 · Responsable: Emilia Crespo (QA y apoyo en APIs de administración/foro) · Estimación: 4 h-persona

Este registro separa lo **planificado** de lo **realizado**. Las filas de eventos sin fecha real se completan cuando ocurren; no se declara una asistencia que no esté confirmada. Fecha de entrega del Sprint 3: 2026-11-27.

| Evento | Horas planificadas | Fecha | Asistió | Acuerdos / acciones |
| --- | --- | --- | --- | --- |
| Planificación | 1.0 | 2026-11-19 | Sí | Subtareas de Emilia en el Sprint 3: QA FE-128, 133, 139, 145, 150, 155, 161, 166, 171, 191, 193 y 200; implementación FE-174, 179 y 184; participación FE-209. |
| Coordinación (acumulado del sprint) | 2.0 | 2026-11-19 a 2026-11-27 | Sí, por el grupo de WhatsApp, en Jira y en los PR | Ver «Coordinación registrada». |
| Review | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| Retrospectiva | 0.5 | Fecha por confirmar | Pendiente | Sin acuerdos todavía. |
| **Total** | **4.0** | | | |

## Coordinación registrada

| Fecha | Con quién | Tema | Resultado |
| --- | --- | --- | --- |
| 2026-11-26 | Andrea | FE-128: el guardado del diagnóstico pasó de reemplazar a combinar el JSON, y FE-66 pedía evaluación inicial obligatoria mientras la API exigía diagnóstico de ingreso. | Mensaje enviado. La PO lo resolvió con la migración 021 (evaluación inicial obligatoria, diagnóstico opcional, PR #73). |
| 2026-11-26 | Alejandro | FE133-01: la migración 012 hacía `revoke … from anon, authenticated` sin comprobar los roles y rompía las suites con PostgreSQL local de cualquier rama, incluida `main`. | Alejandro lo corrigió en `fix/FE-130-012-sin-roles`. Emilia lo verificó con y sin los roles (22 migraciones) y quedó en `main`. |
| 2026-11-26 | Jorge | FE171-01: la prueba de descarga de Investigación usaba un `Blob` que Node 22 rechaza. | Corregido por Emilia en la prueba (una línea, solo test) dentro del PR #88, con aviso a Jorge. |
| 2026-11-26 | Andrea y Adriana | FE155-01: la casilla «Composición familiar» no cambiaba el texto del informe. | Mensaje enviado. Según la revisión integrada de Alejandro (2026-11-27), los informes ya incluyen la composición familiar en `main`. |
| 2026-11-26 a 27 | Adriana | FE-198: revisión de los backends implementados por Emilia (gastos y artículos). | FE-174 (PR #94) y FE-184 (PR #95) entregados con contrato y pruebas, y fusionados en `main`. |
| 2026-11-27 | Jorge | FE-184 hacía falta para FE-187 y chocaba con main en `app.module.ts` (GastosModule). | Conflicto resuelto al fusionar el PR #95; FE-187 se integró en el PR #101. |
| 2026-11-27 | Alejandro | Pidió revisar la página completa antes de las presentaciones. | Regresión integral FE-200 sobre `7e67568`: sin regresiones (detalle abajo). |

## Avance del rol al corte (2026-11-27)

| Subtarea | HU | Estado | Evidencia |
| --- | --- | --- | --- |
| FE-193 Logout, tokens y permisos con Supabase real | FE-118 | Terminada | `docs/pruebas/sprint-3/logout-supabase.md`: 12/12 real, 23/23 con dobles |
| FE-128 Ficha ampliada y regresión del diagnóstico | FE-110 | Terminada | `ficha-familiar.md` · PR #98: 10/10 API, 7/7 interfaz |
| FE-133 Integridad y confidencialidad del genograma | FE-17 | Terminada; la muestra real de GenoPro depende de FE-129 | `genograma.md` · PR #97: 11/11 API, 7/7 interfaz |
| FE-139 Residencia y filtros de ambas ciudades | FE-111 | Terminada | `residencia.md` · PR #80: 11/11 API |
| FE-145 Estados de difusión y separación clínica | FE-112 | Terminada | `difusion.md` · PR #82: 13/13 API, 7/7 interfaz |
| FE-150 Navegación pública en móvil y escritorio | FE-113 | Terminada | `portal-publico.md` · PR #96: 8/8 interfaz y recorrido manual |
| FE-155 Informes contra los datos del caso | FE-15 | Terminada | `informes.md` · PR #84: 8/8 API |
| FE-161 Exportación PDF/Word | FE-114 | Listo en Jira; ejecutada por Andrea como apoyo | `exportacion.md` (no se atribuye a Emilia) |
| FE-166 Importación y protección de registros antiguos | FE-9 | Terminada | `importacion.md` · PR #85: 7/7 API |
| FE-171 Paquete e interoperabilidad de Atlas.ti | FE-115 | Terminada en formato; la importación en ATLAS.ti queda pendiente | `investigacion-atlasti.md` · PR #88: 9/9 API |
| FE-174 API administrativa de gastos (implementación) | FE-5 | Terminada | PR #94: 12/12 API, 31 unitarias |
| FE-184 API de artículos públicos (implementación) | FE-116 | Terminada | PR #95: 13/13 API, 27 unitarias |
| FE-179 API de planificación del personal | FE-4 | Fuera de alcance: la HU se retiró del Sprint 3 | — |
| FE-200 Regresión integral | FE-119 | Terminada | `regresion-integrada.md`: backend 361 + 550/551, frontend 356, Supabase real 12/12 |
| FE-191 Constancia, pagos y conciliación | FE-117 | Por verificar | Depende de FE-189 y FE-190 |

Todas las suites de QA corrieron contra el backend real (NestJS) con PostgreSQL 17 local y datos ficticios. Ninguna prueba usó datos reales de pacientes.

## Defectos e incidencias reportados

| ID | Severidad | Descripción | Estado |
| --- | --- | --- | --- |
| FE133-01 | Media | La migración 012 fallaba fuera de Supabase (`role "anon" does not exist`) | Corregido por Alejandro y verificado |
| FE155-01 | Media | La familia marcada no aparecía en el texto del informe | Informado; corregido en `main` según la revisión integrada |
| FE171-01 | Baja | `Blob` del simulado de descarga incompatible con Node 22 | Corregido (PR #88) |
| FE200-01 | Media | Pruebas largas del frontend superaban el límite de 5 s con la suite completa | Corregido (`testTimeout` 15 s) |
| FE200-02 | Baja | El simulador devolvía la imagen guardada como `Blob` | Corregido (bytes) |
| FE200-03 | Baja | La conexión directa de la prueba a Supabase se cortaba por inactividad | Corregido (`pg.Pool`) |

## Acuerdos y acciones

| # | Evento | Acuerdo / acción | Responsable | Estado |
| --- | --- | --- | --- | --- |
| 1 | Coordinación | Las verificaciones de HU ya integradas en `main` se hacen en una rama nueva desde `main`, con PR propio; las no integradas, en la rama de la HU | Emilia | Cumplida desde FE-139 |
| 2 | Coordinación | Entregar a Adriana los backends de FE-174 y FE-184 con contrato y pruebas para FE-198 | Emilia | Cumplida (PR #94 y #95) |
| 3 | Coordinación | Correr las suites con PostgreSQL local con los roles `anon`/`authenticated` hasta corregir la 012 | Emilia / Alejandro | Cumplida; la 012 ya no los necesita |
| 4 | Coordinación | Validar el paquete en la versión de ATLAS.ti de la Fundación | Andrea con la Fundación | Pendiente (Sprint 4) |
| 5 | Coordinación | Comparar el genograma con una muestra real de GenoPro | Andrea (FE-129) | Pendiente |
| 6 | Review y retro | Registrar acuerdos y acciones de la review y la retrospectiva | Emilia | Pendiente: fecha por confirmar con el grupo |

Estas 4 h son horas-persona de eventos; no incluyen la ejecución de las subtareas de QA ni la implementación.

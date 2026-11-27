# FE-101 — Review y cierre del Sprint 2

Tarea padre: FE-58 · Responsable: Gemina Ponce · Estimación: 3 h-persona

## Guion de demo (datos ficticios)

Se usa el guion de aceptación de Andrea, [FE-96](../../pruebas/FE-96-aceptacion-sprint-2.md), y su muestra [FE-96-datos-ficticios.json](../../pruebas/FE-96-datos-ficticios.json). Perfiles: administración, terapeutas T1 y T2, y marketing. Los resultados de ejecución se registran en FE-97.

| # | Paso | Historia | Prueba FE-96 |
| --- | --- | --- | --- |
| 1 | Buscar y combinar clasificación y estado; editar y recargar | FE-14 | P-01, P-02 |
| 2 | Guardar constancia Pendiente; rechazar Registrada sin referencia; guardar válida | FE-50 | P-03 |
| 3 | Crear, editar y cancelar la ficha de diagnóstico; probar acceso ajeno | FE-13 | P-04 |
| 4 | Registrar sesiones del mismo día; fecha inválida; sesión 17 en otro caso | FE-55 | P-05 |
| 5 | Añadir tareas, marcar una Realizada; rechazar asociación cruzada | FE-56 | P-06 |
| 6 | Abrir historial con administración, T1 y T2; consultar la API directa | FE-57 | P-08 |
| 7 | Registrar un pago, reenviar la petición; monto inválido, sesión ajena, rol sin permiso | FE-7 | P-07 |
| 8 | Conciliar 12–19 y 1–5 de octubre: 4 casos, 3 sesiones, Bs 225,60 y período vacío | FE-6 | P-09 |
| 9 | Reasignar A a T2 y probar que T1 pierde acceso | FE-35 | P-10 |

## Resultados por historia

| HU | Puntos | Estado (Aceptada / Pendiente) | Aceptada por | Evidencia |
| --- | --- | --- | --- | --- |
| FE-14 | 3 | Integrada y verificada por QA; aceptación de Andrea pendiente de registro | Andrea | `docs/pruebas/FE-49-verificacion-clasificacion-filtros.md` (14 aprobadas); ver también `FE-47-filtros-y-controles.md` |
| FE-50 | 3 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-65-verificacion-constancia.md` |
| FE-13 | 5 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-70-verificacion-diagnostico.md` (8 aprobadas) |
| FE-55 | 5 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-75-verificacion-sesiones.md` (10 aprobadas) |
| FE-56 | 3 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-80-verificacion-tareas.md` (11 aprobadas) |
| FE-57 | 3 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-85-verificacion-historial.md` (8 de 8) |
| FE-7 | 5 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-90-verificacion-pagos.md` (12 aprobadas) |
| FE-6 | 3 | Integrada y verificada por QA; aceptación pendiente de registro | Andrea | `docs/pruebas/FE-95-verificacion-indicadores.md` (11 de 11) |

Estado al **2026-11-23** (`main` en `37ed16b`). Las verificaciones de QA se ejecutaron con PostgreSQL local y datos ficticios. Una HU pasa a *Aceptada* solo cuando Andrea la acepta con la evidencia de FE-97; la columna "Aceptada por" indica quién debe aceptarla, no que ya lo hizo.

Una HU se acepta solo con criterios verificados y evidencia; el código o una captura aislada no bastan.

## Acuerdos de review

_Completar tras la reunión._

## Retrospectiva — acciones

| Acción | Responsable | Plazo |
| --- | --- | --- |
| | | |

## Límites declarados

Sin certificación de RPO/RTO ni operación con datos clínicos reales. Fuera de alcance: FE-3, FE-17, FE-19, FE-4, FE-5. El historial es inicial y no cubre el historial ampliado de la SRS.

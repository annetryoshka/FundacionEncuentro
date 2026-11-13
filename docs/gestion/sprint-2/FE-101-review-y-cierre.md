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
| FE-14 | 3 | Pendiente (backend integrado; falta pantalla y pruebas P-01/P-02) | Andrea | |
| FE-50 | 3 | Pendiente | Andrea | |
| FE-13 | 5 | Pendiente | Andrea | |
| FE-55 | 5 | Pendiente | Andrea | |
| FE-56 | 3 | Pendiente | Andrea | |
| FE-57 | 3 | Pendiente | Andrea | |
| FE-7 | 5 | Pendiente | Andrea | |
| FE-6 | 3 | Pendiente | Andrea | |

Estado al 2026-11-09. Se cambia a *Aceptada* solo cuando Andrea acepta con la evidencia de FE-97.

Una HU se acepta solo con criterios verificados y evidencia; el código o una captura aislada no bastan.

## Acuerdos de review

_Completar tras la reunión._

## Retrospectiva — acciones

| Acción | Responsable | Plazo |
| --- | --- | --- |
| | | |

## Límites declarados

Sin certificación de RPO/RTO ni operación con datos clínicos reales. Fuera de alcance: FE-3, FE-17, FE-19, FE-4, FE-5. El historial es inicial y no cubre el historial ampliado de la SRS.

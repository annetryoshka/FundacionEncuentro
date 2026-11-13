# FE-98 — Dependencias y bloqueos del Sprint 2

Tarea padre: FE-58 · Responsable: Gemina Ponce (Scrum Master y PM) · Estimación: 6 h-persona

## Secuencia acordada (de FE-58)

| Días | Trabajo | Depende de |
| --- | --- | --- |
| 1–3 | Reglas funcionales, contratos, clasificación (FE-14) y consentimiento (FE-50); diagnóstico (FE-13) y modelo de sesiones (FE-55) en paralelo | Contrato del Sprint 1 (`docs/api/contrato-frontend-backend.md`) |
| 2–5 | Integrar diagnóstico y sesiones. Sesiones **no** requiere diagnóstico previo ni consentimiento registrado | FE-13, FE-55 |
| 5–7 | Tareas terapéuticas (FE-56) y pagos (FE-7) en paralelo | Sesiones disponibles |
| 6–8 | Historial clínico inicial (FE-57); apartado económico solo para administración | FE-55, FE-7 |
| 8–9 | Dashboard (FE-6) y conciliación de pagos | FE-7 |
| 10 | Aceptación integral, review y retrospectiva | Todo; QA durante todo el sprint |

## Dependencias entre capas

| Dependencia | Entrega | Consume | Acuerdo |
| --- | --- | --- | --- |
| Contrato de API de cada HU | Backend | Frontend, QA | Acordar el contrato de la HU siguiente **antes** de terminar la actual |
| Migraciones SQL (`db/`) | BD | Backend | Esquema y repositorio coherentes antes de integrar |
| Permisos por rol (FE-18) | Backend | Todas las HU | Se aplican a toda operación nueva; se prueban directo contra la API |
| Pagos conciliados con dashboard | FE-7 | FE-6 | El total de pagos debe coincidir con el dashboard |

## Registro de bloqueos

Un bloqueo se cierra solo con acción y resolución anotadas. Corte inicial: **2026-11-09**, sobre `main` en `4c50218`. Las fuentes son los documentos de Andrea en `docs/srs/sprint-2/` y el guion `docs/pruebas/FE-96-aceptacion-sprint-2.md` (sección "Decisiones pendientes").

| # | Fecha | Historia | Bloqueo | Responsable | Acción | Estado | Resolución |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-09 | FE-50 | Falta decidir condiciones, estados y evidencia de la constancia de consentimiento (FE-61). | Andrea (PO) | Confirmar la propuesta de FE-61 con la fundación y publicarla como decisión. | Abierto | |
| 2 | 2026-11-09 | FE-13 | Falta confirmar la ficha de referencia y el mínimo obligatorio del diagnóstico (FE-66). | Andrea (PO) | Validar el mínimo obligatorio y cerrar FE-66. | Abierto | |
| 3 | 2026-11-09 | FE-7 | Falta definir cuántos pagos admite una sesión y qué métodos entran en la demo (FE-86). | Andrea (PO) | Decidir cardinalidad y métodos; actualizar FE-86. | Abierto | |
| 4 | 2026-11-09 | FE-55, FE-56, FE-7 | Falta confirmar el identificador de sesión compartido y validar sus relaciones en la API. | Adriana (backend) con Alejandro (BD) | Acordar el contrato de sesión y registrarlo en `docs/api/contrato-frontend-backend.md`. | Abierto | |
| 5 | 2026-11-09 | FE-50, 13, 55, 56, 57, 7, 6 | No hay ramas de implementación de estas HU en el repositorio; solo existe el backend de clasificación (FE-48, PR #18). | Gemina (seguimiento) | Pedir a cada responsable la rama y la fecha prevista de su primer PR. | Abierto | |

## Regla de escalamiento

1. Un bloqueo se registra el mismo día en que se detecta.
2. Si consume el margen (4 h por integrante) y aún excede la capacidad, se retira alcance de menor prioridad empezando por **FE-6**.
3. No se amplían jornadas para sostener un compromiso inviable.

## Prioridades diarias

Se comunican en el tablero de Jira, respetando el límite de trabajo en curso.

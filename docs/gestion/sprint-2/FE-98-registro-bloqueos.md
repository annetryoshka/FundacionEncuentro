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

> Completar durante el sprint, una fila por bloqueo. Un bloqueo se cierra solo con acción y resolución anotadas.

| # | Fecha | Historia | Bloqueo | Responsable | Acción | Estado | Resolución |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | Abierto | |

## Regla de escalamiento

1. Un bloqueo se registra el mismo día en que se detecta.
2. Si consume el margen (4 h por integrante) y aún excede la capacidad, se retira alcance de menor prioridad empezando por **FE-6**.
3. No se amplían jornadas para sostener un compromiso inviable.

## Prioridades diarias

Se comunican en el tablero de Jira, respetando el límite de trabajo en curso.

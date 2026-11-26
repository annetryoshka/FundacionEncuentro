# FE-201 — Bloqueos e integración del Sprint 3

Tarea padre: FE-119 · Responsable: Gemina Ponce (Scrum Master/PM) · Estimación: 5 h-persona

Corte: **2026-11-23**, sobre `main` en `37ed16b`. Las dependencias salen de las subtareas del Sprint 3 en Jira (campo "Requiere los entregables de…"). Las fechas del sprint no están fijadas en Jira.

## Estado de partida

El Sprint 2 está integrado en `main` (merges del 2026-11-13) y sus 8 HU tienen verificación de QA. Del Sprint 3 todavía no hay ramas de implementación en el repositorio.

## Orden de entrega por dependencias

| Orden | Entregable previo (contrato o base) | Habilita | Historia |
| --- | --- | --- | --- |
| 1 | FE-134 (contrato de ciudad de residencia) | FE-137 controles y etiquetas de residencia | FE-111 |
| 1 | FE-140 (contrato de publicaciones) | FE-141 contenido institucional; FE-148 tarjetas y listado público | FE-112, FE-113 |
| 1 | FE-156 (plantillas de exportación) | FE-157 estilos y presentación | FE-114 |
| 1 | FE-179, FE-180 (disponibilidad y cruces) | FE-181 verificación de horarios | FE-4 |
| 1 | FE-174, FE-175 (gastos y distribución) | FE-176 conciliación contable | FE-5 |
| 1 | FE-182, FE-184 (foro y moderación) | FE-185 contenido y verificación de moderación | FE-116 |
| 2 | FE-141 | FE-147 revisión del contenido con la Fundación | FE-113 |
| 2 | FE-148 | FE-186 listado y tarjetas de investigaciones | FE-116 |

Regla de FE-119: acordar el contrato de cada entrega **antes** de que empiece quien la consume, e integrar con frecuencia.

## Registro de bloqueos y decisiones

| # | Fecha | Historia | Bloqueo o decisión | Responsable | Acción | Estado | Resolución |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-23 | FE-4, FE-5, FE-116 | El alcance inicial de planificación de personal (N-21), gastos (RF-25) y foro (RF-26) está "pendiente de ratificación" en Jira. | Andrea (PO) | Ratificar o retirar cada uno el primer día del sprint (indicado en FE-202). | Abierto | |
| 2 | 2026-11-23 | FE-109 | Los informes 1, 2 y 3 del voluntariado piden el modelo institucional adjunto en FE-120. | Gemina | Descargar el modelo de FE-120 y confirmar que sirve para los tres informes. | Abierto | |
| 3 | 2026-11-23 | FE-109 | Plazos cercanos: informe del Sprint 1 hasta el miércoles 2026-11-25; informe del Sprint 2 objetivo viernes 2026-11-27 y máximo sábado 2026-11-28. | Gemina | Priorizar los informes antes que el resto de tareas del sprint. | Abierto | |
| 4 | 2026-11-23 | FE-109 | No consta el canal institucional de entrega de los informes. | Andrea (PO) | Confirmar a quién y por qué canal se entregan, y guardar constancia. | Abierto | |
| 5 | 2026-11-23 | FE-112, FE-113 | El contenido real de difusión (servicios, contactos, imágenes) debe venir autorizado por la Fundación. | Andrea (PO) con la Fundación | Pedir y registrar la autorización. Mientras tanto, usar solo contenido ficticio identificado para QA. | Abierto | |
| 6 | 2026-11-23 | Sprint 2 (FE-58) | La review y la retrospectiva del Sprint 2 no tienen fecha confirmada (FE-107 las deja pendientes al 2026-11-13). | Gemina con Andrea | Fijar fecha y registrar acuerdos. | Abierto | |
| 7 | 2026-11-23 | FE-202 | La carga asignada a Gemina en las subtareas listadas supera la capacidad supuesta. Ver [avance-y-capacidad.md](avance-y-capacidad.md). | Gemina con Andrea | Decidir qué se reasigna o se retira. | Abierto | |

## Hitos de integración (propuesta)

Las fechas quedan por fijar con el equipo cuando se calendarice el sprint.

| Hito | Contenido | Condición para integrar |
| --- | --- | --- |
| H1 | Contratos de residencia (FE-134), publicaciones (FE-140), plantillas (FE-156) y las bases de FE-4, FE-5 y FE-116 | Contrato publicado en `docs/api/contrato-frontend-backend.md` y revisado por Adriana |
| H2 | Interfaz de residencia, portal público, exportación y listados | PR revisado por Jorge; pruebas con datos ficticios |
| H3 | Verificación de QA, validación con la Fundación y aceptación de Andrea | Evidencia por HU; sin defectos abiertos de severidad alta |

## Regla de escalamiento

1. El bloqueo se registra el mismo día en que se detecta.
2. Si consume el margen de capacidad, se retira primero el alcance de menor prioridad y se documenta el ajuste.
3. No se amplían jornadas para sostener un compromiso inviable.

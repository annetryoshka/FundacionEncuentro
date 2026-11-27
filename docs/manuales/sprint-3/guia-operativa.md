# FE-203 — Guía operativa (borrador)

Tarea padre: FE-119 · Responsable: Gemina Ponce · Estimación: 4 h-persona

Estado: **borrador al 2026-11-23**. Incluye lo que ya existe en `main` (`37ed16b`) y deja marcado lo del Sprint 3, que todavía no está construido. FE-203 pide registrar comentarios reales de la Fundación y cómo operará y mantendrá el personal el producto: esas partes están **pendientes** porque no constan en el repositorio. Todas las pruebas usan datos ficticios.

## 1. Quién puede hacer qué

| Perfil | Acceso |
| --- | --- |
| Administración | Todas las carpetas, pagos e indicadores, cuentas del personal |
| Terapeuta | Solo las carpetas que tiene asignadas; sin acceso a pagos |
| Marketing / apoyo | Sin acceso a información clínica |

Fuente: SRS v1.0, apartado 2.2.

## 2. Cómo abrir el sistema

1. Con el backend en marcha, abrir el frontend con `npm run dev` y entrar en http://localhost:5173 (instrucciones completas en el README).
2. Para practicar sin backend se puede usar `npm run dev:simulado`, que trae datos de ejemplo en la carpeta Nº 1 (voluntario).
3. Iniciar sesión con una cuenta del personal. Los pacientes no usan el sistema.

## 3. Flujo del expediente clínico (disponible en el Sprint 2)

Cada carpeta tiene la tarjeta "Expediente clínico" con acceso a estos apartados:

| Apartado | Ruta | Quién | Qué se hace |
| --- | --- | --- | --- |
| Origen, contexto judicial y constancia | `/carpetas/:id/constancia` | Administración y terapeuta asignada | Registrar origen, juzgado si es judicial y la constancia de consentimiento (Pendiente, Registrada o No aplica) |
| Diagnóstico | `/carpetas/:id/diagnostico` | Administración y terapeuta asignada | Crear, editar o cancelar la ficha de diagnóstico |
| Sesiones | `/carpetas/:id/sesiones` | Administración y terapeuta asignada | Ver sesiones, registrar una con fecha y evolución, abrir su detalle |
| Tareas terapéuticas | Dentro del detalle de la sesión | Administración y terapeuta asignada | Agregar tareas y marcarlas Realizada o Pendiente |
| Pagos | `/carpetas/:id/pagos` | Solo administración | Ver pagos y total; registrar un pago |
| Historial clínico | `/carpetas/:id/historial` | Administración (con pagos) y terapeuta (sin pagos) | Consultar el recorrido del caso |
| Indicadores | `/indicadores` | Solo administración | Elegir un período y ver casos, sesiones y total de pagos |

Reglas que conviene recordar:
- La constancia **Registrada** exige fecha y referencia; sin ellas no se guarda.
- Un caso de origen judicial exige indicar el juzgado.
- Una terapeuta que abre una carpeta ajena no la ve (respuesta "no encontramos esta carpeta").
- Los totales de pagos del historial y de indicadores deben coincidir.

Fuente: `docs/pruebas/sprint-2-expediente-frontend.md` y `docs/srs/sprint-2/`.

## 4. Funciones del Sprint 3 (pendientes de construir)

| Función | Historia | Estado de esta guía |
| --- | --- | --- |
| Ficha y genograma | Por confirmar en Jira | Pendiente |
| Ciudad de residencia y filtro La Paz / El Alto | FE-111 | Pendiente (requiere el contrato FE-134) |
| Difusión: portal público, campañas, actividades y cursos | FE-112, FE-113 | Pendiente (requiere el contrato FE-140) |
| Exportación a PDF y Word editable | FE-114 | Pendiente (requiere las plantillas FE-156) |
| Planificación de personal, gastos y foro de investigaciones | FE-4, FE-5, FE-116 | Pendiente de ratificación del alcance |

Cada sección se completa cuando la función esté integrada en `main` y se pueda recorrer.

## 5. Recorrido de demostración

Para el Sprint 2 se usa el guion [FE-96](../../pruebas/FE-96-aceptacion-sprint-2.md) con su muestra [de datos ficticios](../../pruebas/FE-96-datos-ficticios.json). El recorrido de las funciones del Sprint 3 se agrega al integrarlas.

## 6. Validación con la Fundación

| Fecha | Participantes | Comentarios reales | Acuerdos |
| --- | --- | --- | --- |
| Pendiente | | | |

Si la validación no ocurre, se registra expresamente como **no realizada**. No se inventan comentarios ni conformidad.

## 7. Operación y mantenimiento por el personal

**Pendiente.** Definir con la Fundación quién crea las cuentas, quién respalda la información y quién atiende fallos. Requisitos de referencia: RNF-08 (respaldo diario, RPO ≤ 24 h y RTO ≤ 4 h como objetivo) y RNF-01 y RNF-02 (acceso y confidencialidad). Esta guía no certifica el cumplimiento de esos objetivos ni la operación con datos clínicos reales.

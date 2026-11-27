# FE-203 — Guía operativa (borrador)

Tarea padre: FE-119 · Responsable: Gemina Ponce · Estimación: 4 h-persona

Estado: **borrador al 2026-11-26**. Incluye lo que existe en `main` (`c806c34`) y deja marcado lo que todavía no está disponible. FE-203 pide registrar comentarios reales de la Fundación y cómo operará y mantendrá el personal el producto: esas partes están **pendientes** porque no constan en el repositorio. Todas las pruebas usan datos ficticios.

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

## 4. Funciones del Sprint 3 (corte 2026-11-26)

### Disponibles

| Qué se hace | Dónde | Quién |
| --- | --- | --- |
| Consultar y editar la composición familiar | `/carpetas/:id/familia` | Administración y terapeuta asignada |
| Cargar, ver y descargar el genograma (PDF, PNG o JPEG, hasta 5 MiB) | `/carpetas/:id/genograma` | Administración y terapeuta asignada |
| Generar, revisar y versionar informes | `/carpetas/:id/informes` | Solo la terapeuta asignada |
| Exportar a PDF o Word («Exportar a PDF o Word») | En la carpeta y en el informe revisado | Según el permiso sobre el caso |
| Registrar la ciudad de residencia y filtrar por La Paz o El Alto | Ficha, listado de carpetas e indicadores | Según el permiso de cada pantalla |
| Crear, publicar y retirar campañas, actividades y cursos | `/difusion` | Administración y marketing |
| Ver la presentación y las publicaciones sin iniciar sesión | `/fundacion` y `/publicaciones` | Visitantes |
| Importar datos históricos (CSV o XLSX) revisando antes de confirmar | `/importaciones` | Solo administración |
| Categorizar casos y exportar para investigación | `/investigacion` | Administración y terapeuta |

Reglas que conviene recordar:
- La evaluación inicial es obligatoria y el diagnóstico es opcional.
- Se admite un solo pago por sesión, por QR o transferencia; se puede atender con la constancia de consentimiento pendiente.
- Una publicación en borrador o retirada no se ve en el portal público.
- La importación se revisa y se confirma: no escribe nada antes de confirmar.

### Todavía no disponibles

| Función | Estado (acta FE-196) |
| --- | --- |
| Gastos (FE-5) | Sin API ni pantalla |
| Publicación de artículos de investigación, sin comentarios (FE-116) | Solo componentes visuales |
| Genograma insertado dentro de las exportaciones | Pendiente |
| Planificación de personal (FE-4) | Retirada del proyecto |

Fuentes: `frontend/src/App.tsx`, `docs/pruebas/sprint-3/aceptacion-integrada.md` y `docs/srs/sprint-3/`.

## 5. Recorrido de demostración

Para el Sprint 2 se usa el guion [FE-96](../../pruebas/FE-96-aceptacion-sprint-2.md) con su muestra [de datos ficticios](../../pruebas/FE-96-datos-ficticios.json). El recorrido de las funciones del Sprint 3 se agrega al integrarlas.

## 6. Validación con la Fundación

| Fecha | Participantes | Comentarios reales | Acuerdos |
| --- | --- | --- | --- |
| Pendiente | | | |

Si la validación no ocurre, se registra expresamente como **no realizada**. No se inventan comentarios ni conformidad.

## 7. Operación y mantenimiento por el personal

**Pendiente.** Definir con la Fundación quién crea las cuentas, quién respalda la información y quién atiende fallos. Requisitos de referencia: RNF-08 (respaldo diario, RPO ≤ 24 h y RTO ≤ 4 h como objetivo) y RNF-01 y RNF-02 (acceso y confidencialidad). Esta guía no certifica el cumplimiento de esos objetivos ni la operación con datos clínicos reales.

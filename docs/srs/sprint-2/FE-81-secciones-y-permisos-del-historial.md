# FE-81 · Secciones y permisos del historial inicial

Entregable de análisis para FE-57. Abrir el historial desde la carpeta y mantener la consulta dentro del caso seleccionado.

| Orden y sección | Administración | Terapeuta asignada | Cuenta sin acceso al caso |
|---|---|---|---|
| 1. Identificación, origen, clasificación y estado | Visible | Visible | Denegado |
| 2. Contexto y constancia | Visible | Visible | Denegado |
| 3. Diagnóstico, fecha y trazabilidad | Visible | Visible | Denegado |
| 4. Sesiones y tareas, en orden cronológico | Visible | Visible | Denegado |
| 5. Pagos asociados a las sesiones | Visible al integrar FE-7 | Campos financieros excluidos de la respuesta | Denegado |

**Boceto.** Carpeta → Historial → encabezado del caso → contexto → diagnóstico → sesiones y tareas → pagos, cuando el rol los pueda consultar. Una sección vacía muestra «Sin registro». Un error de carga muestra la opción de reintentar. La consulta de pagos es independiente del historial clínico inicial.

| Ejemplo | Resultado esperado |
|---|---|
| T1 abre el historial de A | Ve las sesiones de A y las tareas dentro de la sesión correcta. |
| T1 consulta la API de A y A tiene un pago | La respuesta clínica excluye los montos. |
| T2 o marketing intenta consultar A por UUID | La API deniega la consulta y no devuelve datos de A. |
| Administración abre A una vez integrado FE-7 | Ve únicamente los pagos asociados a A. |
| A no tiene ficha registrada | Se muestra «Sin registro» en diagnóstico y se conservan las demás secciones disponibles. |

Informes y genograma se integran con sus historias posteriores. Al reasignar la carpeta, las solicitudes nuevas se autorizan con la asignación vigente.

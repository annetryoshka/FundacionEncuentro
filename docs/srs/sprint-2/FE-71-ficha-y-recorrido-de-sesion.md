# FE-71 · Ficha de seguimiento y recorrido de sesión

Entregable de análisis para FE-55. Define el flujo funcional de registro y consulta de sesiones.

| Campo | Regla |
|---|---|
| Caso | Se obtiene de la carpeta autorizada. El servidor comprueba que la sesión pertenezca al caso. |
| Identificador de sesión | Estable y consultable. Reutilizar el UUID de `fichas_seguimiento.id` si se mantiene una ficha por sesión. El mismo identificador se usa en tareas y pagos. |
| Número de sesión | Entero positivo y único dentro del caso. La asignación automática, si se adopta, debe conservar la unicidad ante registros simultáneos. |
| Fecha | Fecha calendario válida, obligatoria, en formato `AAAA-MM-DD` en el contrato. |
| Evolución | Texto obligatorio con contenido después de recortar espacios. |
| Responsable y autoría | La API determina los datos de trazabilidad a partir de la identidad autenticada. La persona responsable registrada se conserva tras una reasignación. |

**Boceto.** Carpeta → Sesiones → Registrar sesión → Fecha y evolución → Guardar → Detalle de la sesión creada. El listado muestra fecha, número y responsable, en orden ascendente por fecha y número. Cada fila abre el detalle por identificador.

**Comportamiento.** Guardar la sesión y su seguimiento en una sola operación. Distinguir «Aún no hay sesiones» de «No se pudieron cargar las sesiones». Mantener el formulario ante un error. El seguimiento puede registrarse antes de la ficha de diagnóstico. Las 16 sesiones y 45–60 minutos son valores de referencia.

| Ejemplo | Resultado esperado |
|---|---|
| A tiene sesiones 2 y 1 con la misma fecha | Aparecen 1 y luego 2. Abrir 2 muestra su propia evolución. |
| Se guarda una fecha inválida o evolución de solo espacios | Se identifica el campo con error y no se crea un registro parcial. |
| Una cuenta intenta guardar o abrir una sesión de un caso ajeno | La API rechaza la solicitud. |
| A tiene 16 sesiones válidas y se registra otra | La número 17 puede guardarse. |

Referencia del esquema: [fichas de seguimiento](../../../db/migrations/001_esquema_base.sql).

# FE-96 · Guion de aceptación del Sprint 2

Este guion contiene casos y resultados esperados para un entorno de QA con datos ficticios. Registrar en FE-97 el commit probado, migraciones, fecha, resultado observado y evidencia. El resultado esperado de cada fila se compara con la versión integrada.

## Datos de prueba

Usar [la muestra ficticia](FE-96-datos-ficticios.json) con un perfil de administración, dos terapeutas de prueba T1 y T2 y un perfil de marketing. A–D y S-A1 son alias. En QA se deben asociar con los identificadores generados. Las dos tareas de S-A1 ayudan a detectar conteos o sumas duplicados.

## Secuencia

| Prueba | HU | Acción | Resultado esperado |
|---|---|---|---|
| P-01 | FE-14 | Buscar 101 con administración y T1. Combinar clasificación y estado con paginación. | Administración obtiene A y B. T1 solo obtiene A. Los totales respetan los filtros y permisos. |
| P-02 | FE-14 | Editar estado y clasificación, recargar y probar un valor inválido y un caso ajeno. | Solo se guardan los valores permitidos. Se conservan origen, correlativo y asignación. La escritura ajena se rechaza. |
| P-03 | FE-50 | Guardar Pendiente. Intentar Registrada sin referencia. Guardar con fecha y referencia y recargar. | La validación conserva la constancia anterior. El registro válido conserva la carpeta. |
| P-04 | FE-13 | Crear ficha, editar y cancelar. Editar y guardar. Probar acceso ajeno. | Persiste la misma ficha. Cancelar mantiene datos. La API protege el contenido. |
| P-05 | FE-55 | Registrar dos sesiones de la misma fecha y abrir la segunda. Probar fecha inválida, caso ajeno y sesión 17 en otro caso ficticio. | Orden estable y detalle correcto. No hay escrituras parciales. Se permite la sesión 17. |
| P-06 | FE-56 | Añadir dos tareas a S-A1 y marcar una Realizada. Intentar asociar una sesión de B a A. | Persiste la relación y el cumplimiento. La API rechaza la asociación cruzada. |
| P-07 | FE-7 | Registrar P-A1, reenviar la petición y probar monto inválido, sesión ajena y rol sin permiso. | Persiste un solo pago válido. La API rechaza los otros intentos. |
| P-08 | FE-57 | Abrir A con administración, T1 y T2. Consultar directamente la API. | Administración ve pagos al integrar FE-7. T1 ve el historial clínico sin montos. T2 queda sin acceso. |
| P-09 | FE-6 | Conciliar 12–19 y 1–5 de octubre. Probar fallo de carga y rol no administrativo. | Primer período: 4 casos, 3 sesiones y Bs 225,60. Período vacío: 4 casos, 0 sesiones y Bs 0,00. El error de carga se diferencia de cero. |
| P-10 | FE-35 | En un escenario aparte, reasignar A a T2 y volver a usar la sesión de T1. | Las solicitudes nuevas de T1 pierden acceso. Se conserva la autoría histórica. |

Restaurar los estados de la muestra antes de conciliar. Para probar la sesión 17 o la reasignación, usar un escenario separado.

## Decisiones pendientes

- FE-61: condiciones, estados y evidencia de la constancia.
- FE-66: ficha de referencia y mínimo obligatorio.
- FE-86: cardinalidad de pagos por sesión y métodos admitidos en el alcance de demo.
- FE-55, FE-56 y FE-7: confirmar el identificador de sesión compartido y validar sus relaciones en API.

Registrar por escenario el estado Pendiente, Aprobado, Falló o Bloqueado. FE-97 requiere resultados de ejecución y revisión de los defectos que afecten los criterios de aceptación.

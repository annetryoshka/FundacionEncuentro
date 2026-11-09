# FE-76 · Tareas terapéuticas y cumplimiento

Entregable de análisis para FE-56. La terapeuta autorizada registra actividades desde la sesión de origen y actualiza su cumplimiento.

| Dato | Regla |
|---|---|
| Caso y sesión de origen | La API valida acceso y pertenencia. Una sesión de otro caso no se puede asociar. |
| Descripción | Obligatoria. Guardar texto sin espacios exteriores. |
| Estado | Pendiente al crear. La persona autorizada puede cambiar a Realizada o volver a Pendiente si corrige el registro. |
| Autoría y fechas | Conservar quién creó y cuándo. Registrar quién cambió el cumplimiento y el momento del último cambio. |

**Boceto.** Carpeta → sesión → Tareas → Agregar tarea → Guardar → Cambiar cumplimiento. El historial muestra cada tarea con la sesión a la que pertenece. El esquema base usa un booleano para el cumplimiento. Para implementar el flujo se debe comprobar la relación con sesión y añadir la trazabilidad faltante.

| Ejemplo | Resultado esperado |
|---|---|
| T1 agrega «Actividad de prueba» a la sesión S-A1 del caso A asignado | Tarea Pendiente y visible en la sesión. |
| T1 cambia a Realizada y recarga | Se mantiene el estado y aparece el responsable del cambio. |
| Se envía una descripción vacía o un estado fuera del catálogo | Error de validación. La tarea anterior se conserva. |
| Desde A se intenta asociar una sesión del caso B | La API rechaza la relación y no crea la tarea. |

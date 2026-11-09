# FE-61 · Contexto de origen y constancia

Propuesta funcional para FE-50. Registrar el contexto en la carpeta existente, conservando su identificador, correlativo, origen técnico y clasificación.

| Dato | Regla propuesta |
|---|---|
| Origen de la carpeta | Voluntario o Derivado, solo lectura en esta sección. |
| Procedencia y contexto | Identificar la entidad de procedencia. Si se marca como judicial, mostrar juzgado y distinguir atención clínica e intervención judicial. |
| Detalles judiciales | Referencia y fecha de derivación cuando se disponga de ellas. |
| Constancia Pendiente | Permite registrar el estado en la demo con datos ficticios. |
| Constancia Registrada | Requiere fecha y referencia de evidencia. |
| Constancia No aplica | Requiere justificación. |
| Autoría | El servidor registra quién actualizó y cuándo. Conservar la fecha de la evidencia por separado. |

**Ejemplos con datos ficticios.** El caso B conserva su número después de registrar su contexto. Guardar Registrada sin referencia devuelve error y conserva Pendiente. Guardar fecha y referencia `EVIDENCIA-DEMO` muestra Registrada tras recargar. Una justificación vacía no permite guardar No aplica. La API protege la consulta y escritura de un caso ajeno.

**Pendiente de validar.** Qué evidencia se admite, cuándo aplica cada estado y qué datos operativos pueden registrarse mientras la constancia esté pendiente. La propuesta no define estas reglas para datos reales.

El [esquema base](../../../db/migrations/001_esquema_base.sql) dispone de `contexto_judicial` y `consentimientos`. La implementación debe distinguir estado y justificación de la evidencia referenciada.

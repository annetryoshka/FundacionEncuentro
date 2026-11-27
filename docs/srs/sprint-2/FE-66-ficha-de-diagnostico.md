# FE-66 · Estructura y criterios de la ficha de diagnóstico

Propuesta funcional para FE-13. La ficha vigente se consulta y se edita desde la carpeta autorizada.

| Campo | Propuesta para la demo | Validación |
|---|---|---|
| Fecha de evaluación | Obligatoria | Fecha calendario válida. |
| Evaluación inicial | Obligatoria | Texto con contenido distinto de espacios. |
| Diagnóstico de ingreso | Opcional | Mostrar ausencia explícita cuando el dato no exista. |
| Hipótesis relacional | Opcional | Mostrar ausencia explícita cuando el dato no exista. |
| Autoría y fechas | Datos del servidor | Conservar la creación al editar. Registrar la actualización. |

**Boceto.** Carpeta → Diagnóstico → Crear o Editar → Fecha y campos de evaluación → Guardar o Cancelar. Distinguir ficha ausente de error de carga.

**Ejemplos.** Crear una ficha ficticia con fecha válida, evaluación y campos opcionales vacíos. Recargar y comprobar la misma ficha. Intentar guardar una fecha imposible o evaluación de solo espacios. Cancelar una edición y comprobar que los datos previos se conservan. Guardar una modificación y verificar que conserva ID y autoría de creación. Probar acceso directo por una cuenta ajena.

**Pendiente de validar.** Contrastar los campos mínimos con la ficha vacía de referencia. La [migración base](../../../db/migrations/001_esquema_base.sql) permite múltiples fichas por caso. La implementación debe definir cómo se identifica la ficha vigente y preservar los registros anteriores.

## Aclaración posterior de FE-123 · 26/11/2026

Andrea confirmó evaluación inicial obligatoria y diagnóstico de ingreso opcional. Se implementará `evaluacionInicial` como campo independiente de `comentariosClinicos`, conservando los datos históricos. La lectura de fichas antiguas no se bloquea; su próxima edición debe completar la evaluación. La base integrada e6c89bd todavía exige diagnóstico: esta adenda es el contrato de adaptación. Ver [FE-123](../sprint-3/FE-123-ficha-familiar-y-diagnostico.md), sección 4.

La adaptación posterior de FE-126/127/128 ya está implementada con apoyo de Andrea: campo propio de evaluación, diagnóstico opcional, lectura histórica y edición que solicita la evaluación faltante. La migración 021 amplía las lecturas sin transformar el contenido antiguo. Ver [evidencia de verificación](../../pruebas/sprint-3/evaluacion-inicial.md).

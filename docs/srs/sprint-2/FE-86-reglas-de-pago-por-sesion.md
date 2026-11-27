# FE-86 · Reglas y ejemplos de pago por sesión

Propuesta funcional para FE-7. Administración registra y consulta pagos. El pago se vincula con una sesión del mismo caso.

| Campo | Regla |
|---|---|
| Sesión | Requerida. La API valida que pertenezca al caso seleccionado. |
| Importe | Positivo, en BOB, con hasta dos decimales. |
| Fecha de pago | Fecha calendario válida. Se usa para la conciliación. |
| Método de demo | QR o transferencia. |
| Referencia | Opcional. |
| Autoría y fecha de registro | La API usa la identidad autenticada y el momento del guardado. |

**Ejemplos.** Guardar Bs 75,50 para S-A1, por QR. Repetir la misma solicitud y comprobar que el total sigue en Bs 75,50. Probar cero, negativo, tres decimales y una sesión que pertenece a otro caso. La API rechaza los intentos inválidos y los roles sin permiso financiero.

**Pendiente de validar.** Si se admite uno o varios pagos por sesión y si efectivo entra en esta entrega. La protección ante reintentos se mantiene en ambos modelos. La unicidad por sesión depende de la decisión funcional.

La tabla `pagos` del [esquema base](../../../db/migrations/001_esquema_base.sql) asocia el pago al caso. El desarrollo debe incorporar y verificar la relación con la sesión.

## Revisión de la entrega integrada por Andrea · 26/11/2026

Según confirmación expresa de Andrea en esta sesión, la Fundación ratificó **un pago por sesión, QR o transferencia**. La línea base deja de presentarse como una propuesta pendiente para esas dos decisiones. La persistencia, idempotencia y permisos existentes se mantienen; no se añade efectivo ni cuotas. La corrección/anulación se acepta solo cuando tenga contrato y trazabilidad propios, sin simularla mediante otro POST. Ver [FE-188](../sprint-3/FE-188-decisiones-consentimiento-pagos.md).

## Seguimiento de corrección/anulación para Sprint 4

El 26/11/2026 Andrea dispuso definir en Sprint 4 el procedimiento aún pendiente de corrección/anulación de pagos, registrado en [FE-211](https://andreanarvaezort-1786202493806.atlassian.net/browse/FE-211). Se conservan las reglas ya ratificadas de un pago por sesión y QR/transferencia; un segundo POST con datos distintos no sustituye el pago registrado. Ver [FE-188](../sprint-3/FE-188-decisiones-consentimiento-pagos.md).

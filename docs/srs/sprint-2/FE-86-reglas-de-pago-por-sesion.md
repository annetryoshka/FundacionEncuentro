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

# FE-172 · Gastos y distribución básica de ingresos

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado:** propuesta funcional preparada; ratificación de alcance pendiente.

HU FE-5 · RF-25. El detalle de la SRS deja este alcance por validar. Desbloquea FE-173/174/175/176 cuando se ratifique.

## 1. Decisión de apertura

| Pregunta | Propuesta de trabajo | Estado |
|---|---|---|
| ¿Se requiere registrar gastos en esta entrega? | Registro administrativo mínimo por período. | Pendiente de la Fundación. |
| ¿Cómo se distribuyen ingresos? | Aplicar solo una regla documentada: destinatarios/base/porcentajes o montos y vigencia. | No definida; no inventar reparto entre personas. |
| ¿Se necesita corregir/anular? | Corrección con trazabilidad, sin borrar evidencia. | Por confirmar. |
| ¿Se maneja efectivo? | Coordinar con DEC-P02 de FE-188; no añadirlo solo en contabilidad. | Pendiente. |

Si se descarta el alcance, documentar la exclusión y retirar FE-5 del compromiso. No cerrar como implementado.

## 2. Contrato mínimo propuesto

Gasto: id servidor, fecha válida, concepto requerido, monto BOB positivo de hasta dos decimales, categoría opcional y autoría. El período y la fecha de pago/gasto determinan la conciliación.

Ingresos: derivar de pagos existentes, sin registrar un segundo “ingreso” contable que duplique el mismo pago. Mantener separados ingreso, gasto y saldo.

`saldoPeriodo = ingresosPeriodo - gastosPeriodo`. No confundir saldo con importe distribuible hasta acordar su base.

Propuesta de API nueva: registro/listado de gastos, consulta de totales por período y distribución solo si existe regla vigente. Administración exclusivamente. No facturación, impuestos ni conciliación bancaria automática.

## 3. Ejemplo completamente ficticio

Período 20–21/11/2026, consistente con FE-134:

| Concepto | BOB |
|---|---:|
| Pago A | 75.50 |
| Pago B | 100.00 |
| Ingresos | 175.50 |
| Gasto QA 1 | 25.00 |
| Gasto QA 2 | 10.00 |
| Gastos | 35.00 |
| Saldo | 140.50 |
| Distribución | Sin regla definida. |

Los montos no son tarifas ni gastos reales de la Fundación. Sin regla, la interfaz muestra “Distribución pendiente de definir”; nunca divide el saldo entre tres personas por defecto.

## 4. Aceptación

- Registrar un gasto válido y recargar conserva fecha, monto, concepto y autor.
- Cero, negativo, fecha imposible y tres decimales se rechazan sin redondeo silencioso.
- Cambiar de período cambia las mismas fuentes de detalle y totales.
- Reintentar una petición no debe duplicar el gasto: acordar identificador de solicitud antes de codificar.
- Una corrección conserva evidencia y deja claro su efecto en totales.
- Terapeuta/marketing no obtienen datos financieros por API.
- Una fórmula de reparto se aplica solo tras registrar su aprobación y vigencia.

**Para completar FE-172:** obtener decisión de alcance y regla de distribución verificable. Este documento ya permite preparar modelo, pantalla y conciliación ficticia sin inventar esa regla.

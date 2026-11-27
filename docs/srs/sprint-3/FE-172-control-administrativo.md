# FE-172 · Registro sencillo de gastos mensuales

Responsable: Andrea Carolina Narváez Ortega.

Actualización de alcance: 26/11/2026, a partir de la indicación de Andrea para HU5/FE-5. Sustituye la propuesta anterior de distribución de ingresos. Base de código revisada: main e6c89bd.

## 1. Alcance acordado

Administración registra los gastos de funcionamiento de la Fundación y consulta cuánto se gastó en un mes. Se usa un formulario por gasto; internet, electricidad y alquiler son opciones de un selector, no tres importes que deban completarse juntos.

Categorías iniciales:

| Valor de API | Etiqueta visible |
|---|---|
| `internet` | Internet / Wi-Fi |
| `electricidad` | Electricidad |
| `alquiler` | Alquiler |
| `otros` | Otros gastos |

«Otros gastos» requiere una descripción breve. Se permiten varios gastos de una misma categoría en el mes. El resumen suma los registros vigentes; no presume que cada servicio se paga una única vez.

Esta entrega incluye registro, consulta mensual, corrección y anulación de un gasto equivocado. La distribución de ingresos entre personas sale del alcance de HU5; no existe porcentaje ni cálculo de reparto que el equipo deba esperar para empezar. Tampoco se implementan pagos de servicios ni una contabilidad general.

## 2. Campos mínimos

| Campo | Regla |
|---|---|
| Tipo de gasto (`categoria`) | Obligatorio: internet, electricidad, alquiler u otros. |
| Fecha del gasto (`fecha`) | Obligatoria, calendario válido AAAA-MM-DD, no futura; el mes se deriva de esta fecha. |
| Monto (`monto`) | BOB, positivo, hasta dos decimales, máximo 99999999.99 según numeric(10,2). No redondear silenciosamente un tercer decimal. |
| Descripción (`descripcion`) | Opcional hasta 200 caracteres; obligatoria y distinta de espacios para otros. |
| ID, registrado por y fechas de auditoría | Los asigna el servidor; no se confían al cliente. |
| Estado de anulación | Interno, con autor/fecha; un gasto anulado se conserva pero no suma en el total. |

El formulario muestra moneda fija «Bs». No exige factura, proveedor, cuenta bancaria, número de paciente ni aprobación de una regla de reparto. Guardar desactiva el botón mientras se procesa la solicitud y Cancelar no escribe cambios.

## 3. Pantalla y consulta

Una pantalla de administración contiene «Registrar gasto», selector de mes, tabla (fecha, tipo, descripción, monto y acciones), total del mes y totales por categoría. Un mes sin movimientos muestra lista vacía y Bs 0,00. La confirmación de anulación explica que el registro dejará de sumar; los anulados siguen identificables en la consulta.

La corrección conserva trazabilidad y recalcula el mes afectado; si cambia la fecha a otro mes, el gasto sale del total anterior y entra en el nuevo. El total nunca suma dos veces un mismo ID. Administración es el único rol autorizado, también mediante acceso directo a la API.

## 4. Contrato técnico propuesto para el equipo

Estas rutas todavía no existen en main y se acordarán en FE-173/174:

| Método y ruta | Operación |
|---|---|
| POST `/api/gastos` | Registrar categoría, fecha, monto y descripción. |
| GET `/api/gastos?mes=2026-11` | Devolver lista del mes, totalMes y totalesPorCategoria; por defecto, mes actual en Bolivia. |
| PATCH `/api/gastos/:id` | Corregir los campos de un gasto vigente con auditoría. |
| POST `/api/gastos/:id/anular` | Anular con confirmación; repetir la anulación no vuelve a restar. |

Alejandro parte de `movimientos_contables`: usar `tipo = egreso`, monto, fecha, descripción, categoría y autoría; preparar la ampliación mínima para anular y validar categorías. Un gasto de funcionamiento no lleva pago_id de una sesión. No se transforma en un ingreso ni se registran pagos clínicos duplicados.

Ejemplo de registro ficticio:

```json
{
  "categoria": "internet",
  "fecha": "2026-11-20",
  "monto": "120.00",
  "descripcion": "Servicio mensual ficticio"
}
```

Conservar montos exactos como decimal en API y numeric en SQL. Los detalles de serialización y corrección se revisan entre Alejandro, Emilia y Jorge antes de conectar la pantalla. Usar la auditoría existente; no crear un flujo adicional de aprobaciones.

## 5. Ejemplo de aceptación, completamente ficticio

| Fecha | Tipo | Monto BOB |
|---|---|---:|
| 2026-11-20 | Internet / Wi-Fi | 120.00 |
| 2026-11-21 | Electricidad | 80.00 |
| 2026-11-22 | Alquiler | 1500.00 |
| Total de noviembre | | 1700.00 |

- Corregir electricidad a 85.00 cambia el total a 1705.00.
- Anular internet deja el total en 1585.00; repetir la anulación conserva ese total.
- Consultar diciembre sin gastos muestra 0.00.
- Rechazar monto cero, negativo o con tres decimales, fecha inválida/futura, categoría desconocida y «otros» sin descripción. No dejar escrituras parciales.
- Terapeuta, marketing y visitante no pueden registrar, corregir, anular ni consultar los gastos.

Los importes son inventados para QA: no son costos reales de la Fundación.

## 6. Subtareas y cierre

| Subtarea | Responsable | Entregable |
|---|---|---|
| FE-172 | Andrea | Campos, categorías, reglas y ejemplo de aceptación de este contrato. |
| FE-173 | Alejandro | Persistencia mínima y suma mensual exacta, conservando auditoría. |
| FE-174 | Emilia, revisión de Adriana | API administrativa de registro, consulta, corrección y anulación. |
| FE-175 | Jorge | Formulario, lista mensual y totales con estados de carga/error/vacío. |
| FE-176 | Gemina, revisión de Emilia | Comprobar el ejemplo ficticio, permisos y totales; registrar evidencia. |

La PO ya confirmó el alcance básico. Cada implementación y su verificación siguen pendientes de los entregables respectivos; este documento no certifica la API ni la pantalla como terminadas.

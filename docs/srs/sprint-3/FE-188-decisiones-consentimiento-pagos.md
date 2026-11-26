# FE-188 · Decisiones de consentimiento y pagos

**Responsable:** Andrea Carolina Narváez Ortega.  
**Fecha:** 23/11/2026.  
**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.  
**Estado del entregable:** contrato de análisis preparado; las validaciones pendientes se indican expresamente. No acredita implementación ni pruebas del producto.

HU FE-117. Amplía [FE-61](../sprint-2/FE-61-contexto-y-constancia.md) y [FE-86](../sprint-2/FE-86-reglas-de-pago-por-sesion.md). Desbloquea FE-189, FE-190 y FE-191.

## 1. Comportamiento comprobado en el código

| Tema | Contrato actual de main |
|---|---|
| Constancia | GET/PUT `/api/carpetas/:id/constancia`. |
| Estados de API | `pendiente`, `registrado`, `no_aplica`. Las etiquetas son Pendiente, Registrada y No aplica. |
| Pendiente | No admite fecha, evidencia ni explicación. |
| Registrada | Exige fecha válida y referencia de evidencia; no admite explicación de no aplica. |
| No aplica | Exige explicación; no admite fecha ni evidencia. |
| Judicial | `origenJudicial=true` exige `contextoJudicial.juzgado`; false exige contexto null. El formulario actual ya conserva estos datos. |
| Pagos | Administración registra/consulta. Terapeuta y marketing no reciben montos. |
| Cardinalidad | Un pago por sesión, impuesto por `uq_pagos_sesion`. |
| Métodos de API | `qr` o `transferencia`; el DTO actual no admite efectivo. |
| Dinero | BOB, importe positivo como texto decimal con hasta dos decimales. |
| Reintento | Misma sesión e iguales datos devuelve el pago existente con `reutilizado=true`; datos distintos producen 409. |

Fuentes: [DTO de constancia](../../../backend/src/modules/casos/dto/actualizar-constancia.dto.ts), [servicio](../../../backend/src/modules/casos/casos.service.ts), [DTO de pago](../../../backend/src/modules/casos/dto/registrar-pago.dto.ts), [pagos](../../../backend/src/modules/casos/pagos.service.ts) y [migración 010](../../../db/migrations/010_pagos_por_sesion.sql).

## 2. Registro de decisiones que falta ratificar

| ID | Decisión | Propuesta de trabajo | Estado |
|---|---|---|---|
| DEC-C01 | Evidencia admitida | Referencia privada a documento/archivo y fecha; nunca publicar el consentimiento. Definir quién lo verifica. | Por confirmar con la Fundación. |
| DEC-C02 | Operaciones mientras está pendiente | Mantener el comportamiento actual en desarrollo; definir la política para registrar datos clínicos/familiares reales. No inventar un bloqueo global ni afirmar que ya existe autorización. | Por confirmar. |
| DEC-C03 | Uso de No aplica | Mantener justificación obligatoria y registrar los casos en que la Fundación lo admite. | Por confirmar. |
| DEC-C04 | Edición clínica por administración | Main ya la permite. Mantenerla hasta acordar una política distinta; separar lectura de autorización para modificar. | Por confirmar. |
| DEC-C05 | Familia y genograma | Determinar qué evidencia y alcance cubren la información familiar y los archivos asociados. | Por confirmar. |
| DEC-P01 | Número de pagos por sesión | Mantener un pago, sin cuotas, como línea base técnica. | Implementado; aceptación del negocio pendiente. |
| DEC-P02 | Métodos | Mantener QR/transferencia; confirmar si se requiere efectivo. | Implementado; aceptación del negocio pendiente. |
| DEC-P03 | Corrección de un pago | No usar un segundo POST con otros datos para reemplazarlo. Acordar corrección/anulación con trazabilidad si se necesita. | Por confirmar; no existe aquí una API de corrección acordada. |

Estas propuestas permiten preparar contratos y pruebas con datos ficticios. No constituyen una ratificación de la contraparte. Un cambio a cuotas/múltiples pagos exige revisar modelo, API, formularios, conciliación y estimación antes de implementarlo.

## 3. Ejemplos listos para backend y frontend

Constancia registrada, caso no judicial:

```json
{
  "procedencia": "Referencia ficticia QA",
  "origenJudicial": false,
  "estado": "registrado",
  "fechaConsentimiento": "2026-11-20",
  "referenciaEvidencia": "qa/consentimiento-A",
  "explicacion": null,
  "contextoJudicial": null
}
```

Pago de la sesión S-A1 del caso A:

```json
{
  "sesionId": "00000000-0000-4000-8000-000000000301",
  "monto": "75.50",
  "fecha": "2026-11-20",
  "metodo": "qr",
  "referencia": "QA-PAGO-A1"
}
```

El cliente no envía usuario autor, moneda libre, caso de otra sesión ni indicadores de permiso.

## 4. Aceptación

| Caso | Resultado esperado |
|---|---|
| Pendiente con fecha o evidencia | 400, sin alterar la constancia anterior. |
| Registrada sin evidencia o fecha imposible | 400. |
| No aplica con justificación vacía | 400. |
| Origen judicial sin juzgado | 400; con contexto válido guarda y recarga todos los campos. |
| Terapeuta ajena consulta la constancia | Respuesta que no expone el caso, conforme al contrato existente. |
| Reenviar el mismo pago | Un solo pago y un solo ingreso; `reutilizado=true`. |
| Misma sesión con importe diferente | 409; no reemplaza ni duplica el pago. |
| Cero, negativo, tres decimales o sesión de otro caso | Rechazo sin escritura parcial. |
| Terapeuta o marketing solicita pagos | Denegado; tampoco aparecen montos en el historial clínico. |

## 5. Qué puede avanzar cada persona

- Adriana: contratos y regresión sobre la línea base; cambios de política después de ratificación.
- Jorge: formularios coherentes con los valores actuales; conservar contexto judicial.
- Emilia: matriz de casos e idempotencia/conciliación.
- Andrea: registrar respuesta, responsable, fecha y evidencia de cada DEC.

**Para completar FE-188:** añadir las decisiones reales de la Fundación y actualizar el contrato. Preparar este Markdown no equivale a haberlas obtenido.

# FE-151 · Plantillas de informes y mapeo clínico

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** análisis preparado; no acredita implementación ni validación de la Fundación.

HU FE-15 · RF-16/RF-17. Desbloquea FE-152/153/154/155 y [FE-156](FE-156-exportacion-documentos.md).

## 1. Reglas comunes propuestas

Generar borradores sistémicos y judiciales desde datos seleccionados del caso autorizado. Identificar tipo, caso, fecha, autor y versión de datos usados. La revisión profesional es explícita; una conclusión clínica no se calcula ni se inventa a partir del número de sesiones.

Propuesta de estados: borrador y revisado. Una modificación posterior del expediente no cambia retrospectivamente un informe ya revisado; generar otra versión. Conservar autoría de los ajustes de texto.

## 2. Fuente y edición por sección

| Sección | Fuente propuesta | Edición |
|---|---|---|
| Identificación | Paciente y caso actuales. | Corregir en su registro; no inventar una identidad alternativa en el informe. |
| Datos familiares/genograma | Composición del caso y archivo seleccionado. | Seleccionar inclusión según destinatario/pertinencia; no convertir archivo en texto automáticamente. |
| Evaluación/diagnóstico/hipótesis | Fuente vigente definida en FE-123. | Texto profesional revisable con trazabilidad de la versión. |
| Intervención y evolución | Sesiones y tareas elegidas, en orden estable. | Selección y redacción profesional; conservar procedencia. |
| Conclusiones/recomendaciones | Redacción del profesional responsable. | Manuales; no autocompletar hechos o conclusiones inexistentes. |
| Contexto judicial | Constancia/contexto del caso. | Confirmar en el registro de origen; completar destinatario real cuando corresponda. |
| Datos financieros | Fuera de las dos plantillas clínicas iniciales. | No incluir por defecto. |

La propuesta de estructura debe contrastarse con una plantilla vacía o ficticia de la Fundación. No se recibió un modelo institucional específico de informe clínico/judicial.

## 3. Plantilla A: intervención sistémica

1. Encabezado: Fundación, tipo de informe, identificador de versión y fecha.
2. Identificación del paciente/caso y profesional responsable.
3. Motivo y objetivo de la intervención, solo si están registrados o escritos por el profesional.
4. Contexto familiar y genograma, si se seleccionan.
5. Evaluación inicial, diagnóstico de ingreso e hipótesis relacional disponibles.
6. Intervención realizada: período, sesiones seleccionadas y tareas pertinentes.
7. Evolución observada según registros.
8. Conclusiones y recomendaciones redactadas/revisadas por el profesional.
9. Responsable y estado de revisión.

Los campos no disponibles se muestran como pendientes o sin registro en el borrador. No exigir genograma a todos los casos para producir un borrador.

## 4. Plantilla B: dirigida al juez

1. Encabezado, fecha, destinatario y referencia de solicitud/expediente disponibles.
2. Identificación pertinente del caso y profesional.
3. Objeto/alcance de la respuesta a la solicitud.
4. Antecedentes y período atendido.
5. Intervención y observaciones tomadas de los registros seleccionados.
6. Conclusiones del profesional dentro de lo documentado.
7. Responsable y revisión.

Antes de generar, verificar datos mínimos del destinatario/objeto acordados con la Fundación. No inventar juzgado, número judicial, autorización ni firma. Registrar contexto judicial no equivale a gestionar trámites o resoluciones del juzgado.

## 5. Contrato de generación propuesto

Nuevas operaciones: generar borrador por caso, consultar versión, guardar revisión y solicitar exportación. Propuesta de entrada:

```json
{
  "tipo": "sistemico",
  "fecha": "2026-11-23",
  "sesionesIds": [
    "00000000-0000-4000-8000-000000000301",
    "00000000-0000-4000-8000-000000000302"
  ],
  "incluirFamilia": true,
  "incluirGenograma": true,
  "textoProfesional": {
    "objetivo": "Objetivo ficticio de QA.",
    "conclusiones": null,
    "recomendaciones": null
  }
}
```

El servidor valida que todas las sesiones/archivos pertenezcan al caso y que el solicitante tenga acceso vigente. Los IDs son de demostración.

## 6. Mínimos y aceptación

| Caso | Resultado esperado |
|---|---|
| Caso A con diagnóstico y dos sesiones | El informe cita solo esos registros y conserva su orden. |
| Caso B sin ficha de diagnóstico | Borrador identifica ausencias; no toma datos del caso A. |
| Caso judicial sin destinatario/objeto mínimo | Indica información faltante según plantilla ratificada. |
| Conclusiones no escritas | Permanecen pendientes; no se fabrican. |
| Editar un borrador y revisar | Conserva autor y versión de fuente; no sobrescribe informes anteriores. |
| Cambiar diagnóstico después de revisar | El informe anterior conserva su versión; una nueva generación usa datos nuevos. |
| Terapeuta ajena/marketing | Acceso denegado también por API/descarga. |

**Para completar FE-151:** la Fundación debe validar estructura, mínimos, destinatarios y política de revisión. Las dos plantillas y el mapeo ya están preparados para esa revisión y el diseño técnico.

## Revisión de la entrega integrada por Andrea · 26/11/2026

Implementación efectiva: POST `/api/carpetas/:id/informes`, GET `/:versionId` y PATCH `/:versionId/revision`. El DTO usa **`intervencion_sistemica` o `judicial`**, `sesionesIds`, `incluirFamilia`, `incluirGenograma` y `objeto` opcional. La fecha/autoría se generan en el servidor; los textos profesionales se corrigen en la revisión, no mediante campos adicionales del ejemplo de diseño del apartado 5.

| Plantilla vigente | Mínimos y secciones efectivas |
|---|---|
| `fe151-sistemica-v2` | Nombre de paciente; identificación, profesional, evaluación (evaluación inicial/diagnóstico/hipótesis disponibles), intervención/evolución y conclusiones/recomendaciones pendientes de redacción profesional. |
| `fe151-judicial-v2` | Nombre, juzgado y objeto; destinatario, referencia, identificación, profesional, objeto, evaluación inicial si existe, intervención/observaciones y conclusiones profesionales. |

Fuentes: `plantilla-sistemica.ts`, `plantilla-judicial.ts`, `informe-fotografia.ts` y migración 021. La foto de origen conserva familia/genograma seleccionados; sus metadatos no sustituyen una relación familiar ni una conclusión clínica. Los informes revisados anteriores no se reescriben. No se incluyen pagos en estas plantillas.

Las pruebas de generación/revisión/versiones y permisos están en `backend/test/informes-generacion-postgres.test.mjs` y `frontend/src/features/expediente/informes/Informes.test.tsx`; el recorrido de navegador de FE-196 completa el cotejo funcional. **No se recibió un modelo institucional de informe ni una aprobación de estructura, destinatarios y mínimos por la Fundación.** FE-151 mantiene esa validación externa pendiente. Se entregan las dos estructuras y el mapeo actual sin afirmar una aprobación clínica que no ocurrió.

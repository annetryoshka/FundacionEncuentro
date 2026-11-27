# FE-123 · Ficha familiar y diagnóstico vigente

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** contrato de análisis preparado; las validaciones pendientes se indican expresamente. No acredita implementación ni pruebas del producto.

HU FE-110 · RF-02/RF-08/RF-11. Entrega para Alejandro (FE-125), Adriana (FE-126), Jorge (FE-127), Emilia (FE-128) y el componente de Andrea (FE-124).

## 1. Alcance confirmado

Al abrir la ficha se muestran: datos generales del paciente/caso, composición familiar, genograma y evaluación/diagnóstico; después, el historial de sesiones y tareas. La residencia significa dónde vive el paciente. Cada familiar se identifica por su relación **respecto del paciente**, no respecto de quien llena el formulario.

No crear una carpeta clínica para cada familiar ni enlazar automáticamente personas entre expedientes. El caso mantiene un paciente principal. La atención de varios familiares como pacientes es otra decisión.

## 2. Datos y validaciones propuestas

| Bloque/campo | Regla |
|---|---|
| Paciente | Reutilizar nombre, nacimiento/edad y teléfono existentes; residencia sigue FE-134. Ocupación del paciente es ampliación propuesta de su perfil. |
| Caso | Número, origen, clasificación, fecha de ingreso, estado y terapeuta desde la carpeta actual. |
| Familiar.id | Identificador estable del servidor para editar sin duplicar filas. |
| Familiar.parentesco | Requerido. Catálogo inicial: madre, padre, hermano/a, hijo/a, abuelo/a materno/paterno, tío/a, pareja, tutor/a, otro. Permitir repetición. |
| Nombre del familiar | Si se conoce; desconocido se representa explícitamente, sin inventar un nombre. |
| Fecha de nacimiento | Opcional, calendario válido. |
| Edad referida y fecha de referencia | Alternativa al nacimiento; entero no negativo y fecha obligatoria cuando solo se conoce edad. No sumarla otra vez automáticamente como si fuera edad actual. |
| Ocupación/actividad | Texto opcional: estudiante, conductor, comerciante, etc.; no usar un catálogo de profesiones obligatorio. |
| Trabajo/estudio | Lugar opcional; no exigir empleador ni dirección exacta. |
| Convivencia | Sí/no/desconocido, opcional. |
| Observaciones | Texto pertinente al contexto familiar, opcional y protegido. |
| Autoría | Servidor: creación, última actualización y perfil. |

Límites técnicos propuestos: nombres/lugares hasta 150 caracteres, ocupación hasta 200 y observaciones hasta 2000. Validar estos límites con el formulario de referencia; son reglas de diseño, no datos proporcionados por la Fundación.

## 3. Separar diagnóstico y composición familiar

En main integrado por PR #70 (`e6c89bd`), `diagnosticoIngreso`, `hipotesisRelacional` y `comentariosClinicos` se guardan en `fichas_diagnostico.contenido`; el alta conserva sus columnas clínicas. Desde FE-126, el guardado combina el JSON existente con los campos conocidos del formulario mediante `contenido || excluded.contenido`. Esto conserva claves adicionales; sustituye la descripción de reemplazo completo del corte inicial.

**Matiz del contrato actual:** el servicio siempre construye las tres claves conocidas. Si se omite hipótesis o comentarios, los convierte a `null`; la combinación no conserva automáticamente esos dos campos. Se mantiene el formulario completo por PUT y se preservan las claves adicionales ajenas al formulario. No se convierte este endpoint en un PATCH genérico de JSON.

**Propuesta técnica:** familiares en persistencia propia por caso y guardado independiente; nunca insertar familiares o la referencia del genograma dentro de ese JSON sin adaptar su conservación. El encabezado se construye con datos del paciente/caso, no con una copia libre.

Fuente clínica propuesta para informes: ficha vigente cuando exista; si no existe, valores históricos de alta como antecedente identificado. Un null de una ficha existente no debe rellenarse silenciosamente desde el alta, porque podría representar una corrección intencional. Conservar ambos orígenes y su auditoría; no borrar los datos originales.

## 4. Decisión de Andrea como PO · 26/11/2026

Andrea confirmó en esta conversación: **evaluación inicial obligatoria y diagnóstico de ingreso opcional**. Esta decisión resuelve el pendiente funcional de FE-66/FE-70; la adaptación de código se realizó con apoyo de Andrea y su evidencia está en [evaluacion-inicial.md](../../pruebas/sprint-3/evaluacion-inicial.md). La decisión de la PO se distingue de una validación externa de la Fundación.

| Campo | Versión anterior e6c89bd | Contrato implementado en esta entrega |
|---|---|---|
| Fecha de evaluación | Obligatoria | Obligatoria y calendario válido. |
| `evaluacionInicial` | No tiene campo independiente. | Texto obligatorio, distinto de espacios, hasta 10000 caracteres. |
| `diagnosticoIngreso` | Obligatorio | Opcional; vacío se representa como `null`. |
| `hipotesisRelacional` | Opcional | Opcional, hasta 10000 caracteres; vacío = `null`. |
| `comentariosClinicos` | Opcional | Campo independiente opcional; no sustituye la evaluación inicial. |

**Ejemplo ficticio:** se debe poder guardar la evaluación «Evaluación inicial ficticia: entrevista de ingreso realizada» sin formular todavía un diagnóstico. Una evaluación vacía debe rechazarse incluso si se escribió un diagnóstico.

Reglas para la adaptación:

- La evaluación inicial se añade como campo propio del JSON. No renombrar ni copiar automáticamente comentarios o diagnósticos históricos: su significado no es equivalente.
- Las fichas antiguas siguen siendo legibles; la pantalla muestra «Sin evaluación inicial registrada». Al guardar una edición con el contrato nuevo, se solicita completar la evaluación.
- El PUT recibe el formulario completo: evaluación, diagnóstico, hipótesis y comentarios. El frontend envía `null` para limpiar opcionales; se conserva la combinación del JSON para proteger claves adicionales del servidor.
- Se conservan ID, creación, autoría, familia y genograma. Una ficha vigente con diagnóstico `null` no se completa desde los datos del alta.
- Andrea completó como apoyo DTO, servicio, migración 021, fuente clínica, historial, informes/exportaciones, formulario, tipos, resumen, simulador y pruebas. Los commits FE-126/127/128 identifican cada parte; los responsables originales conservan la trazabilidad de su trabajo previo.
- La API de esta entrega exige evaluación y admite diagnóstico vacío/null. La lectura antigua permanece disponible; la edición solicita evaluación. Para desplegar sobre la base existente, aplicar primero 021_evaluacion_inicial.sql. No se rellenan fichas históricas con textos inventados.

Aceptación adicional: guardar con evaluación y diagnóstico ausente; rechazar evaluación vacía; conservar opcionales y claves adicionales al editar; limpiar un diagnóstico con `null`; leer una ficha antigua sin perder datos; comprobar permisos y recarga; conservar la evaluación en historial, informe y exportación cuando esa sección se incluya.

## 5. Contrato nuevo propuesto

GET/PUT `/api/carpetas/:id/familia` ya están integradas por FE-126. GET distingue ausencia de ficha familiar de familia registrada sin miembros. PUT exige la versión recibida; una versión desactualizada devuelve 409. Los IDs son estables, el guardado es transaccional y la eliminación es explícita mediante `eliminarIds`. El contrato técnico completo está en `docs/api/contrato-frontend-backend.md`.

Ejemplo conceptual ficticio del paciente A, de 12 años (ilustra la composición; no es el cuerpo literal del PUT):

```json
{
  "pacienteId": "00000000-0000-4000-8000-000000000011",
  "casoId": "00000000-0000-4000-8000-000000000101",
  "familiares": [
    {
      "id": null,
      "nombreCompleto": "Padre QA",
      "parentesco": "padre",
      "fechaNacimiento": null,
      "edadReferida": 44,
      "fechaReferencia": "2026-11-20",
      "ocupacion": "Conductor",
      "lugarTrabajoEstudio": "Empresa ficticia",
      "conviveConPaciente": true
    },
    {
      "id": null,
      "nombreCompleto": "Hermana QA",
      "parentesco": "hermana",
      "fechaNacimiento": null,
      "edadReferida": 8,
      "fechaReferencia": "2026-11-20",
      "ocupacion": "Estudiante",
      "lugarTrabajoEstudio": null,
      "conviveConPaciente": true
    }
  ]
}
```

## 6. Dos fichas de aceptación

| Caso | Contenido | Esperado |
|---|---|---|
| A | Paciente de 12 años; padre de 44, madre de 41, hermana de 8, abuela materna de 68; genograma disponible. | Resumen visible primero; relaciones respecto del paciente; no convertir al padre en “hijo”. |
| B | Paciente adulto; hijo/a estudiante, dos tíos, nacimiento desconocido de un abuelo; sin genograma. | Lista repetible, desconocidos claros y “Sin genograma”; no bloquear el historial. |

## 7. Permisos y aceptación

Administración y terapeuta asignada mantienen el acceso clínico actual; terapeuta ajena/marketing/sin sesión no acceden a familiares ni por API. Cualquier cambio de política se registra en FE-188.

- Crear, recargar y editar un familiar conserva los demás, el diagnóstico y el genograma.
- Cancelar no modifica el caso.
- Una lista vacía se diferencia de un fallo de red.
- Datos inválidos no dejan escrituras parciales.
- Un cambio del diagnóstico no borra familiares.
- Una edición concurrente debe evitar sobrescribir silenciosamente cambios ajenos; acordar versión/fecha de control en API.
- El resumen funciona en móvil sin convertir los datos en texto ilegible.

**Pendiente para cierre:** contrastar campos con ficha de referencia o caso ficticio validado por la Fundación y registrar la validación externa. La adaptación de la regla acordada ya cuenta con evidencia local; el despliegue de la 021 en Supabase sigue el procedimiento de la base.

## Revisión de la entrega integrada por Andrea · 26/11/2026

La decisión de mínimo clínico ya tiene implementación en `main` por PR #73 (`18ae1cf`): evaluación obligatoria independiente, diagnóstico opcional, lectura histórica sin reinterpretación y combinación del JSON que conserva claves adicionales. La migración 021 no rellena ni renombra fichas antiguas; debe aplicarse en Supabase antes de iniciar la API actualizada. Ver [evidencia de ejecución](../../pruebas/sprint-3/evaluacion-inicial.md).

FE-124 completa el resumen con parentesco, edad/referencia temporal, ocupación y lugar de trabajo/estudio, datos desconocidos y acceso a todos los integrantes. Los datos generales de la carpeta preceden a familia, genograma y evaluación/historial. No hay una carpeta nueva por cada familiar ni sincronización automática con una imagen de GenoPro.

La revisión técnica y las fichas ficticias A/B permiten probar el contrato. **Sigue pendiente recibir/contrastar la ficha de referencia de la Fundación y registrar su validación externa.** No se vuelve a solicitar la decisión de evaluación/diagnóstico ya confirmada. Esa única validación documental pendiente se conserva en FE-123 sin pedir rehacer FE-126/127/128.

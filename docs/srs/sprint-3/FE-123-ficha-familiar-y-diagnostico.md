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

Main guarda `diagnosticoIngreso`, `hipotesisRelacional` y `comentariosClinicos` en `fichas_diagnostico.contenido`; el alta también admite columnas clínicas en `casos`. El guardado de diagnóstico reemplaza el JSON.

**Propuesta técnica:** familiares en persistencia propia por caso y guardado independiente; nunca insertar familiares o la referencia del genograma dentro de ese JSON sin adaptar su conservación. El encabezado se construye con datos del paciente/caso, no con una copia libre.

Fuente clínica propuesta para informes: ficha vigente cuando exista; si no existe, valores históricos de alta como antecedente identificado. Un null de una ficha existente no debe rellenarse silenciosamente desde el alta, porque podría representar una corrección intencional. Conservar ambos orígenes y su auditoría; no borrar los datos originales.

## 4. Diferencia FE-66 / API: decisión pendiente

| Elemento | FE-66 | Main |
|---|---|---|
| Evaluación inicial | Obligatoria | No tiene campo independiente. |
| Diagnóstico de ingreso | Opcional | Obligatorio al guardar ficha. |
| Comentarios clínicos | No era el campo mínimo definido | Opcional. |
| Edición por administración | Sin definición expresa en FE-66 | Permitida. |

Propuesta a ratificar: evaluación inicial con texto obligatorio para una ficha completa; diagnóstico de ingreso opcional cuando aún no se dispone de él; hipótesis/comentarios opcionales. **Hasta acordar la transición, la API actual conserva su contrato.** La implementación de familiares puede avanzar separada. No renombrar automáticamente comentarios antiguos como evaluación inicial ni impedir leer registros históricos.

## 5. Contrato nuevo propuesto

GET/PUT `/api/carpetas/:id/familia`; son rutas de diseño, todavía no existen. GET distingue ausencia de ficha familiar de familia registrada sin miembros. PUT usa IDs estables y actualización transaccional. Una omisión de integrantes no se interpreta como borrado sin una acción explícita definida en el contrato final.

Ejemplo ficticio del paciente A, de 12 años:

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

**Pendiente para cierre:** contrastar campos con ficha vacía o caso ficticio validado por la Fundación; acordar mínimo clínico y transición de fuente. No se recibieron esos insumos en esta entrega.

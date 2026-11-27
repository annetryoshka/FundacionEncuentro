# FE-124 · Resumen familiar

Responsable de esta ampliación: Andrea Carolina Narváez Ortega. Corte: 26/11/2026. Base integrada: `18ae1cf`.

Se reutiliza el contexto de la carpeta que Jorge implementó en FE-127. El nuevo componente `ResumenFamilia` agrega ocupación y lugar de trabajo/estudio junto al parentesco, nombre y edad. Los datos generales del paciente permanecen antes de ese contexto; familia, genograma y evaluación permanecen antes del historial.

El resumen muestra cuatro integrantes inicialmente y permite consultar todos sin salir de la ficha. Las edades referidas conservan su fecha; los datos desconocidos se distinguen sin inventarlos. No se copian observaciones sensibles al resumen ni se escribe al expandirlo. Cada bloque mantiene su carga/error independiente y los enlaces al detalle existente.

Verificación ejecutada: `ResumenFamilia.test.tsx`, `Familia.test.tsx` y `FamiliaQA.test.tsx`: **25 pruebas aprobadas**. Incluyen parentescos, edad referida, ocupación/trabajo, datos desconocidos, expansión, familia vacía, orden del expediente, cancelación, conflicto, permisos y cierre local. Son pruebas de interfaz con API simulada; no se atribuye una nueva revisión humana a Jorge ni una validación externa a la Fundación.

La aceptación integrada y la revisión de escritorio/móvil de la entrega se registran por separado en FE-196.

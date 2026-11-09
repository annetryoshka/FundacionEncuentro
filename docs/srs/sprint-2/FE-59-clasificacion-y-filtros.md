# FE-59 · Clasificación, estados y filtros

Entregable de análisis para FE-14. Contrato comprobado en el código de `main` en `41510fe`.

| Dato | Valores | Etiqueta |
|---|---|---|
| `tipo` | `voluntario`, `derivado` | Origen. El correlativo pertenece a su origen. |
| `clasificacion` | `social`, `privado`; `null` en registros sin clasificar | Social, Privado, Sin clasificar. |
| `estado` | `iniciado`, `en_proceso`, `concluido` | Iniciado, En proceso, En conclusión. |

El contexto judicial se registra en la carpeta como información separada. Actualizar clasificación o estado conserva UUID, origen, número, paciente y terapeuta asignada.

| Operación | Ruta y parámetros |
|---|---|
| Listar carpetas autorizadas | `GET /api/carpetas` con `busqueda`, `clasificacion`, `estado`, `pagina` y `tamano`. |
| Consultar detalle | `GET /api/carpetas/:id`, donde `:id` es el UUID de carpeta. |
| Guardar clasificación | `PATCH /api/carpetas/:id/clasificacion` con `{"clasificacion":"social"}`. |
| Guardar estado | `PATCH /api/casos/:id/estado` con `{"estado":"en_proceso"}`. |

Los filtros se aplican juntos sobre los casos autorizados. Para «Todos» se omite el parámetro correspondiente y el listado incluye las carpetas sin clasificación. Al cambiar búsqueda o filtros, la UI vuelve a página 1. El backend registra autor y fecha de cada escritura. Los dos guardados son independientes y la UI muestra el resultado de cada uno.

## Ejemplos de aceptación

Usar A (voluntario 101, social, iniciado, T1), B (derivado 101, privado, en proceso, T2), C (voluntario 102, sin clasificar, concluido, sin asignación) y D (voluntario 103, social, iniciado, T1, ingreso posterior a A). Son datos ficticios.

| Acción | Resultado esperado |
|---|---|
| Administración busca 101 sin filtros | A y B, cada uno identificado con su origen. |
| T1 busca 101 | Solo A. El total también excluye B. |
| Administración filtra Social e Iniciado con tamaño 1 | D en página 1 y A en página 2, total 2 en ambas. |
| T1 filtra Privado y En proceso | Lista vacía, total 0. |
| Administración cambia únicamente la clasificación de A y recarga | Cambia clasificación y se conserva el resto de la carpeta. |
| Enviar `clasificacion=judicial` o `estado=en_conclusion` | 400. Una escritura inválida conserva los datos previos. |
| T1 intenta actualizar B o marketing intenta clasificar A | 404 y 403, respectivamente. |

Fuentes de código: [listado y clasificación](../../../backend/src/modules/casos/carpetas.controller.ts), [actualización de estado](../../../backend/src/modules/casos/casos.controller.ts) y [migración de clasificación](../../../db/migrations/004_clasificacion_casos.sql). La comprobación de la interfaz completa corresponde a FE-47 y FE-49.

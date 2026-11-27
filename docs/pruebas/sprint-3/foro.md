# FE-185 — Investigaciones públicas: contenido y verificación

HU FE-116 · Responsable: Gemina Ponce · Revisión: Emilia · Contrato: [FE-182](../../srs/sprint-3/FE-182-investigaciones-publicas.md)

**Alcance ratificado (26/11/2026): artículos públicos gestionados por administración y marketing, sin comentarios.** La parte de moderación de comentarios de la tarea original queda fuera.

**Estado al 2026-11-26** (`main` en `c806c34`): la publicación y lectura de artículos **no está integrada** (FE-183, FE-184 y FE-187; acta FE-196). Solo existen los componentes de listado y tarjeta (FE-186).

## Contenido de prueba

[articulos-demostracion.json](../../contenido/investigaciones/articulos-demostracion.json): tres artículos inventados (publicado, borrador y retirado), marcados `[DEMO QA]`. No hay contenido autorizado de la Fundación.

## Verificación

| # | Caso (FE-182) | Resultado esperado | Estado |
| --- | --- | --- | --- |
| 1 | Tarjeta y listado muestran título, resumen, autor autorizado y fecha | Se muestran como texto | Cubierto por las pruebas de componentes (`Investigaciones.test.tsx`), no contra la API |
| 2 | Sin artículos | Estado vacío, no error | Cubierto por pruebas de componentes |
| 3 | Sin comentarios habilitados | No hay formulario ni envío | Cubierto en la tarjeta; falta comprobar la API cuando exista |
| 4 | I2 (borrador) por listado y URL pública | No aparece | **Bloqueado** |
| 5 | I3 (retirado) por listado y URL pública | No aparece; no encontrado | **Bloqueado** |
| 6 | Administración o marketing publica I1 | Visible con el contenido aprobado | **Bloqueado** |
| 7 | Terapeuta y visitante intentan crear, publicar o retirar | Denegado, también contra la API | **Bloqueado** |
| 8 | Texto inválido o excesivo | Rechazado sin publicarse | **Bloqueado** |
| 9 | El artículo público no expone datos clínicos ni borradores | Solo campos permitidos | **Bloqueado** |

## Hallazgos

Ninguno todavía: los casos 4 a 9 no se pueden ejecutar hasta que exista el flujo.

## Pendiente

Ejecutar los casos bloqueados, anotar el commit probado y pedir la revisión de Emilia.

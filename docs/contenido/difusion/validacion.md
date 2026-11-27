# FE-147 — Revisión del contenido público

HU FE-113 · Responsable: Gemina Ponce · Corte: 2026-11-26, `main` en `c806c34`

## 1. Contraste de lo publicado con lo autorizado

Página pública `/fundacion` (`frontend/src/features/publico/institucional.ts`) frente al [registro de autorización](registro-autorizacion.md).

| Elemento | En la aplicación | Autorización | Resultado |
| --- | --- | --- | --- |
| Descripción y servicio | «Centro de atención terapéutica en La Paz, Bolivia, que brinda intervención psicológica con enfoque sistémico a personas, parejas y familias.» | Fila 7: Andrea (PO), 2026-11-26 | Coincide |
| Teléfono | +591 77263336 | Fila 8 | Coincide |
| Dirección | Calle 11 de Obrajes Nº 169, frente al colegio "Linderman" | Fila 8 | Coincide |
| Correo, redes, precios, horarios, imágenes | No se muestran | No autorizados | Correcto que no aparezcan |

## 2. Sin datos de pacientes

| Comprobación | Resultado |
| --- | --- |
| El contenido institucional son constantes fijas, sin datos de casos | Cumple |
| La carpeta `features/publico` no consulta carpetas ni casos (la única mención a `/api/carpetas` es una prueba que exige cero llamadas) | Cumple |
| Pruebas de `features/publico` | 23 aprobadas, 0 fallidas (con API simulada) |
| Publicaciones de demostración marcadas `[DEMO QA]` y sin datos de pacientes | Cumple ([publicaciones-demostracion.json](publicaciones-demostracion.json)) |

## 3. Correcciones

No se encontraron diferencias entre lo publicado y lo autorizado.

## 4. Conformidad para publicar

| Quién | Qué autorizó | Estado |
| --- | --- | --- |
| Andrea Narváez (PO) | Descripción, servicio, teléfono y dirección | Registrado (2026-11-26) |
| Fundación Encuentro (dirección) | Revisión del contenido público | **Pendiente: no consta una revisión con la Fundación** |
| Fundación Encuentro | Imágenes, redes, correo y publicaciones reales | **Pendiente** |

La autorización de la PO no se presenta como una aprobación de la Fundación. Antes de publicar contenido real adicional se anota su autorización en el registro.

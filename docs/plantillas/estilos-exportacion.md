# FE-157 — Estilos de las plantillas exportables (PDF y Word)

HU FE-114 · RF-18 · Responsable: Gemina Ponce · Revisión pendiente: Jorge y Andrea

Aplicado en `backend/src/modules/exportaciones/` (`estilos-exportacion.ts`, `generar-pdf.ts`, `generar-docx.ts`). Solo cambia la presentación: los datos exportados y los permisos son los mismos.

## Criterios de legibilidad

| Elemento | Criterio |
| --- | --- |
| Encabezado | «Fundación Encuentro» en verde oscuro, aviso «Documento confidencial» y línea naranja, en todas las páginas |
| Título | Verde oscuro, destacado |
| Tabla | Columnas Campo (34 %) y Valor; cabecera verde con texto blanco que se repite al pasar de página; filas alternas en crema; bordes suaves |
| Texto | Calibri 11 en Word, Helvetica en PDF; se respetan los saltos de línea escritos |
| Texto más largo que una página | En PDF sale de la tabla y fluye con su rótulo; en Word la celda se divide entre páginas |
| Pie | «Página N de M» |

Colores iguales a los de la interfaz (`frontend/src/index.css`).

## Muestras (datos inventados)

En [muestras/](muestras/): `historial-ficticio` (varias páginas, con un texto muy largo) e `informe-ficticio`, cada una en PDF y DOCX. Se regeneran con [generar-muestras.mjs](generar-muestras.mjs):

```
cd backend
npm run build
node ../docs/plantillas/generar-muestras.mjs
```

## Comprobado y pendiente (2026-11-26)

| Comprobación | Estado |
| --- | --- |
| Compilación y pruebas unitarias de exportación | Hecho |
| Revisión visual del PDF de 4 páginas | Hecho |
| Apertura del DOCX en Microsoft Word | **Pendiente** |
| Revisión de Jorge y Andrea | **Pendiente** |
| Validación institucional de la presentación por la Fundación | **Pendiente** |

## Observaciones para el equipo (no modificadas aquí)

- Algunos valores salen como código interno (`en_proceso`, `social`, `voluntario`, fechas `AAAA-MM-DD`). Convertirlos a texto legible cambia el contenido que arma `armar-documento-exportable.ts`; conviene decidirlo con quien lo mantiene.
- La inserción gráfica del genograma en las exportaciones, señalada en el acta FE-196, no es parte de FE-157 y sigue pendiente.

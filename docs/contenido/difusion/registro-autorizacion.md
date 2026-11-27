# FE-141 — Registro de procedencia y autorización del contenido

Cada contenido que llegue al portal público se anota aquí con su origen y quién lo autorizó. Una fila sin autorización registrada **no se publica** en un entorno real.

| # | Contenido | Origen | Autorizado por | Fecha | Canal de la autorización | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Presentación de la Fundación (contenido-institucional.md, apartado 1) | Documentación del proyecto | | | | Pendiente |
| 2 | Servicios (apartado 2) | Documentación del proyecto | | | | Pendiente |
| 3 | Contactos institucionales (apartado 3) | La Fundación | | | | Pendiente: aún no se entregan |
| 4 | Imágenes | La Fundación | | | | Pendiente: aún no se entregan |
| 5 | Campaña, actividad y curso reales | La Fundación | | | | Pendiente |
| 6 | Publicaciones de demostración (6, marcadas `[DEMO QA]`) | Redactadas por el equipo | No requiere: es contenido ficticio | 2026-11-25 | — | Solo para QA, nunca en producción |
| 7 | Descripción: «Centro de atención terapéutica en La Paz, Bolivia, que brinda intervención psicológica con enfoque sistémico a personas, parejas y familias»; servicio limitado a esa descripción. | Borrador presentado a la PO | Andrea Carolina Narváez Ortega (PO) | 2026-11-26 | Respuesta expresa en la sesión de trabajo: «Autorizar texto, teléfono y dirección». | Autorizado; sustituye el estado pendiente de las filas 1 y 2 solo para este texto. |
| 8 | Teléfono +591 77263336 y dirección Calle 11 de Obrajes Nº 169, frente al colegio Linderman. | Afiche ya usado en `frontend/src/componentes/marca.tsx`, contrastado con Andrea. | Andrea Carolina Narváez Ortega (PO) | 2026-11-26 | Misma respuesta expresa. | Autorizados; sustituye fila 3 solo para teléfono/dirección. No incluye correo ni redes. |

Esta constancia registra la autorización de la PO; no inventa una reunión, firma ni aprobación de otra persona de la Fundación. Imágenes, investigación institucional, tarifas, horarios, redes y publicaciones reales adicionales siguen pendientes.

## Comprobaciones antes de publicar contenido real

- [ ] No contiene nombres, fotos, casos, familiares ni domicilios de pacientes.
- [ ] Los contactos son canales institucionales verificados.
- [ ] Cada imagen tiene autorización y texto alternativo.
- [ ] Hay constancia (mensaje o acta) de quién aprobó y cuándo.

# FE-182 · Publicaciones de investigación y moderación

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado:** propuesta funcional preparada; ratificación de alcance pendiente.

HU FE-116 · RF-26/N-20. Alcance inicialmente Could y pendiente de validación. Desbloquea FE-183/184/185/186/187 si se ratifica.

## 1. Diferenciar tres capacidades

- Difusión institucional: servicios, campañas, actividades y cursos, FE-140.
- Investigación privada: categorías y exportación protegida para Atlas.ti, FE-167.
- Publicación pública de investigaciones: contenido expresamente autorizado para visitantes, esta HU.

El portal no publica automáticamente documentos exportados desde expedientes ni se conecta a la base clínica para mostrar casos.

## 2. Decisiones pendientes

| Decisión | Propuesta |
|---|---|
| Publicar investigaciones en Sprint 3 | Ratificar con la Fundación. Si se descarta, excluir con trazabilidad. |
| Quién publica/modera | Administración y marketing sobre contenido autorizado; no atribuir acceso clínico adicional a marketing. |
| Comentarios de visitantes | Deshabilitados hasta que la Fundación confirme que los necesita y quién los atenderá. |
| Revisión de contenido | Verificación previa del responsable; no publicar datos identificables de pacientes. |

No declarar un foro completo si únicamente se implementa un listado de artículos y la participación no fue aprobada. Registrar el alcance final.

## 3. Estructura propuesta de la publicación

Título, resumen, contenido público, autor visible autorizado, imagen opcional, fecha de publicación y estado borrador/publicado/retirado. El estado y la exposición siguen el contrato de difusión de FE-140.

La base dispone de publicaciones/comentarios de foro, pero falta el flujo. Reutilizar estructuras solo después de revisar si sus campos cubren estado y moderación.

## 4. Si se ratifican comentarios

- Recibir texto y alias propuestos; no exigir cuenta clínica ni recopilar datos de pacientes.
- Estados: pendiente, aprobado, rechazado.
- Todo envío nace pendiente; solo aprobado se devuelve por API pública.
- Validar longitud y contenido; límites técnicos iniciales propuestos: alias 80 y comentario 2000 caracteres.
- Administración/marketing autorizados aprueban/rechazan y dejan trazabilidad.
- El visitante no puede elegir estado, autor moderador ni identificador de otra publicación.
- Definir una limitación de envíos y manejo de abuso antes de habilitar el formulario.
- No presentar el espacio como un canal de atención terapéutica.

## 5. API y pantalla propuestas

Lectura pública de artículos publicados y comentarios aprobados. Gestión autenticada de publicaciones y moderación. Recepción de comentarios solo cuando la participación esté habilitada.

Pantallas: listado, detalle y, si corresponde, formulario de comentario con aviso de revisión; panel de pendientes para moderación. Reutilizar componentes públicos sin mezclar borradores ni datos clínicos.

## 6. Aceptación

| Caso | Resultado esperado |
|---|---|
| Publicación en borrador o retirada | No aparece por listado ni URL pública. |
| Publicación autorizada publicada | Visible con contenido aprobado. |
| Comentarios no habilitados | No se ofrece formulario ni API pública de envío activa. |
| Comentario nuevo | Pendiente e invisible hasta aprobación. |
| Comentario rechazado | No visible públicamente; conserva decisión interna. |
| Visitante intenta aprobar | Denegado. |
| Texto inválido o excesivo | Rechazado sin publicarse. |

**Para completar FE-182:** registrar decisión de alcance, participación, perfiles responsables y política de contenido. No se obtuvo esa ratificación en esta entrega.

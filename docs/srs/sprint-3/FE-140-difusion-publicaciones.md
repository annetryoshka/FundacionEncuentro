# FE-140 · Campos, estados y permisos de difusión

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** contrato de análisis preparado; las validaciones pendientes se indican expresamente. No acredita implementación ni pruebas del producto.

HU FE-112 y FE-113 · N-18. Desbloquea FE-141/142/143/144/145 y la página pública.

## 1. Resultado

Marketing/administración crean publicaciones del portal propio; visitantes consultan únicamente lo publicado. Campaña, actividad y curso comparten estructura. Un curso o taller se representa inicialmente con el tipo `curso` y etiqueta visible acordada; no implica inscripción, cobro o reserva de citas.

## 2. Campos propuestos

| Campo | Regla |
|---|---|
| `id` | Servidor. |
| `tipo` | `campana`, `actividad`, `curso`. |
| `titulo` | Requerido, no solo espacios, hasta 150 caracteres. |
| `resumen` | Breve descripción pública; propuesta: hasta 500 caracteres. |
| `contenido` | Texto descriptivo; formato controlado, sin HTML ejecutable. |
| `imagen` | Recurso público autorizado y texto alternativo; no reutilizar almacenamiento clínico. |
| `fechaInicio`, `fechaFin` | Opcionales según tipo; fin no anterior a inicio. |
| `modalidad` / `lugar` | Según actividad: presencial, virtual o mixta; no direcciones de pacientes. |
| `contactoUrl` | Canal institucional verificado; URL http/https, sin contactos inventados. |
| `estado` | `borrador`, `publicado`, `retirado`. |
| Autoría y publicación | Datos del servidor; distinguir fecha de publicación de fecha de la actividad. |

Límites técnicos y campos mínimos por tipo son propuesta de diseño a ratificar con el contenido de FE-141.

## 3. Estados y exposición

| Transición | Acción y resultado |
|---|---|
| Crear → borrador | Guarda para revisión, invisible en API pública. |
| Borrador → publicado | Valida mínimos y confirmación de contenido; aparece en listado/detalle. |
| Publicado → publicado | Edita contenido conservando autoría/historia. |
| Publicado → retirado | Deja de aparecer; su URL pública responde no encontrado. |
| Retirado → borrador | Permite corregir antes de volver a publicar explícitamente. |

No hay programación automática de publicación en este alcance. Una actividad puede tener fecha futura sin ser una publicación programada. No borrar automáticamente publicaciones al terminar una actividad.

## 4. Permisos

| Acción | Administración | Marketing | Terapeuta | Visitante |
|---|---|---|---|---|
| Crear/editar/publicar/retirar | Sí | Sí | No, salvo otra autorización acordada. | No |
| Consultar borradores | Sí | Sí | No | No |
| Consultar publicados | Sí | Sí | Sí, como visitante. | Sí |
| Consultar ficha clínica | Según rol actual. | No | Solo asignadas. | No |

No agregar un rol nuevo para resolver la difusión.

## 5. API propuesta, aún no implementada

- Administración de contenido: GET/POST `/api/difusion/publicaciones`; GET/PUT `/:id` y cambio explícito de estado.
- Consulta pública: GET `/api/publico/publicaciones` y GET `/:id`, con lista de campos permitidos.
- Filtros públicos por tipo y paginación, sin permitir “estado=borrador” ni filtros que devuelvan datos internos.
- La portada/servicios/contacto no debe extraer información de expedientes. Su fuente se prepara en FE-141.

Ejemplo de demostración, sin publicación institucional real:

```json
{
  "tipo": "actividad",
  "titulo": "Actividad ficticia QA",
  "resumen": "Texto de prueba para revisar el portal.",
  "contenido": "Ejemplo sin datos de pacientes.",
  "fechaInicio": "2026-12-01",
  "fechaFin": "2026-12-01",
  "modalidad": "presencial",
  "lugar": "Lugar ficticio de QA",
  "contactoUrl": null,
  "estado": "borrador"
}
```

## 6. Aceptación y entrega

1. Marketing crea/edita un borrador y lo recarga sin que aparezca públicamente.
2. Publicar incompleto informa campos pendientes y conserva el borrador.
3. Publicar válido muestra exactamente el contenido seleccionado.
4. Retirar lo oculta por listado y acceso directo.
5. Un fallo de imagen no pierde el texto; el usuario ve estado claro.
6. Sin publicaciones se muestra vacío, no una pantalla de error.
7. Marketing no obtiene expedientes, pagos, familiares ni archivos clínicos.

**Pendiente:** FE-141 debe aportar textos institucionales, contactos e imágenes autorizadas. Aquí no se afirma que la Fundación ya aprobó contenidos o canales.

## Revisión de la entrega integrada por Andrea · 26/11/2026

El contrato está implementado en `DifusionAdminController` y `DifusionPublicaController`. Gestión autenticada en `/api/difusion/publicaciones`; lectura pública en `/api/publico/publicaciones`. Administración/marketing gestionan borrador/publicado/retirado; la terapeuta no obtiene por ese motivo permisos de difusión. Listado y URL pública ocultan borradores y retiradas.

La interfaz realiza creación/edición, validación de datos, cambios de estado y tratamiento de conflicto. La regresión está en `frontend/src/features/difusion/Difusion.test.tsx` y `backend/test/difusion-api-postgres.test.mjs`; forma parte de la entrega integrada verificada. La autorización no depende solo de ocultar botones: la API aplica roles y permisos públicos por separado.

Andrea autorizó en esta sesión la descripción del centro, el teléfono y la dirección. Se implementan en `/fundacion` mediante FE-146 y se registran en `docs/contenido/difusion/registro-autorizacion.md`. No se extiende esa autorización a nuevas imágenes, redes, tarifas ni publicaciones reales. Los contenidos `[DEMO QA]` siguen siendo solo de pruebas. Campos, estados, roles y sus criterios quedan definidos; las aprobaciones de cada publicación futura pertenecen a su gestión de contenido, no a redefinir este contrato.

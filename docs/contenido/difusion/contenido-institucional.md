# FE-141 — Contenido institucional del portal público

Tarea: FE-141 (HU FE-112) · Responsable: Gemina Ponce · Contrato: [FE-140](../../srs/sprint-3/FE-140-difusion-publicaciones.md) (rama `docs/andrea-sprint3-contratos`)

Este documento organiza el texto de la portada, los servicios y el contacto. **Ningún texto de esta página está aprobado por la Fundación**: los borradores se redactaron a partir de la documentación del proyecto, y el contenido real se publica solo cuando se registre su autorización en [registro-autorizacion.md](registro-autorizacion.md). No se incluyen datos de pacientes, expedientes ni domicilios particulares.

## 1. Portada y presentación

| Elemento | Borrador (pendiente de aprobación) | Fuente |
| --- | --- | --- |
| Nombre | Fundación Encuentro | Minuta ENT-001 |
| Descripción | Centro de atención terapéutica en La Paz, Bolivia, que brinda intervención psicológica con enfoque sistémico a personas, parejas y familias. | Documento del grupo, apartado 1.1.1 |
| Investigación | Además de la atención clínica, realiza labores de investigación y sistematización cualitativa. | Documento del grupo, apartado 1.1.1 |

## 2. Servicios

| Servicio | Borrador | Estado |
| --- | --- | --- |
| Atención psicológica sistémica individual, de pareja y familiar | Redacción tomada del documento del grupo | Pendiente de aprobación |
| Otros servicios, tarifas, horarios | **Sin información** | La Fundación debe proporcionarlos |

No se publican tarifas, cupos ni reservas de citas: el contrato FE-140 excluye inscripción, cobro y reserva.

## 3. Contacto institucional

| Canal | Dato | Estado |
| --- | --- | --- |
| Teléfono | **Pendiente** | La Fundación debe entregarlo y autorizar su publicación |
| Correo | **Pendiente** | Ídem |
| Redes sociales | **Pendiente** (la entrevista menciona Facebook, TikTok e Instagram como canales de captación, pero no se tienen las direcciones oficiales) | Ídem |
| Dirección del centro | **Pendiente** | Solo la dirección institucional, nunca domicilios de pacientes |

Regla del contrato: `contactoUrl` es un canal institucional verificado con URL http/https; no se inventan contactos.

## 4. Imágenes

| Imagen | Texto alternativo | Autorización |
| --- | --- | --- |
| Ninguna disponible | | Se requieren imágenes autorizadas por la Fundación, sin pacientes reconocibles. El contrato exige texto alternativo. |

## 5. Publicaciones de demostración

Para QA se usan las seis publicaciones ficticias de [publicaciones-demostracion.json](publicaciones-demostracion.json), claramente marcadas con `[DEMO QA]`:

| Alias | Tipo | Estado | Qué prueba |
| --- | --- | --- | --- |
| C1 | Campaña | Publicado | Listado y detalle públicos, enlace de contacto de prueba |
| A1 | Actividad | Borrador | No aparece públicamente (ejemplo del contrato) |
| K1 | Curso | Publicado | Rango de fechas, modalidad virtual y etiqueta de curso |
| R1 | Campaña | Retirado | Se oculta del listado y su URL responde no encontrado |
| X1 | Actividad | Borrador incompleto | Publicar informa los campos pendientes |
| I1 | Actividad | Borrador | Rechazo por fechas invertidas |

Resultado esperado del listado público: **C1 y K1**. El enlace `ejemplo.invalid` usa un dominio reservado que nunca resuelve, para que nadie lo confunda con un canal real.

## 6. Decisiones abiertas

| Tema | Pendiente de |
| --- | --- |
| Etiqueta visible de «curso» o «taller» | Fundación |
| Textos, servicios y contactos reales | Fundación |
| Imágenes autorizadas | Fundación |
| Quién aprueba el contenido antes de publicar | Andrea con la Fundación |

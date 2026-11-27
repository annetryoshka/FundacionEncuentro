# FE-146 · Secciones institucionales y contacto

Andrea Carolina Narváez Ortega · 26/11/2026.

Ruta pública `/fundacion`, sin iniciar sesión. Muestra presentación, atención psicológica sistémica a personas/parejas/familias, enlace al listado de actividades y contacto institucional mediante enlace telefónico y dirección. El contenido se configura en `institucional.ts`, separado del expediente y de las API clínicas. No se añaden servicios, precios, horarios, correo, redes ni imágenes no autorizados.

La PO autorizó expresamente el texto, teléfono y dirección en esta sesión; ver [registro de autorización](../../contenido/difusion/registro-autorizacion.md). Se reutilizan teléfono/dirección de la marca para evitar datos divergentes. La cabecera puede distribuirse en varias líneas en móvil.

Verificación: `Fundacion.test.tsx` y `Publicaciones.test.tsx`, **16 pruebas aprobadas**. Comprueban acceso público, contenido, enlace `tel:`, navegación entre secciones, acceso del personal separado y ausencia de consulta de carpetas. API simulada, sin publicación externa ni llamadas a pacientes. La verificación de navegador de la entrega se registra en FE-196.

import { DIRECCION, TELEFONO } from '../../componentes/marca'

/** Ubicación de la sede según el mapa compartido por la Fundación. */
const COORDENADAS = '-16.528737842362613,-68.10745367566756'

/**
 * Datos públicos de la Fundación (página de Facebook y afiche institucional). Sin datos clínicos.
 * Cambiar aquí cualquier contacto u horario: la página de inicio y el pie los leen de este archivo.
 */
export const INSTITUCIONAL = {
  nombre: 'Fundación Encuentro',
  lema: '“Jiwasanaka”, para el buen camino',
  descripcion:
    'Consultorio psicológico con orientación sistémica en La Paz, Bolivia. Acompañamos a personas, parejas y familias en el camino hacia una vida más sana y en armonía.',
  telefono: TELEFONO,
  /** Número internacional sin «+» ni espacios (wa.me y tel:). */
  numero: TELEFONO.replace(/\D/g, ''),
  correo: 'k4ty4mr4@gmail.com',
  horario: 'Lunes y miércoles, de 15:00 a 19:00',
  direccion: DIRECCION,
  zona: 'Obrajes, La Paz, Bolivia',
  /** Mapa con marcador en la sede (sin clave de API). */
  mapaEmbed: `https://www.google.com/maps?q=${COORDENADAS}&hl=es&z=17&output=embed`,
  comoLlegar: `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS}`,
} as const

export const ENLACE_WHATSAPP = `https://wa.me/${INSTITUCIONAL.numero}?text=${encodeURIComponent(
  'Hola, quisiera información sobre la atención de la Fundación Encuentro.',
)}`

export const ENLACE_TELEFONO = `tel:+${INSTITUCIONAL.numero}`

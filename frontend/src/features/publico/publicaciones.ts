/**
 * Publicaciones del portal público (contrato FE-140, HU FE-113).
 * Solo se modelan los campos que la API pública puede exponer: nunca borradores, autoría interna
 * ni datos clínicos. Los textos se muestran como texto, nunca como HTML.
 */

export type TipoPublicacion = 'campana' | 'actividad' | 'curso'
export type Modalidad = 'presencial' | 'virtual' | 'mixta'

/** La etiqueta visible de «curso» (curso o taller) queda por ratificar con la Fundación (FE-141). */
export const NOMBRE_TIPO_PUBLICACION: Record<TipoPublicacion, string> = {
  campana: 'Campaña',
  actividad: 'Actividad',
  curso: 'Curso',
}

export const NOMBRE_TIPO_PLURAL: Record<TipoPublicacion, string> = {
  campana: 'Campañas',
  actividad: 'Actividades',
  curso: 'Cursos',
}

export const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  mixta: 'Mixta',
}

export interface ImagenPublicacion {
  url: string
  /** Texto alternativo requerido por el contrato para cualquier imagen publicada. */
  textoAlternativo: string
}

/** Elemento de GET /api/publico/publicaciones. Las fechas son AAAA-MM-DD, sin hora. */
export interface PublicacionPublica {
  id: string
  tipo: TipoPublicacion
  titulo: string
  resumen: string
  imagen: ImagenPublicacion | null
  fechaInicio: string | null
  fechaFin: string | null
  modalidad: Modalidad | null
  lugar: string | null
  /** Canal institucional verificado; si no existe, la tarjeta no muestra contacto. */
  contactoUrl: string | null
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * «2026-12-01» → «1 de diciembre de 2026». Se calcula en UTC para que la zona horaria del navegador
 * no corra el día. Una fecha mal formada o imposible (30/02) devuelve '' en lugar de un valor falso.
 */
export function formatearFecha(iso: string | null): string {
  if (!iso) return ''
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return ''
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const coincide = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  return coincide ? FORMATO_FECHA.format(fecha) : ''
}

/** Una fecha, un rango («… al …») o null si no hay fecha de actividad que mostrar. */
export function textoFechas(inicio: string | null, fin: string | null): string | null {
  const desde = formatearFecha(inicio)
  const hasta = formatearFecha(fin)
  if (desde && hasta && inicio !== fin) return `${desde} al ${hasta}`
  return desde || hasta || null
}

/** Solo se enlazan canales http/https: así un `javascript:` o un dato mal cargado no se vuelve un enlace. */
export function esUrlHttp(url: string | null): url is string {
  if (!url) return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function esTipoPublicacion(valor: string): valor is TipoPublicacion {
  return valor in NOMBRE_TIPO_PUBLICACION
}

/**
 * FE-144 · Panel de difusión para administración y marketing (análisis FE-140, API FE-143).
 * FE-149 · Lectura pública de lo publicado. Ningún dato clínico pasa por aquí.
 */
import { peticion } from '../../api/cliente'
import { esFechaValida } from '../../utilidades/fechas'
import { aImagenPublicacion, accionesImagen, type ImagenApi, type ImagenGestion } from '../publico/imagenes'
import { esUrlHttp, type Modalidad, type PublicacionPublica, type TipoPublicacion } from '../publico/publicaciones'

export type EstadoPublicacion = 'borrador' | 'publicado' | 'retirado'

export const NOMBRE_ESTADO_PUBLICACION: Record<EstadoPublicacion, string> = {
  borrador: 'Borrador',
  publicado: 'Publicada',
  retirado: 'Retirada',
}

/** Ciclo del contrato: borrador → publicado → retirado → borrador. Otro salto responde 409. */
export const SIGUIENTE_ESTADO: Record<EstadoPublicacion, { estado: EstadoPublicacion; accion: string; ayuda: string }> =
  {
    borrador: { estado: 'publicado', accion: 'Publicar', ayuda: 'Se verá en el portal público.' },
    publicado: { estado: 'retirado', accion: 'Retirar del portal', ayuda: 'Deja de verse en el portal público.' },
    retirado: { estado: 'borrador', accion: 'Volver a borrador', ayuda: 'Queda como borrador para corregirla.' },
  }

/** GET /api/difusion/publicaciones/:id (con `imagen`) y elementos del listado (sin ella). */
export interface PublicacionAdmin {
  id: string
  tipo: TipoPublicacion
  titulo: string
  resumen: string | null
  contenido: string | null
  estado: EstadoPublicacion
  fechaInicio: string | null
  fechaFin: string | null
  modalidad: Modalidad | null
  lugar: string | null
  contactoUrl: string | null
  creadoPor: string | null
  actualizadoPor: string | null
  publicadoEn: string | null
  retiradoEn: string | null
  imagen?: ImagenGestion | null
}

export interface PaginaPublicacionesAdmin {
  publicaciones: PublicacionAdmin[]
  total: number
  pagina: number
  tamano: number
}

/** Cuerpo de POST y PUT. El PUT reemplaza todo: un campo vacío se envía como null. */
export interface DatosPublicacion {
  tipo: TipoPublicacion
  titulo: string
  resumen: string | null
  contenido: string | null
  fechaInicio: string | null
  fechaFin: string | null
  modalidad: Modalidad | null
  lugar: string | null
  contactoUrl: string | null
}

export const TAMANO_PAGINA_DIFUSION = 10
const base = '/difusion/publicaciones'
const una = (id: string) => `${base}/${encodeURIComponent(id)}`

export const listarPublicacionesAdmin = (filtros: {
  estado: EstadoPublicacion | ''
  tipo: TipoPublicacion | ''
  pagina: number
}) => peticion<PaginaPublicacionesAdmin>(base, { consulta: { ...filtros, tamano: TAMANO_PAGINA_DIFUSION } })
export const obtenerPublicacionAdmin = (id: string) => peticion<PublicacionAdmin>(una(id))
export const crearPublicacion = (datos: DatosPublicacion) =>
  peticion<PublicacionAdmin>(base, { metodo: 'POST', cuerpo: datos })
export const editarPublicacion = (id: string, datos: DatosPublicacion) =>
  peticion<PublicacionAdmin>(una(id), { metodo: 'PUT', cuerpo: datos })
/** 409 transición no permitida; 422 `camposFaltantes` (p. ej. publicar sin resumen). */
export const cambiarEstadoPublicacion = (id: string, estado: EstadoPublicacion) =>
  peticion<PublicacionAdmin>(`${una(id)}/estado`, { metodo: 'PATCH', cuerpo: { estado } })
/** Subir, describir, quitar y ver la imagen de portada (024). */
export const imagenPublicacion = (id: string) => accionesImagen(una(id))

// ---- Portal público ---------------------------------------------------------------

/** Lo que devuelve la API pública: la imagen llega con su id; la URL se arma aquí. */
export interface PublicacionPublicaApi extends Omit<PublicacionPublica, 'imagen' | 'resumen'> {
  resumen: string | null
  contenido: string | null
  publicadoEn: string | null
  imagen: ImagenApi | null
}

export interface PublicacionPublicaDetalle extends PublicacionPublica {
  contenido: string | null
  publicadoEn: string | null
}

export function aPublica(p: PublicacionPublicaApi): PublicacionPublicaDetalle {
  return {
    ...p,
    resumen: p.resumen ?? '',
    imagen: aImagenPublicacion(p.imagen),
  }
}

export async function listarPublicadas(filtros: { tipo: TipoPublicacion | ''; pagina: number }) {
  const r = await peticion<{ publicaciones: PublicacionPublicaApi[]; total: number; pagina: number; tamano: number }>(
    '/publico/publicaciones',
    { consulta: { ...filtros, tamano: 9 }, publica: true },
  )
  return { ...r, publicaciones: r.publicaciones.map(aPublica) }
}

export const obtenerPublicada = async (id: string) =>
  aPublica(await peticion<PublicacionPublicaApi>(`/publico/publicaciones/${encodeURIComponent(id)}`, { publica: true }))

// ---- Formulario -----------------------------------------------------------------

export interface FormularioPublicacion {
  tipo: TipoPublicacion | ''
  titulo: string
  resumen: string
  contenido: string
  fechaInicio: string
  fechaFin: string
  modalidad: Modalidad | ''
  lugar: string
  contactoUrl: string
}

export type ErroresPublicacion = Partial<Record<keyof FormularioPublicacion, string>>

export const LIMITES_PUBLICACION = { titulo: 150, resumen: 500, contenido: 10_000, lugar: 200, contactoUrl: 500 }

export const formularioVacio = (): FormularioPublicacion => ({
  tipo: '',
  titulo: '',
  resumen: '',
  contenido: '',
  fechaInicio: '',
  fechaFin: '',
  modalidad: '',
  lugar: '',
  contactoUrl: '',
})

export const aFormulario = (p: PublicacionAdmin): FormularioPublicacion => ({
  tipo: p.tipo,
  titulo: p.titulo,
  resumen: p.resumen ?? '',
  contenido: p.contenido ?? '',
  fechaInicio: p.fechaInicio ?? '',
  fechaFin: p.fechaFin ?? '',
  modalidad: p.modalidad ?? '',
  lugar: p.lugar ?? '',
  contactoUrl: p.contactoUrl ?? '',
})

const nulo = (v: string) => v.trim() || null

export const aDatos = (f: FormularioPublicacion): DatosPublicacion => ({
  tipo: f.tipo as TipoPublicacion,
  titulo: f.titulo.trim(),
  resumen: nulo(f.resumen),
  contenido: nulo(f.contenido),
  fechaInicio: f.fechaInicio || null,
  fechaFin: f.fechaFin || null,
  modalidad: f.modalidad || null,
  lugar: nulo(f.lugar),
  contactoUrl: nulo(f.contactoUrl),
})

/** El resumen no es obligatorio para un borrador, pero sí para publicar (422 del backend). */
export function validarPublicacion(f: FormularioPublicacion): ErroresPublicacion {
  const e: ErroresPublicacion = {}
  if (!f.tipo) e.tipo = 'Elige el tipo de publicación.'
  if (!f.titulo.trim()) e.titulo = 'Escribe un título.'
  else if (f.titulo.trim().length > LIMITES_PUBLICACION.titulo)
    e.titulo = `Máximo ${LIMITES_PUBLICACION.titulo} caracteres.`
  if (f.resumen.trim().length > LIMITES_PUBLICACION.resumen)
    e.resumen = `Máximo ${LIMITES_PUBLICACION.resumen} caracteres.`
  if (f.contenido.length > LIMITES_PUBLICACION.contenido)
    e.contenido = `Máximo ${LIMITES_PUBLICACION.contenido} caracteres.`
  if (f.fechaInicio && !esFechaValida(f.fechaInicio)) e.fechaInicio = 'La fecha no es válida.'
  if (f.fechaFin && !esFechaValida(f.fechaFin)) e.fechaFin = 'La fecha no es válida.'
  else if (f.fechaInicio && f.fechaFin && f.fechaFin < f.fechaInicio)
    e.fechaFin = 'No puede ser anterior a la fecha de inicio.'
  if (f.lugar.trim().length > LIMITES_PUBLICACION.lugar) e.lugar = `Máximo ${LIMITES_PUBLICACION.lugar} caracteres.`
  if (f.contactoUrl.trim() && !esUrlHttp(f.contactoUrl.trim())) {
    e.contactoUrl = 'Escribe un enlace completo que empiece con https://'
  }
  return e
}

export const NOMBRE_CAMPO_PUBLICACION: Record<string, string> = {
  resumen: 'Resumen',
  titulo: 'Título',
  tipo: 'Tipo',
}

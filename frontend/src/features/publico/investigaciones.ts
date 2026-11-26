/**
 * Investigaciones del portal público (contrato FE-182, HU FE-116).
 * Solo contenido expresamente autorizado por la Fundación: nada se toma de expedientes ni de
 * documentos exportados. El alcance del foro sigue pendiente de ratificación, por eso este modelo
 * no incluye comentarios: son artículos publicados.
 */
import type { ImagenPublicacion } from './publicaciones'

/** Elemento de la lectura pública de artículos de investigación. La fecha es AAAA-MM-DD. */
export interface InvestigacionPublica {
  id: string
  titulo: string
  resumen: string
  /** Autor visible autorizado; null si no se autorizó mostrarlo. */
  autor: string | null
  imagen: ImagenPublicacion | null
  fechaPublicacion: string | null
}

export const ETIQUETA_INVESTIGACION = 'Investigación'

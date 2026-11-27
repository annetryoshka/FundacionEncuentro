/**
 * Imágenes de portada de publicaciones y artículos (migración 024).
 * El archivo se sube a la API, que lo reduce, lo convierte a WebP y le quita los metadatos (incluida la ubicación).
 * El portal la muestra desde GET /api/publico/imagenes/:id, solo mientras lo que la usa esté publicado.
 */
import { ErrorApi, descargarArchivo, peticion, urlApi } from '../../api/cliente'
import { extension, tamanoLegible } from '../../utilidades/archivos'
import { mensajeNoGuardado } from '../expediente/errores'
import type { ImagenPublicacion } from './publicaciones'

/** Imagen como la entrega la API pública. */
export interface ImagenApi {
  id: string
  textoAlternativo: string
  ancho: number | null
  alto: number | null
}

/** En gestión llega también el peso del archivo guardado. */
export interface ImagenGestion extends ImagenApi {
  tamanoBytes: number
}

// En la API simulada la imagen vive en la memoria del navegador (no hay servidor que la sirva).
const simuladas = new Map<string, string>()
export const registrarImagenSimulada = (id: string, url: string) => void simuladas.set(id, url)
export const leerImagenSimulada = (id: string) => simuladas.get(id)

export const urlImagenPublica = (id: string) =>
  simuladas.get(id) ?? urlApi(`/publico/imagenes/${encodeURIComponent(id)}`)

export const aImagenPublicacion = (imagen: ImagenApi | null | undefined): ImagenPublicacion | null =>
  imagen ? { url: urlImagenPublica(imagen.id), textoAlternativo: imagen.textoAlternativo } : null

// ---- Validación en el navegador (el servidor decide igual) -----------------------------

export const LIMITE_IMAGEN = 15 * 1024 * 1024
export const LIMITE_TEXTO_IMAGEN = 300
export const ACEPTA_IMAGEN = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONES = ['jpg', 'jpeg', 'png', 'webp']

/** Evita subir 15 MB para recibir un error: revisa tipo y peso antes. */
export function validarImagen(archivo: File): string | null {
  const ext = extension(archivo.name)
  if (['heic', 'heif'].includes(ext) || /hei[cf]/i.test(archivo.type)) {
    return 'Las fotos HEIC del iPhone no se pueden usar. Guárdala como JPG o elige otra imagen.'
  }
  if (!TIPOS.includes(archivo.type) && !EXTENSIONES.includes(ext)) {
    return 'Ese archivo no es una imagen JPG, PNG o WebP. Elige una foto o un afiche.'
  }
  if (archivo.size === 0) return 'El archivo está vacío. Elige otra imagen.'
  if (archivo.size > LIMITE_IMAGEN) {
    return `La imagen pesa ${tamanoLegible(archivo.size)} y el máximo es 15 MB. Elige una más liviana.`
  }
  return null
}

export function validarTextoImagen(texto: string): string | null {
  if (!texto.trim()) return 'Describe la imagen en una frase.'
  if (texto.trim().length > LIMITE_TEXTO_IMAGEN) return `Máximo ${LIMITE_TEXTO_IMAGEN} caracteres.`
  return null
}

/** Los mensajes del servidor para imágenes ya están escritos para la persona (024). */
export function mensajeErrorImagen(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.estado === 0)
      return 'Se cortó la conexión mientras subía la imagen. Revisa tu internet e inténtalo de nuevo.'
    if (error.estado === 413) return 'La imagen pesa más de 15 MB. Elige una más liviana.'
    if ([400, 415, 422].includes(error.estado)) return error.message
  }
  return mensajeNoGuardado(error).replace('No se guardó', 'No se guardó la imagen')
}

// ---- API (mismas rutas en difusión y en artículos) --------------------------------------

export interface AccionesImagen {
  subir: (archivo: File, textoAlternativo: string) => Promise<ImagenGestion>
  cambiarTexto: (textoAlternativo: string) => Promise<ImagenGestion>
  quitar: () => Promise<void>
  /** El archivo guardado, también en borrador (con la sesión). */
  vistaPrevia: () => Promise<Blob>
}

/** `recurso`: ruta de la publicación o del artículo, p. ej. `/difusion/publicaciones/<id>`. */
export function accionesImagen(recurso: string): AccionesImagen {
  const ruta = `${recurso}/imagen`
  return {
    subir: (archivo, textoAlternativo) => {
      const formulario = new FormData()
      formulario.append('archivo', archivo, archivo.name)
      formulario.append('textoAlternativo', textoAlternativo.trim())
      return peticion<ImagenGestion>(ruta, { metodo: 'PUT', cuerpo: formulario, tiempoMaximoMs: 120_000 })
    },
    cambiarTexto: (textoAlternativo) =>
      peticion<ImagenGestion>(ruta, { metodo: 'PATCH', cuerpo: { textoAlternativo: textoAlternativo.trim() } }),
    quitar: () => peticion<void>(ruta, { metodo: 'DELETE' }),
    vistaPrevia: async () => (await descargarArchivo(`${ruta}/archivo`)).contenido,
  }
}

/**
 * FE-132 · Genograma exportado de GenoPro (análisis FE-129, API FE-131, almacenamiento FE-130).
 * El sistema guarda y muestra el archivo exportado (PDF, PNG o JPEG); no edita el genograma.
 */
import { ErrorApi, descargarArchivo, peticion } from '../../../api/cliente'
import { LIMITE_5_MIB, validarArchivo } from '../../../utilidades/archivos'

/** GET /api/carpetas/:id/genograma. `autorId` es el UUID de quien lo cargó o reemplazó. */
export interface GenogramaInfo {
  nombre: string
  tipo: 'application/pdf' | 'image/png' | 'image/jpeg' | string
  tamanio: number
  autorId: string
  actualizadoEn: string
}

const ruta = (carpetaId: string) => `/carpetas/${encodeURIComponent(carpetaId)}/genograma`

/** null = la carpeta todavía no tiene genograma (404 «Genograma no encontrado»). */
export async function obtenerGenograma(carpetaId: string): Promise<GenogramaInfo | null> {
  try {
    return await peticion<GenogramaInfo>(ruta(carpetaId))
  } catch (error) {
    if (esSinGenograma(error)) return null
    throw error
  }
}

/** El backend usa 404 tanto para «sin genograma» como para «sin acceso al caso»; se distinguen por el mensaje. */
export function esSinGenograma(error: unknown) {
  return error instanceof ErrorApi && error.estado === 404 && /genograma/i.test(error.message)
}

export const descargarGenograma = (carpetaId: string) => descargarArchivo(`${ruta(carpetaId)}/archivo`)

/** PUT multipart con el campo `archivo` → 204. Si falla, el genograma vigente se conserva. */
export function cargarGenograma(carpetaId: string, archivo: File): Promise<void> {
  const formulario = new FormData()
  formulario.append('archivo', archivo, archivo.name)
  return peticion<void>(ruta(carpetaId), { metodo: 'PUT', cuerpo: formulario })
}

export const FORMATOS_GENOGRAMA = 'PDF, PNG o JPEG'
export const ACEPTA_GENOGRAMA = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'

export const validarArchivoGenograma = (archivo: File | null | undefined) =>
  validarArchivo(archivo, {
    extensiones: ['pdf', 'png', 'jpg', 'jpeg'],
    limite: LIMITE_5_MIB,
    formatos: FORMATOS_GENOGRAMA,
  })

/** Mensaje claro para cada rechazo del servidor (contrato FE-131). */
export function mensajeCargaGenograma(error: unknown): string | null {
  if (!(error instanceof ErrorApi)) return null
  if (error.estado === 413) return 'El archivo supera los 5 MB permitidos. Exporta el genograma con menor resolución.'
  if (error.estado === 415) return `El archivo no es un ${FORMATOS_GENOGRAMA} válido. Exporta de nuevo desde GenoPro.`
  if (error.estado === 400) return 'Elige el archivo del genograma antes de guardar.'
  return null
}

export const esImagen = (tipo: string) => tipo === 'image/png' || tipo === 'image/jpeg'
export const nombreFormato = (tipo: string) =>
  tipo === 'application/pdf' ? 'PDF' : tipo === 'image/png' ? 'PNG' : tipo === 'image/jpeg' ? 'JPEG' : tipo

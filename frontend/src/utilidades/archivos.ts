import type { ArchivoRecibido } from '../api/cliente'

/** 5 MiB: límite de genograma, imágenes de difusión e importación histórica (contratos del Sprint 3). */
export const LIMITE_5_MIB = 5 * 1024 * 1024

/** «1,2 MB», «340 KB»: tamaño legible para la persona. */
export function tamanoLegible(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`
}

/** Extensión en minúsculas, sin punto (`informe.PDF` → `pdf`). */
export function extension(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  return punto < 0 ? '' : nombre.slice(punto + 1).toLowerCase()
}

/**
 * Comprueba en el navegador lo mismo que el servidor (que sigue siendo quien decide):
 * evita subir 5 MB para recibir un 413 o un 415.
 */
export function validarArchivo(
  archivo: File | null | undefined,
  { extensiones, limite = LIMITE_5_MIB, formatos }: { extensiones: string[]; limite?: number; formatos: string },
): string | null {
  if (!archivo) return 'Elige un archivo.'
  if (archivo.size === 0) return 'El archivo está vacío.'
  if (!extensiones.includes(extension(archivo.name))) return `Formato no admitido. Usa ${formatos}.`
  if (archivo.size > limite)
    return `El archivo pesa ${tamanoLegible(archivo.size)}; el máximo es ${tamanoLegible(limite)}.`
  return null
}

/** Ofrece al navegador un archivo recibido de la API, con el nombre del servidor o uno de respaldo. */
export function guardarArchivo(archivo: ArchivoRecibido, nombreRespaldo: string) {
  const url = URL.createObjectURL(archivo.contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.nombre || nombreRespaldo
  enlace.rel = 'noopener'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // Se libera después: algunos navegadores todavía leen la URL al iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

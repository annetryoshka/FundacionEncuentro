/**
 * FE-160 · Exportar informe, ficha o historial a PDF o Word (análisis FE-156, API FE-159).
 * El backend vuelve a comprobar el acceso al generar y al descargar; el archivo es privado (no-store).
 */
import { ErrorApi, descargarArchivo, peticion, type ArchivoRecibido } from '../../../api/cliente'

export type DocumentoExportable = 'informe' | 'ficha' | 'historial'
export type FormatoExportacion = 'pdf' | 'docx'
export type SeccionExportable = 'identificacion' | 'familia' | 'diagnostico' | 'sesiones'

export const NOMBRE_SECCION: Record<SeccionExportable, string> = {
  identificacion: 'Identificación del paciente y del caso',
  familia: 'Composición familiar',
  diagnostico: 'Evaluación y diagnóstico',
  sesiones: 'Sesiones y tareas',
}

/** Lo que admite cada documento (migración 020) y lo que se marca por defecto. */
export const SECCIONES: Record<
  'ficha' | 'historial',
  { permitidas: SeccionExportable[]; porDefecto: SeccionExportable[] }
> = {
  ficha: { permitidas: ['identificacion', 'familia', 'diagnostico'], porDefecto: ['identificacion', 'diagnostico'] },
  historial: {
    permitidas: ['identificacion', 'familia', 'diagnostico', 'sesiones'],
    porDefecto: ['identificacion', 'familia', 'diagnostico', 'sesiones'],
  },
}

export interface PedidoExportacion {
  documento: DocumentoExportable
  formato: FormatoExportacion
  /** Solo para un informe: la versión revisada. */
  informeVersionId?: string
  /** Solo ficha e historial. */
  secciones?: SeccionExportable[]
  /** Solo historial y solo administración. */
  incluirPagos?: boolean
}

const ruta = (carpetaId: string) => `/carpetas/${encodeURIComponent(carpetaId)}/exportaciones`

/** Genera el archivo (POST → exportacionId) y lo descarga con el mismo token. */
export async function exportarDocumento(carpetaId: string, pedido: PedidoExportacion): Promise<ArchivoRecibido> {
  const { exportacionId } = await peticion<{ exportacionId: string }>(ruta(carpetaId), {
    metodo: 'POST',
    cuerpo: { formatoVersion: 1, ...pedido },
  })
  return descargarArchivo(`${ruta(carpetaId)}/${encodeURIComponent(exportacionId)}/archivo`)
}

/** Nombre de respaldo si el navegador no recibe Content-Disposition (CORS sin exponer la cabecera). */
export function nombreArchivo(documento: DocumentoExportable, numeroCarpeta: number, formato: FormatoExportacion) {
  return `${documento}-carpeta-${numeroCarpeta}.${formato}`
}

export function mensajeExportacion(error: unknown): string | null {
  if (!(error instanceof ErrorApi)) return null
  if (error.estado === 409) return `No se pudo exportar: ${error.message}`
  if (error.estado === 403) return 'Tu cuenta no puede exportar este documento con esas opciones.'
  if (error.estado === 404) return 'No se exportó: el caso o el informe ya no está disponible para tu cuenta.'
  if (error.estado === 400) return `No se exportó: ${error.message}`
  if (error.estado >= 500) return 'No se pudo generar el archivo. Intenta de nuevo en unos minutos.'
  return null
}

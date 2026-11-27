/**
 * FE-170 · Categorización de casos y exportación para Atlas.ti (análisis FE-167, API FE-169).
 * Administración y terapeutas (cada una ve solo lo que su acceso permite); marketing queda fuera (403).
 * El paquete usa códigos INV-001…: no lleva nombres, números de carpeta ni teléfonos.
 */
import { descargarArchivo, peticion } from '../../api/cliente'
import type { FiltroResidencia } from '../carpetas/residencia'

export interface Categoria {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
  padreId: string | null
  color?: string | null
  activa: boolean
  casos: number
  etiquetasCaso: number
  etiquetasDiagnostico: number
  etiquetasSesion: number
}

export interface DatosCategoria {
  nombre: string
  descripcion: string | null
  padreId: string | null
  color: string | null
  activa?: boolean
}

export interface CasoSeleccionable {
  casoId: string
  tipo: 'voluntario' | 'derivado'
  numeroCorrelativo: number
  /** Códigos de categoría asignados. */
  categorias: string[]
  sesionesEnPeriodo: number
  tieneDiagnostico: boolean
}

export type SeccionInvestigacion = 'diagnostico' | 'seguimiento' | 'tareas'

export const NOMBRE_SECCION_INV: Record<SeccionInvestigacion, string> = {
  diagnostico: 'Diagnóstico de ingreso',
  seguimiento: 'Seguimiento de sesiones',
  tareas: 'Tareas',
}

export interface EtiquetaEnDocumento {
  ambito: 'caso' | 'diagnostico' | 'sesion'
  codigo: string
  nombre: string
  fragmento: string | null
  nota: string | null
  nroSesion: number | null
}

export interface DocumentoInvestigacion {
  idExportacion: string
  archivo: string
  secciones: SeccionInvestigacion[]
  categorias: EtiquetaEnDocumento[]
  diagnostico?: {
    origen: string
    diagnosticoIngreso: string | null
    hipotesisRelacional: string | null
    comentariosClinicos: string | null
  } | null
  /** La fecha se generaliza al mes (AAAA-MM). Las tareas van dentro de su sesión si se pidieron. */
  seguimiento?: {
    nroSesion: number
    mes: string
    evolucion: string
    tareas?: { descripcion: string; completada: boolean }[]
  }[]
}

export interface Manifiesto {
  formato: 'txt' | 'docx'
  formatoVersion: number
  periodo: { desde: string | null; hasta: string | null }
  catalogo: { codigo: string; nombre: string; descripcion: string | null; padre: string | null }[]
  documentos: { idExportacion: string; archivo: string; secciones: SeccionInvestigacion[]; categorias: string[] }[]
}

export interface VistaRevision {
  manifiesto: Manifiesto
  documentos: DocumentoInvestigacion[]
  /** SHA-256 del contenido mostrado: confirmar con otra huella responde 409. */
  huella: string
  /** Fecha de la revisión confirmada, si la hubo. */
  revisadoEn: string | null
  /** La revisión corresponde al contenido actual: se puede descargar sin volver a confirmar. */
  revisionVigente: boolean
}

const base = '/investigacion'

export const listarCategorias = () =>
  peticion<{ categorias: Categoria[] }>(`${base}/categorias`).then((r) => r.categorias)

/** Solo administración. El código no se cambia después (identifica la categoría en Atlas.ti). */
export const crearCategoria = (datos: DatosCategoria & { codigo: string }) =>
  peticion<Categoria>(`${base}/categorias`, { metodo: 'POST', cuerpo: datos })

/** Desactivar = `activa: false`; no se borra para no romper exportaciones anteriores. */
export const editarCategoria = (id: string, datos: DatosCategoria) =>
  peticion<Categoria>(`${base}/categorias/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos })

export interface FiltrosSeleccion {
  desde: string
  hasta: string
  residencias: Exclude<FiltroResidencia, ''>[]
  categorias: string[]
}

/** Arreglos como parámetros repetidos (?categorias=a&categorias=b), que es lo que espera el backend. */
export function consultaSeleccion(f: FiltrosSeleccion) {
  const p = new URLSearchParams()
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  f.residencias.forEach((r) => p.append('residencias', r))
  f.categorias.forEach((c) => p.append('categorias', c))
  const texto = p.toString()
  return texto ? `?${texto}` : ''
}

export const listarSeleccion = (f: FiltrosSeleccion) =>
  peticion<{ casos: CasoSeleccionable[] }>(`${base}/seleccion${consultaSeleccion(f)}`).then((r) => r.casos)

export const etiquetarCaso = (
  casoId: string,
  datos: {
    categoriaId: string
    fichaDiagnosticoId?: string
    fichaSeguimientoId?: string
    fragmento?: string | null
    nota?: string | null
  },
) =>
  peticion<{ id: string }>(`${base}/casos/${encodeURIComponent(casoId)}/etiquetas`, { metodo: 'POST', cuerpo: datos })

export const prepararExportacion = (datos: {
  casosIds: string[]
  secciones: SeccionInvestigacion[]
  formato: 'txt' | 'docx'
  desde?: string
  hasta?: string
}) => peticion<{ exportacionId: string }>(`${base}/exportaciones`, { metodo: 'POST', cuerpo: datos })

const exportacion = (id: string) => `${base}/exportaciones/${encodeURIComponent(id)}`
export const obtenerRevision = (id: string) => peticion<VistaRevision>(`${exportacion(id)}/revision`)
export const confirmarRevision = (id: string, huella: string) =>
  peticion<{ revisadoEn: string }>(`${exportacion(id)}/revision`, { metodo: 'PATCH', cuerpo: { huella } })
/** ZIP con manifiesto y documentos. 409 si la revisión no está confirmada o el contenido cambió después. */
export const descargarPaquete = (id: string) => descargarArchivo(`${exportacion(id)}/descarga`)

export const esCodigoCategoria = (codigo: string) =>
  /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(codigo) && codigo.length <= 30

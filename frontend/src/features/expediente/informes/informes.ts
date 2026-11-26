/**
 * FE-154 · Informes de intervención sistémica y judiciales (plantillas FE-151, API FE-153).
 * Los genera y revisa solo la terapeuta asignada. Un borrador se revisa una sola vez (409 si se repite).
 */
import { peticion } from '../../../api/cliente'

export type TipoInforme = 'intervencion_sistemica' | 'judicial'

export const NOMBRE_TIPO_INFORME: Record<TipoInforme, string> = {
  intervencion_sistemica: 'Informe de intervención sistémica',
  judicial: 'Informe judicial',
}

export interface SeccionInforme {
  titulo: string
  contenido: string
}

export interface VersionInforme {
  id: string
  informeId: string
  tipo: TipoInforme
  nroVersion: number
  versionPlantilla: string
  estado: 'borrador' | 'revisado'
  secciones: SeccionInforme[]
  creadoPor: string
  creadoEn: string
  revisadoPor: string | null
  revisadoEn: string | null
}

export interface PedidoInforme {
  tipo: TipoInforme
  sesionesIds: string[]
  incluirFamilia: boolean
  incluirGenograma: boolean
  /** Obligatorio para el judicial. */
  objeto?: string
}

const ruta = (carpetaId: string) => `/carpetas/${encodeURIComponent(carpetaId)}/informes`

/** 201 → la versión borrador creada. 422 trae `camposFaltantes` (p. ej. judicial sin juzgado u objeto). */
export const generarInforme = (carpetaId: string, pedido: PedidoInforme) =>
  peticion<{ id: string; informeId: string; nroVersion: number; estado: 'borrador'; creadoPor: string }>(
    ruta(carpetaId),
    {
      metodo: 'POST',
      cuerpo: pedido,
    },
  )

export const obtenerInforme = (carpetaId: string, versionId: string) =>
  peticion<VersionInforme>(`${ruta(carpetaId)}/${encodeURIComponent(versionId)}`)

export const revisarInforme = (carpetaId: string, versionId: string, secciones: SeccionInforme[]) =>
  peticion<{ id: string; estado: 'revisado'; revisadoPor: string; revisadoEn: string }>(
    `${ruta(carpetaId)}/${encodeURIComponent(versionId)}/revision`,
    { metodo: 'PATCH', cuerpo: { secciones } },
  )

/** Qué falta, en palabras, y dónde se completa. */
export const CAMPO_FALTANTE: Record<string, { texto: string; apartado?: string }> = {
  'paciente.nombreCompleto': { texto: 'el nombre del paciente', apartado: '' },
  'judicial.juzgado': { texto: 'el juzgado de derivación (en «Origen y consentimiento»)', apartado: 'constancia' },
  objeto: { texto: 'el objeto del informe' },
}

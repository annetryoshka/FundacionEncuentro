import { peticion } from '../../api/cliente'
import type { EstadoCaso } from '../carpetas/tipos'
import { FILTRO_SIN_REGISTRAR, NOMBRE_RESIDENCIA, SIN_REGISTRAR, type CiudadResidencia } from '../carpetas/residencia'

export type GrupoResidencia = CiudadResidencia | typeof FILTRO_SIN_REGISTRAR

/** Una fila de GET /api/indicadores/por-residencia (FE-136). Misma semántica que /api/indicadores. */
export interface IndicadoresDeResidencia {
  residencia: GrupoResidencia
  casosActuales: number
  casosPorEstado: Record<EstadoCaso, number>
  sesiones: number
  pagosRecibidos: { monto: string; moneda: 'BOB' }
}

export interface IndicadoresPorResidencia {
  periodo: { desde: string; hasta: string }
  porResidencia: IndicadoresDeResidencia[]
}

/** Orden fijo de las filas: aunque un grupo no tenga casos se muestra con cero (FE-134). */
export const ORDEN_RESIDENCIA: GrupoResidencia[] = ['la_paz', 'el_alto', 'otra', FILTRO_SIN_REGISTRAR]

export const nombreGrupoResidencia = (grupo: GrupoResidencia) =>
  grupo === FILTRO_SIN_REGISTRAR ? SIN_REGISTRAR : NOMBRE_RESIDENCIA[grupo]

/** Solo administración: las terapeutas no reciben indicadores financieros (FE-134 §5). */
export const consultarIndicadoresPorResidencia = (desde: string, hasta: string) =>
  peticion<IndicadoresPorResidencia>('/indicadores/por-residencia', { consulta: { desde, hasta } })

/** Filas en el orden del catálogo; un grupo que el backend no envíe se rellena con ceros. */
export function filasPorResidencia(datos: IndicadoresPorResidencia): IndicadoresDeResidencia[] {
  return ORDEN_RESIDENCIA.map(
    (residencia) =>
      datos.porResidencia.find((f) => f.residencia === residencia) ?? {
        residencia,
        casosActuales: 0,
        casosPorEstado: { iniciado: 0, en_proceso: 0, concluido: 0 },
        sesiones: 0,
        pagosRecibidos: { monto: '0.00', moneda: 'BOB' },
      },
  )
}

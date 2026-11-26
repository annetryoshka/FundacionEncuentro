import { peticion } from '../../api/cliente'

/** GET /api/carpetas/:id/diagnostico/vigente (FE-126): ficha vigente o, si no hay, el antecedente del alta. */
export interface DiagnosticoVigente {
  origen: 'ficha' | 'alta' | 'sin_datos'
  fichaId: string | null
  fichaFecha: string | null
  diagnosticoIngreso: string | null
  hipotesisRelacional: string | null
  comentariosClinicos: string | null
  alta: { diagnosticoIngreso: string | null; hipotesisRelacional: string | null; comentariosClinicos: string | null }
}

export const obtenerDiagnosticoVigente = (carpetaId: string) =>
  peticion<DiagnosticoVigente>(`/carpetas/${encodeURIComponent(carpetaId)}/diagnostico/vigente`)

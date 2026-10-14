import { esEndpointPendiente, mensajeErrorGeneral } from '../api/cliente'
import { Aviso } from './ui'

interface Props {
  error: unknown
  alReintentar: () => void
  /** Texto antes del mensaje, p. ej. "No se pudo cargar la lista de terapeutas." */
  contexto?: string
  className?: string
}

/**
 * Error al cargar datos. Si el backend todavía no tiene el endpoint (404 "Cannot GET …"),
 * lo dice como aviso informativo y sin "Reintentar", porque reintentar no lo va a arreglar.
 */
export function ErrorDeCarga({ error, alReintentar, contexto, className = '' }: Props) {
  if (esEndpointPendiente(error)) {
    return (
      <Aviso tipo="info" className={className}>
        {mensajeErrorGeneral(error)}
      </Aviso>
    )
  }
  return (
    <Aviso tipo="error" className={className}>
      {contexto && `${contexto} `}
      {mensajeErrorGeneral(error)}{' '}
      <button type="button" onClick={alReintentar} className="font-semibold underline">
        Reintentar
      </button>
    </Aviso>
  )
}

import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Cargando } from '../../componentes/ui'
import { useSesion } from '../auth/sesion'

/** La página de inicio es para visitantes: con sesión iniciada, la raíz sigue llevando al panel. */
export function SoloVisitantes({ children }: { children: ReactNode }) {
  const { usuario, recuperando } = useSesion()
  if (recuperando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Cargando texto="Cargando…" />
      </div>
    )
  }
  return usuario ? <Navigate to="/inicio" replace /> : children
}

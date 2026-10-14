import { createContext, useContext } from 'react'
import type { RespuestaSesion, Rol, UsuarioSesion } from './tipos'

export interface EstadoSesion {
  usuario: UsuarioSesion | null
  /** true mientras se intenta recuperar la sesión al abrir o recargar la app. */
  recuperando: boolean
  /** Motivo por el que se cerró la sesión sin que la persona lo pidiera (se muestra en el login). */
  avisoSalida: string | null
  guardarSesion: (respuesta: RespuestaSesion) => void
  /** Cierra la sesión en el backend (POST /auth/logout) y limpia todo en el navegador. */
  cerrarSesion: () => Promise<void>
  tieneRol: (...roles: Rol[]) => boolean
}

export const ContextoSesion = createContext<EstadoSesion | null>(null)

export function useSesion(): EstadoSesion {
  const contexto = useContext(ContextoSesion)
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return contexto
}

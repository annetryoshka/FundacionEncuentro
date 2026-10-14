import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Cargando } from '../../componentes/ui'
import { PaginaSinPermiso } from '../../paginas/PaginaSinPermiso'
import { useSesion } from './sesion'
import type { Rol } from './tipos'

interface Props {
  children: ReactNode
  /** Si se indica, solo esos roles ven la pantalla. El backend aplica la misma regla. */
  roles?: Rol[]
}

/** Sin sesión → al login (recordando a dónde iba). Con sesión pero sin rol → aviso de permiso. */
export function RutaProtegida({ children, roles }: Props) {
  const { usuario, recuperando } = useSesion()
  const ubicacion = useLocation()

  if (recuperando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Cargando texto="Recuperando tu sesión…" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />
  }
  if (roles && !roles.includes(usuario.rol)) return <PaginaSinPermiso />
  return children
}

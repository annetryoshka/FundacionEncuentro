import type { ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Cargando } from '../../componentes/ui'
import { useSesion } from '../auth/sesion'
import { obtenerCarpeta } from '../carpetas/carpetasApi'
import { NOMBRE_TIPO, numeroCarpeta, type CarpetaDetalle } from '../carpetas/tipos'
import { APARTADOS } from './apartados'

interface Props {
  titulo: string
  children: (carpeta: CarpetaDetalle) => ReactNode
}

/**
 * Marco común de los apartados de una carpeta: identifica el caso, permite volver al resumen y moverse
 * entre apartados. Si la cuenta no tiene acceso al caso, el backend responde 404 y no se muestra nada de él.
 */
export function SeccionCarpeta({ titulo, children }: Props) {
  const { id = '' } = useParams()
  const { tieneRol } = useSesion()
  const { datos: carpeta, error, recargar } = useCarga(() => obtenerCarpeta(id), [id])

  if (error !== undefined) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 403)) {
      return (
        <div className="max-w-prose space-y-4">
          <Link to="/carpetas" className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline">
            Volver a carpetas
          </Link>
          <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos esta carpeta</h1>
          <p className="text-suave">
            Puede que el enlace no sea correcto o que la carpeta no esté asignada a tu cuenta.
          </p>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir la carpeta." />
  }
  if (!carpeta) return <Cargando texto="Abriendo carpeta…" />

  const apartados = APARTADOS.filter((a) => !a.soloAdministracion || tieneRol('administrador'))

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/carpetas/${carpeta.id}`}
          className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline"
        >
          Volver a la carpeta {numeroCarpeta(carpeta.numero)}
        </Link>
        <p className="mt-3 text-sm text-suave">
          Carpeta {numeroCarpeta(carpeta.numero)} ({NOMBRE_TIPO[carpeta.tipo]}) ·{' '}
          <span className="font-semibold text-texto">{carpeta.paciente.nombreCompleto}</span>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-verde-oscuro sm:text-3xl">{titulo}</h1>
      </div>

      <nav aria-label="Apartados de la carpeta" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 border-b border-linea">
          {apartados.map((a) => (
            <li key={a.ruta}>
              <NavLink
                to={`/carpetas/${carpeta.id}/${a.ruta}`}
                className={({ isActive }) =>
                  `-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-naranja ${
                    isActive ? 'border-verde text-verde-oscuro' : 'border-transparent text-suave hover:text-texto'
                  }`
                }
              >
                {a.nombre}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {children(carpeta)}
    </div>
  )
}

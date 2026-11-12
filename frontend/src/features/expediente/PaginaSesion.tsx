import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, Cargando, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { crearNombrador } from './autoria'
import { obtenerSesion } from './expedienteApi'
import { SeccionCarpeta } from './SeccionCarpeta'
import { TareasDeSesion } from './TareasDeSesion'

/** FE-72 · Detalle de una sesión, abierto por su identificador. FE-77 · Sus tareas terapéuticas. */
export function PaginaSesion() {
  return <SeccionCarpeta titulo="Sesión">{(carpeta) => <DetalleSesion carpeta={carpeta} />}</SeccionCarpeta>
}

function DetalleSesion({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { sesionId = '' } = useParams()
  const { usuario } = useSesion()
  const recienCreada = Boolean((useLocation().state as { recienCreada?: boolean } | null)?.recienCreada)
  const { datos: sesion, error, recargar } = useCarga(() => obtenerSesion(carpeta.id, sesionId), [carpeta.id, sesionId])
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario, sesion ? [sesion.responsable] : [])

  useEffect(() => {
    if (recienCreada && sesion) refExito.current?.focus()
  }, [recienCreada, sesion])

  const volver = (
    <Link
      to={`/carpetas/${carpeta.id}/sesiones`}
      className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline"
    >
      Ver todas las sesiones
    </Link>
  )

  if (error !== undefined) {
    return (
      <div className="space-y-4">
        {error instanceof ErrorApi && error.estado === 404 ? (
          <Aviso tipo="info">No encontramos esta sesión en la carpeta.</Aviso>
        ) : (
          <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo cargar la sesión." />
        )}
        {volver}
      </div>
    )
  }
  if (!sesion) return <Cargando texto="Cargando sesión…" />

  return (
    <div className="space-y-6">
      {volver}
      {recienCreada && (
        <Aviso ref={refExito} tipo="exito">
          Sesión {sesion.numero} registrada. Ahora puedes agregarle tareas.
        </Aviso>
      )}

      <Tarjeta>
        <h2 className="text-xl font-semibold text-verde-oscuro">
          Sesión {sesion.numero} · {fechaLarga(sesion.fecha)}
        </h2>
        <p className="mt-1 text-sm text-suave">
          Responsable: <span className="font-semibold text-texto">{sesion.responsable.nombreCompleto}</span> ·
          Registrada por {nombre(sesion.creadoPor)} el {fechaLarga(sesion.creadoEn)}
        </p>
        <h3 className="mt-5 text-sm font-semibold text-texto">Evolución</h3>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-texto">{sesion.evolucion}</p>
      </Tarjeta>

      <TareasDeSesion carpeta={carpeta} sesion={sesion} nombre={nombre} />
    </div>
  )
}

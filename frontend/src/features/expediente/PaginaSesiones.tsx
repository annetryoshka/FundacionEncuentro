import { Link } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, Cargando, Insignia, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { listarSesiones, listarTareas } from './expedienteApi'
import { SeccionCarpeta } from './SeccionCarpeta'

/** FE-72 · Sesiones del caso, en orden ascendente por fecha y número (FE-71). */
export function PaginaSesiones() {
  return <SeccionCarpeta titulo="Sesiones y tareas">{(carpeta) => <ListaSesiones carpeta={carpeta} />}</SeccionCarpeta>
}

function ListaSesiones({ carpeta }: { carpeta: CarpetaDetalle }) {
  const sesiones = useCarga(() => listarSesiones(carpeta.id), [carpeta.id])
  // Las tareas solo agregan un contador por sesión: si fallan, la lista de sesiones sigue sirviendo.
  const tareas = useCarga(() => listarTareas(carpeta.id), [carpeta.id])
  const sinTerapeuta = !carpeta.terapeuta

  return (
    <Tarjeta>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-verde-oscuro">Sesiones registradas</h2>
        {!sinTerapeuta && (
          <Link
            to={`/carpetas/${carpeta.id}/sesiones/nueva`}
            className="inline-flex items-center justify-center rounded-full bg-verde px-5 py-2.5 font-semibold text-white transition-colors hover:bg-verde-oscuro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            Registrar sesión
          </Link>
        )}
      </div>

      {sinTerapeuta && (
        <Aviso tipo="info" className="mt-4">
          Para registrar sesiones, la carpeta necesita una terapeuta asignada. La dirección puede asignarla desde el{' '}
          <Link to={`/carpetas/${carpeta.id}`} className="font-semibold underline underline-offset-2">
            resumen de la carpeta
          </Link>
          .
        </Aviso>
      )}

      <div className="mt-4">
        {sesiones.error !== undefined ? (
          <ErrorDeCarga
            error={sesiones.error}
            alReintentar={sesiones.recargar}
            contexto="No se pudieron cargar las sesiones."
          />
        ) : !sesiones.datos ? (
          <Cargando texto="Cargando sesiones…" />
        ) : sesiones.datos.length === 0 ? (
          <p className="py-4 text-suave">Aún no hay sesiones registradas en esta carpeta.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {sesiones.datos.map((s) => {
              const suyas = tareas.datos?.filter((t) => t.sesionId === s.id) ?? []
              const pendientes = suyas.filter((t) => t.estado === 'pendiente').length
              return (
                <li key={s.id}>
                  <Link
                    to={`/carpetas/${carpeta.id}/sesiones/${s.id}`}
                    className="-mx-3 flex flex-col gap-1 rounded-xl px-3 py-3 transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:outline-naranja sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="font-semibold text-verde-oscuro">Sesión {s.numero}</span>
                      <span className="text-texto"> · {fechaLarga(s.fecha)}</span>
                      <span className="block text-sm text-suave">Responsable: {s.responsable.nombreCompleto}</span>
                    </span>
                    {tareas.datos && (
                      <span className="flex gap-2">
                        {suyas.length === 0 ? (
                          <Insignia>Sin tareas</Insignia>
                        ) : (
                          <Insignia color={pendientes > 0 ? 'naranja' : 'verde'}>
                            {suyas.length} {suyas.length === 1 ? 'tarea' : 'tareas'}
                            {pendientes > 0 ? ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : ' · al día'}
                          </Insignia>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Tarjeta>
  )
}

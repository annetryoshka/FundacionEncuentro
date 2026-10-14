import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { Aviso, Cargando, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { AsignacionTerapeuta } from './AsignacionTerapeuta'
import { obtenerCarpeta } from './carpetasApi'
import { EtiquetaEstado } from './Etiquetas'
import { NOMBRE_TIPO, numeroCarpeta, type CarpetaDetalle } from './tipos'

/**
 * Resumen de la carpeta (FE-31) con la asignación de terapeuta (FE-36).
 * Si la carpeta no existe o no es de la persona, el backend responde 404/403 y se muestra lo mismo:
 * así cambiar el id en la URL no revela si un caso ajeno existe (FE-35).
 */
export function PaginaCarpeta() {
  const { id = '' } = useParams()
  const { tieneRol } = useSesion()
  const ubicacion = useLocation()
  const recienCreada = Boolean((ubicacion.state as { recienCreada?: boolean } | null)?.recienCreada)

  const { datos, error, recargar } = useCarga(() => obtenerCarpeta(id), [id])
  // Tras asignar terapeuta se muestra la versión que devolvió el backend, sin volver a cargar.
  const [actualizada, setActualizada] = useState<CarpetaDetalle | null>(null)
  const carpeta = actualizada && actualizada.id === datos?.id ? actualizada : datos

  const refExito = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (recienCreada && carpeta) refExito.current?.focus()
  }, [recienCreada, carpeta])

  return (
    <div className="space-y-6">
      <Link to="/carpetas" className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline">
        Volver a carpetas
      </Link>

      {error !== undefined ? (
        error instanceof ErrorApi && (error.estado === 404 || error.estado === 403) ? (
          <div className="max-w-prose">
            <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos esta carpeta</h1>
            <p className="mt-2 text-suave">
              Puede que el enlace no sea correcto o que la carpeta no esté asignada a tu cuenta.
            </p>
          </div>
        ) : (
          <ErrorDeCarga error={error} alReintentar={recargar} />
        )
      ) : !carpeta ? (
        <Cargando texto="Abriendo carpeta…" />
      ) : (
        <>
          {recienCreada && (
            <Aviso ref={refExito} tipo="exito">
              <p className="text-base">
                Carpeta <strong>{numeroCarpeta(carpeta.numero)}</strong> ({NOMBRE_TIPO[carpeta.tipo].toLowerCase()})
                abierta para {carpeta.paciente.nombreCompleto}.
              </p>
              <p className="mt-1">
                Puedes encontrarla buscando ese número.{' '}
                <Link to="/carpetas/nueva" className="font-semibold underline underline-offset-2">
                  Registrar otro paciente
                </Link>
              </p>
            </Aviso>
          )}

          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-naranja-texto">
                Carpeta {numeroCarpeta(carpeta.numero)}
                <span className="font-normal text-suave"> ({NOMBRE_TIPO[carpeta.tipo]})</span>
              </p>
              <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">
                {carpeta.paciente.nombreCompleto}
              </h1>
            </div>
            <EtiquetaEstado estado={carpeta.estado} />
          </header>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Tarjeta>
              <h2 className="text-lg font-semibold text-verde-oscuro">Resumen</h2>
              <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Dato titulo="Número de carpeta">{numeroCarpeta(carpeta.numero)}</Dato>
                <Dato titulo="Tipo de ingreso">{NOMBRE_TIPO[carpeta.tipo]}</Dato>
                <Dato titulo="Fecha de ingreso">{fechaLarga(carpeta.fechaIngreso)}</Dato>
                <Dato titulo="Estado">
                  <EtiquetaEstado estado={carpeta.estado} />
                </Dato>
                <Dato titulo="Registrada por" ancho>
                  {carpeta.creadoPor?.nombreCompleto ?? 'Sin dato'}, el {fechaLarga(carpeta.creadoEn)}
                </Dato>
              </dl>
            </Tarjeta>

            <AsignacionTerapeuta
              carpeta={carpeta}
              puedeAsignar={tieneRol('administrador')}
              alActualizar={setActualizada}
            />
          </div>

          <Tarjeta className="border-dashed">
            <h2 className="text-lg font-semibold text-verde-oscuro">Fichas y seguimiento</h2>
            <p className="mt-1 text-suave">
              Las fichas de diagnóstico, de seguimiento y las tareas terapéuticas estarán disponibles pronto.
            </p>
          </Tarjeta>
        </>
      )}
    </div>
  )
}

function Dato({ titulo, children, ancho = false }: { titulo: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-suave">{titulo}</dt>
      <dd className="mt-0.5 font-medium text-texto">{children}</dd>
    </div>
  )
}

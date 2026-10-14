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
import { NOMBRE_TIPO, numeroCarpeta, type CarpetaDetalle, type PosibleDuplicado } from './tipos'

interface EstadoNavegacion {
  recienCreada?: boolean
  posiblesDuplicados?: PosibleDuplicado[]
}

const SIN_DATO = <span className="text-suave">Sin dato</span>

/**
 * Resumen de la carpeta (FE-31) con GET /api/casos/:id, y asignación de terapeuta (FE-36).
 * Si la carpeta no existe o no es de la persona, el backend responde 404/403 y se muestra lo mismo:
 * así cambiar el id en la URL no revela si un caso ajeno existe (FE-35).
 */
export function PaginaCarpeta() {
  const { id = '' } = useParams()
  const { tieneRol } = useSesion()
  const ubicacion = useLocation()
  const navegacion = (ubicacion.state as EstadoNavegacion | null) ?? {}
  const recienCreada = Boolean(navegacion.recienCreada)
  const duplicados = navegacion.posiblesDuplicados ?? []

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
        error instanceof ErrorApi && (error.estado === 404 || error.estado === 403 || error.estado === 400) ? (
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
            <div ref={refExito} tabIndex={-1} className="space-y-3 focus:outline-none">
              <Aviso tipo="exito">
                <p className="text-base">
                  Carpeta <strong>{numeroCarpeta(carpeta.numeroCorrelativo)}</strong> (
                  {NOMBRE_TIPO[carpeta.tipo].toLowerCase()}) abierta para {carpeta.paciente.nombreCompleto}.
                </p>
                <p className="mt-1">
                  <Link to="/carpetas/nueva" className="font-semibold underline underline-offset-2">
                    Registrar otro paciente
                  </Link>
                </p>
              </Aviso>
              {duplicados.length > 0 && (
                <Aviso tipo="info">
                  <p className="font-semibold">
                    Revisa si es la misma persona: ya hay pacientes con un nombre parecido.
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {duplicados.map((d) => (
                      <li key={d.pacienteId}>
                        <Link
                          to={`/carpetas?q=${encodeURIComponent(d.nombreCompleto)}`}
                          className="underline underline-offset-2"
                        >
                          {d.nombreCompleto}
                        </Link>{' '}
                        <span className="text-suave">({Math.round(d.similitud * 100)}% parecido)</span>
                      </li>
                    ))}
                  </ul>
                </Aviso>
              )}
            </div>
          )}

          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-naranja-texto">
                Carpeta {numeroCarpeta(carpeta.numeroCorrelativo)}
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
                <Dato titulo="Número de carpeta">{numeroCarpeta(carpeta.numeroCorrelativo)}</Dato>
                <Dato titulo="Tipo de ingreso">{NOMBRE_TIPO[carpeta.tipo]}</Dato>
                <Dato titulo="Fecha de ingreso">{fechaLarga(carpeta.fechaIngreso)}</Dato>
                <Dato titulo="Estado">
                  <EtiquetaEstado estado={carpeta.estado} />
                </Dato>
                <Dato titulo="Fecha de nacimiento">
                  {carpeta.paciente.fechaNacimiento ? fechaLarga(carpeta.paciente.fechaNacimiento) : SIN_DATO}
                </Dato>
                <Dato titulo="Edad al ingreso">
                  {carpeta.paciente.edadAlIngreso != null ? `${carpeta.paciente.edadAlIngreso} años` : SIN_DATO}
                </Dato>
                <Dato titulo="Teléfono">{carpeta.paciente.telefono ?? SIN_DATO}</Dato>
                <Dato titulo="Registrada el">{fechaLarga(carpeta.creadoEn)}</Dato>
                {carpeta.diagnosticoIngreso && (
                  <Dato titulo="Motivo de consulta o diagnóstico de ingreso" ancho>
                    <span className="whitespace-pre-line">{carpeta.diagnosticoIngreso}</span>
                  </Dato>
                )}
              </dl>
            </Tarjeta>

            <div className="space-y-6">
              <AsignacionTerapeuta
                carpeta={carpeta}
                puedeAsignar={tieneRol('administrador')}
                alActualizar={setActualizada}
              />

              {carpeta.contextoJudicial && (
                <Tarjeta>
                  <h2 className="text-lg font-semibold text-verde-oscuro">Contexto de la derivación</h2>
                  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Dato titulo="Juzgado o institución">{carpeta.contextoJudicial.juzgado ?? SIN_DATO}</Dato>
                    <Dato titulo="Nº de expediente">{carpeta.contextoJudicial.nroExpediente ?? SIN_DATO}</Dato>
                    <Dato titulo="Fecha de derivación">
                      {carpeta.contextoJudicial.fechaDerivacion
                        ? fechaLarga(carpeta.contextoJudicial.fechaDerivacion)
                        : SIN_DATO}
                    </Dato>
                    {carpeta.contextoJudicial.observaciones && (
                      <Dato titulo="Observaciones" ancho>
                        <span className="whitespace-pre-line">{carpeta.contextoJudicial.observaciones}</span>
                      </Dato>
                    )}
                  </dl>
                </Tarjeta>
              )}
            </div>
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

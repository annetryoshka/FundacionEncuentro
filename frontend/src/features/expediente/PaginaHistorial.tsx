import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Cargando, Insignia, Tarjeta } from '../../componentes/ui'
import { fechaCorta, fechaLarga } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { EtiquetaClasificacion, EtiquetaEstado } from '../carpetas/Etiquetas'
import { NOMBRE_TIPO, numeroCarpeta, type CarpetaDetalle } from '../carpetas/tipos'
import { crearNombrador } from './autoria'
import { listarPagos, obtenerHistorial } from './expedienteApi'
import { bolivianos } from './moneda'
import { EtiquetaConstancia } from './PaginaConstancia'
import { SeccionCarpeta } from './SeccionCarpeta'
import { NOMBRE_ESTADO_TAREA, NOMBRE_METODO_PAGO, type Historial } from './tipos'

/**
 * FE-82 · Historial clínico inicial (secciones y permisos de FE-81), en este orden: identificación,
 * contexto y constancia, diagnóstico, sesiones con sus tareas y, solo para administración, pagos.
 * La respuesta clínica no trae montos; los pagos se consultan aparte y su error no oculta lo demás.
 */
export function PaginaHistorial() {
  return <SeccionCarpeta titulo="Historial clínico">{(carpeta) => <VistaHistorial carpeta={carpeta} />}</SeccionCarpeta>
}

function VistaHistorial({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario, tieneRol } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerHistorial(carpeta.id), [carpeta.id])
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo cargar el historial." />
  }
  if (!datos) return <Cargando texto="Cargando historial…" />

  const { carpeta: caso, contexto, constancia, diagnostico, sesiones } = datos

  return (
    <div className="space-y-6">
      <Seccion numero={1} titulo="Identificación">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <Dato titulo="Paciente">{caso.paciente.nombreCompleto}</Dato>
          <Dato titulo="Carpeta">
            {numeroCarpeta(caso.numero)} · {NOMBRE_TIPO[caso.tipo]}
          </Dato>
          <Dato titulo="Fecha de ingreso">{fechaLarga(caso.fechaIngreso)}</Dato>
          <Dato titulo="Clasificación">
            <EtiquetaClasificacion clasificacion={caso.clasificacion} />
          </Dato>
          <Dato titulo="Estado">
            <EtiquetaEstado estado={caso.estado} />
          </Dato>
          <Dato titulo="Terapeuta responsable">{caso.terapeuta?.nombreCompleto ?? 'Sin asignar'}</Dato>
        </dl>
      </Seccion>

      <Seccion numero={2} titulo="Contexto y constancia" enlace={`/carpetas/${carpeta.id}/constancia`}>
        {!constancia && !contexto ? (
          <SinRegistro />
        ) : (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            {constancia && (
              <>
                <Dato titulo="Procedencia">{constancia.procedencia ?? 'Sin registro'}</Dato>
                <Dato titulo="Origen judicial">{constancia.origenJudicial ? 'Sí' : 'No'}</Dato>
                <Dato titulo="Constancia">
                  <EtiquetaConstancia estado={constancia.estado} />
                </Dato>
                {constancia.estado === 'registrado' && (
                  <>
                    <Dato titulo="Fecha del consentimiento">
                      {constancia.fechaConsentimiento ? fechaLarga(constancia.fechaConsentimiento) : 'Sin registro'}
                    </Dato>
                    <Dato titulo="Referencia de evidencia" ancho>
                      {constancia.referenciaEvidencia}
                    </Dato>
                  </>
                )}
                {constancia.estado === 'no_aplica' && (
                  <Dato titulo="Explicación" ancho>
                    {constancia.explicacion}
                  </Dato>
                )}
              </>
            )}
            {contexto && (
              <>
                <Dato titulo="Juzgado">{contexto.juzgado ?? 'Sin registro'}</Dato>
                <Dato titulo="Nº de expediente">{contexto.nroExpediente ?? 'Sin registro'}</Dato>
                <Dato titulo="Fecha de derivación">
                  {contexto.fechaDerivacion ? fechaLarga(contexto.fechaDerivacion) : 'Sin registro'}
                </Dato>
              </>
            )}
          </dl>
        )}
      </Seccion>

      <Seccion numero={3} titulo="Diagnóstico" enlace={`/carpetas/${carpeta.id}/diagnostico`}>
        {!diagnostico ? (
          <SinRegistro />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-suave">
              Evaluación del {fechaLarga(diagnostico.fecha)} · Última actualización por{' '}
              {nombre(diagnostico.actualizadoPor)} el {fechaLarga(diagnostico.actualizadoEn)}
            </p>
            <Texto titulo="Diagnóstico de ingreso">{diagnostico.diagnosticoIngreso}</Texto>
            <Texto titulo="Hipótesis relacional">{diagnostico.hipotesisRelacional}</Texto>
            <Texto titulo="Comentarios clínicos">{diagnostico.comentariosClinicos}</Texto>
          </div>
        )}
      </Seccion>

      <Seccion numero={4} titulo="Sesiones y tareas" enlace={`/carpetas/${carpeta.id}/sesiones`}>
        {sesiones.length === 0 ? (
          <SinRegistro />
        ) : (
          <ol className="space-y-5">
            {sesiones.map((s) => (
              <li key={s.id} className="rounded-2xl border border-linea p-4">
                <Link
                  to={`/carpetas/${carpeta.id}/sesiones/${s.id}`}
                  className="font-semibold text-verde-oscuro underline-offset-4 hover:underline"
                >
                  Sesión {s.numero} · {fechaLarga(s.fecha)}
                </Link>
                <p className="text-sm text-suave">Responsable: {s.responsable.nombreCompleto}</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-texto">{s.evolucion}</p>
                <h4 className="mt-3 text-sm font-semibold text-texto">Tareas</h4>
                {s.tareas.length === 0 ? (
                  <p className="text-sm text-suave">Sin tareas.</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {s.tareas.map((t) => (
                      <li key={t.id} className="flex items-start gap-2">
                        <Insignia color={t.estado === 'realizada' ? 'verde' : 'naranja'}>
                          {NOMBRE_ESTADO_TAREA[t.estado]}
                        </Insignia>
                        <span className="text-texto">{t.descripcion}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Seccion>

      {tieneRol('administrador') && <PagosDelHistorial carpetaId={carpeta.id} sesiones={sesiones} />}
    </div>
  )
}

function PagosDelHistorial({ carpetaId, sesiones }: { carpetaId: string; sesiones: Historial['sesiones'] }) {
  const { datos, error, recargar } = useCarga(() => listarPagos(carpetaId), [carpetaId])
  const numero = new Map(sesiones.map((s) => [s.id, s]))
  return (
    <Seccion numero={5} titulo="Pagos" enlace={`/carpetas/${carpetaId}/pagos`}>
      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar los pagos." />
      ) : !datos ? (
        <Cargando texto="Cargando pagos…" />
      ) : datos.length === 0 ? (
        <SinRegistro />
      ) : (
        <ul className="divide-y divide-linea">
          {datos.map((p) => {
            const s = numero.get(p.sesionId)
            return (
              <li key={p.id} className="flex justify-between gap-4 py-2">
                <span>
                  {s ? `Sesión ${s.numero} (${fechaCorta(s.fecha)})` : 'Sesión'} · pagado el {fechaCorta(p.fecha)} ·{' '}
                  {NOMBRE_METODO_PAGO[p.metodo]}
                </span>
                <span className="font-semibold tabular-nums">{bolivianos(p.monto)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Seccion>
  )
}

function Seccion({
  numero,
  titulo,
  enlace,
  children,
}: {
  numero: number
  titulo: string
  enlace?: string
  children: ReactNode
}) {
  return (
    <Tarjeta>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-verde-oscuro">
          <span className="text-naranja-texto">{numero}.</span> {titulo}
        </h2>
        {enlace && (
          <Link
            to={enlace}
            aria-label={`Abrir ${titulo.toLowerCase()}`}
            className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline"
          >
            Abrir
          </Link>
        )}
      </div>
      {children}
    </Tarjeta>
  )
}

const SinRegistro = () => <p className="text-suave italic">Sin registro</p>

function Dato({ titulo, children, ancho = false }: { titulo: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-3' : undefined}>
      <dt className="text-sm text-suave">{titulo}</dt>
      <dd className="mt-0.5 font-medium text-texto">{children}</dd>
    </div>
  )
}

function Texto({ titulo, children }: { titulo: string; children: string | null }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-texto">
        {children || <span className="text-suave italic">Sin registro</span>}
      </p>
    </div>
  )
}

import { useRef, useState, type FormEvent } from 'react'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, AreaTexto, Boton, Cargando, Insignia, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { mensajeNoGuardado, LIMITE_TEXTO_LARGO, tieneTexto } from './errores'
import { cambiarCumplimiento, crearTarea, listarTareas } from './expedienteApi'
import { NOMBRE_ESTADO_TAREA, type SesionResumen, type Tarea } from './tipos'

interface Props {
  carpeta: CarpetaDetalle
  sesion: SesionResumen
  nombre: (id: string | null | undefined) => string
}

/**
 * FE-77 · Tareas terapéuticas de una sesión (reglas FE-76). Nacen pendientes; la persona autorizada las marca
 * como realizadas o las devuelve a pendiente si corrige. Cada tarea muestra quién cambió su cumplimiento.
 */
export function TareasDeSesion({ carpeta, sesion, nombre }: Props) {
  const { datos, error, recargar } = useCarga(() => listarTareas(carpeta.id), [carpeta.id])
  // Cambios confirmados por el backend en esta pantalla (altas y cumplimiento), por id.
  const [locales, setLocales] = useState<Record<string, Tarea>>({})

  const tareas = [
    ...(datos ?? []).map((t) => locales[t.id] ?? t),
    ...Object.values(locales).filter((t) => !datos?.some((d) => d.id === t.id)),
  ].filter((t) => t.sesionId === sesion.id)

  const guardarLocal = (tarea: Tarea) => setLocales((previo) => ({ ...previo, [tarea.id]: tarea }))

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Tareas de esta sesión</h2>

      <div className="mt-3">
        {error !== undefined ? (
          <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar las tareas." />
        ) : !datos ? (
          <Cargando texto="Cargando tareas…" />
        ) : tareas.length === 0 ? (
          <p className="text-suave">Esta sesión todavía no tiene tareas.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {tareas.map((t) => (
              <FilaTarea key={t.id} carpetaId={carpeta.id} tarea={t} nombre={nombre} alCambiar={guardarLocal} />
            ))}
          </ul>
        )}
      </div>

      {datos && <NuevaTarea carpetaId={carpeta.id} sesionId={sesion.id} alCrear={guardarLocal} />}
    </Tarjeta>
  )
}

function FilaTarea({
  carpetaId,
  tarea,
  nombre,
  alCambiar,
}: {
  carpetaId: string
  tarea: Tarea
  nombre: Props['nombre']
  alCambiar: (tarea: Tarea) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const realizada = tarea.estado === 'realizada'

  async function alternar() {
    setGuardando(true)
    setFallo(null)
    try {
      alCambiar(await cambiarCumplimiento(carpetaId, tarea.id, realizada ? 'pendiente' : 'realizada'))
    } catch (error) {
      setFallo(mensajeNoGuardado(error))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Insignia color={realizada ? 'verde' : 'naranja'}>{NOMBRE_ESTADO_TAREA[tarea.estado]}</Insignia>
        <p className="mt-1.5 whitespace-pre-wrap text-texto">{tarea.descripcion}</p>
        <p className="mt-1 text-sm text-suave">
          Asignada el {fechaLarga(tarea.fecha)}
          {tarea.cumplimientoActualizadoEn &&
            ` · Cumplimiento actualizado por ${nombre(tarea.cumplimientoActualizadoPor)} el ${fechaLarga(tarea.cumplimientoActualizadoEn)}`}
        </p>
        {fallo && (
          <Aviso tipo="error" className="mt-2">
            {fallo}
          </Aviso>
        )}
      </div>
      <Boton
        variante="secundario"
        className="shrink-0"
        onClick={alternar}
        cargando={guardando}
        textoCargando="Guardando…"
        aria-label={`${realizada ? 'Volver a pendiente' : 'Marcar como realizada'}: ${tarea.descripcion}`}
      >
        {realizada ? 'Volver a pendiente' : 'Marcar como realizada'}
      </Boton>
    </li>
  )
}

function NuevaTarea({
  carpetaId,
  sesionId,
  alCrear,
}: {
  carpetaId: string
  sesionId: string
  alCrear: (tarea: Tarea) => void
}) {
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string>()
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const refCampo = useRef<HTMLTextAreaElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setResultado(null)
    if (!tieneTexto(descripcion)) {
      setError('Describe la tarea.')
      return refCampo.current?.focus()
    }
    setError(undefined)
    setGuardando(true)
    try {
      alCrear(await crearTarea(carpetaId, { sesionId, descripcion: descripcion.trim() }))
      setDescripcion('')
      setResultado({ tipo: 'exito', texto: 'Tarea agregada como pendiente.' })
    } catch (e) {
      setResultado({ tipo: 'error', texto: mensajeNoGuardado(e) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-5 border-t border-linea pt-5">
      <AreaTexto
        ref={refCampo}
        etiqueta="Nueva tarea"
        rows={2}
        value={descripcion}
        maxLength={LIMITE_TEXTO_LARGO}
        onChange={(e) => setDescripcion(e.target.value)}
        error={error}
        ayuda="Actividad que el paciente o la familia realizará antes de la próxima sesión."
      />
      {resultado && (
        <Aviso tipo={resultado.tipo} className="mt-3">
          {resultado.texto}
        </Aviso>
      )}
      <div className="mt-3 flex justify-end">
        <Boton type="submit" variante="secundario" cargando={guardando} textoCargando="Agregando…">
          Agregar tarea
        </Boton>
      </div>
    </form>
  )
}

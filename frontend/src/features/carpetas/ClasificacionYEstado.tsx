import { useId, useRef, useState } from 'react'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { claseCampo } from '../../componentes/estilos'
import { Aviso, Boton, Tarjeta } from '../../componentes/ui'
import { actualizarClasificacion, actualizarEstado } from './carpetasApi'
import { EtiquetaClasificacion, EtiquetaEstado } from './Etiquetas'
import {
  NOMBRE_CLASIFICACION,
  NOMBRE_ESTADO,
  SIN_CLASIFICAR,
  type CarpetaDetalle,
  type Clasificacion,
  type EstadoCaso,
} from './tipos'

interface Props {
  carpeta: CarpetaDetalle
  /** Administración o la terapeuta asignada. El backend vuelve a comprobarlo en cada guardado. */
  puedeEditar: boolean
  alGuardar: (cambio: { clasificacion: Clasificacion } | { estado: EstadoCaso }) => void
}

/**
 * FE-47 · Clasificación y estado del caso dentro de la carpeta (historia FE-14).
 * Son dos guardados independientes (PATCH /carpetas/:id/clasificacion y PATCH /casos/:id/estado):
 * cada uno muestra su propio resultado y un error en uno no toca al otro. Ninguno cambia el número,
 * el origen, el paciente ni la terapeuta asignada.
 */
export function ClasificacionYEstado({ carpeta, puedeEditar, alGuardar }: Props) {
  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Clasificación y estado</h2>

      {puedeEditar ? (
        <div className="mt-4 space-y-5">
          <ControlGuardado<Clasificacion>
            // key: al abrir otra carpeta, el control empieza con los datos de esa carpeta.
            key={`clasificacion-${carpeta.id}`}
            etiqueta="Clasificación"
            actual={carpeta.clasificacion}
            opciones={NOMBRE_CLASIFICACION}
            textoSinValor={SIN_CLASIFICAR}
            textoBoton="Guardar clasificación"
            guardar={(valor) => actualizarClasificacion(carpeta.id, valor)}
            alGuardar={(clasificacion) => alGuardar({ clasificacion })}
            mensajeExito={(nombre) => `Clasificación guardada: ${nombre}.`}
            ayuda={carpeta.clasificacion ? undefined : 'Esta carpeta todavía no está clasificada.'}
          />
          <ControlGuardado<EstadoCaso>
            key={`estado-${carpeta.id}`}
            etiqueta="Estado del caso"
            actual={carpeta.estado}
            opciones={NOMBRE_ESTADO}
            textoBoton="Guardar estado"
            guardar={(valor) => actualizarEstado(carpeta.id, valor)}
            alGuardar={(estado) => alGuardar({ estado })}
            mensajeExito={(nombre) => `Estado guardado: ${nombre}.`}
          />
        </div>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-suave">Clasificación</dt>
            <dd className="mt-1">
              <EtiquetaClasificacion clasificacion={carpeta.clasificacion} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-suave">Estado del caso</dt>
            <dd className="mt-1">
              <EtiquetaEstado estado={carpeta.estado} />
            </dd>
          </div>
        </dl>
      )}
    </Tarjeta>
  )
}

interface PropsControl<T extends string> {
  etiqueta: string
  /** Valor confirmado por el backend. null = sin valor todavía. */
  actual: T | null
  opciones: Record<T, string>
  /** Opción que representa «sin valor». No se puede volver a ella: el backend no la acepta. */
  textoSinValor?: string
  textoBoton: string
  guardar: (valor: T) => Promise<unknown>
  alGuardar: (valor: T) => void
  mensajeExito: (nombre: string) => string
  ayuda?: string
}

/** Un selector con su botón y su resultado. El botón solo se activa si hay un cambio que guardar. */
function ControlGuardado<T extends string>({
  etiqueta,
  actual,
  opciones,
  textoSinValor,
  textoBoton,
  guardar,
  alGuardar,
  mensajeExito,
  ayuda,
}: PropsControl<T>) {
  const [elegido, setElegido] = useState<T | ''>(actual ?? '')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const refAviso = useRef<HTMLDivElement>(null)
  const id = useId()
  const sinCambios = elegido === '' || elegido === actual

  const enviar = async () => {
    if (elegido === '' || elegido === actual) return
    setGuardando(true)
    setResultado(null)
    try {
      await guardar(elegido)
      setResultado({ tipo: 'exito', texto: mensajeExito(opciones[elegido]) })
      alGuardar(elegido)
    } catch (error) {
      // Tras un error se conserva lo elegido para reintentar; el dato guardado sigue siendo el anterior.
      setResultado({ tipo: 'error', texto: mensajeDeError(error) })
    } finally {
      setGuardando(false)
      requestAnimationFrame(() => refAviso.current?.focus())
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-valor`} className="block text-sm font-semibold text-texto">
        {etiqueta}
      </label>
      <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
        <select
          id={`${id}-valor`}
          value={elegido}
          onChange={(e) => {
            setElegido(e.target.value as T)
            setResultado(null)
          }}
          disabled={guardando}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className={`${claseCampo(false)} mt-0 sm:flex-1`}
        >
          {actual === null && (
            <option value="" disabled>
              {textoSinValor ?? 'Elige una opción'}
            </option>
          )}
          {(Object.entries(opciones) as [T, string][]).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
              {valor === actual ? ' (actual)' : ''}
            </option>
          ))}
        </select>
        <Boton onClick={enviar} disabled={sinCambios} cargando={guardando} textoCargando="Guardando…">
          {textoBoton}
        </Boton>
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-suave">
          {ayuda}
        </p>
      )}

      {resultado && (
        <Aviso ref={refAviso} tipo={resultado.tipo} className="mt-3">
          {resultado.texto}
        </Aviso>
      )}
    </div>
  )
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) {
    // Una reasignación pudo quitarle el caso a la terapeuta entre abrir la carpeta y guardar.
    if (error.estado === 404) return 'No se guardó: esta carpeta ya no está disponible para tu cuenta.'
    if (error.estado === 400) return `No se guardó: el servidor no aceptó el valor (${error.message}).`
  }
  return `No se guardó. ${mensajeErrorGeneral(error)}`
}

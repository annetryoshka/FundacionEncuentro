import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, AreaTexto, Boton, CampoTexto, Cargando, Tarjeta } from '../../componentes/ui'
import { esFechaValida, fechaLarga, hoyIso } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { crearNombrador } from './autoria'
import { mensajeNoGuardado, LIMITE_TEXTO_LARGO, tieneTexto } from './errores'
import { guardarDiagnostico, obtenerDiagnostico } from './expedienteApi'
import { SeccionCarpeta } from './SeccionCarpeta'
import type { Diagnostico } from './tipos'

/**
 * FE-67 · Ficha de diagnóstico vigente del caso (una por carpeta). Se crea o edita con PUT; al editar, el
 * backend conserva el id y la autoría de creación. Ficha ausente y error de carga se muestran distinto (FE-66).
 */
export function PaginaDiagnostico() {
  return (
    <SeccionCarpeta titulo="Ficha de diagnóstico">{(carpeta) => <VistaDiagnostico carpeta={carpeta} />}</SeccionCarpeta>
  )
}

function VistaDiagnostico({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerDiagnostico(carpeta.id), [carpeta.id])
  const [guardado, setGuardado] = useState<Diagnostico | null>(null)
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState(false)
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo cargar la ficha de diagnóstico." />
  }
  if (datos === undefined) return <Cargando texto="Cargando ficha…" />

  const ficha = guardado ?? datos

  if (editando || !ficha) {
    if (!editando) {
      return (
        <Tarjeta className="max-w-3xl">
          <p className="text-lg font-semibold text-verde-oscuro">Sin ficha de diagnóstico</p>
          <p className="mt-1 text-suave">Esta carpeta todavía no tiene una ficha de diagnóstico registrada.</p>
          <Boton className="mt-4" onClick={() => setEditando(true)}>
            Crear ficha
          </Boton>
        </Tarjeta>
      )
    }
    return (
      <FormularioDiagnostico
        carpetaId={carpeta.id}
        actual={ficha}
        alCancelar={() => setEditando(false)}
        alGuardar={(nueva) => {
          setGuardado(nueva)
          setEditando(false)
          setExito(true)
          requestAnimationFrame(() => refExito.current?.focus())
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      {exito && (
        <Aviso ref={refExito} tipo="exito">
          Ficha de diagnóstico guardada.
        </Aviso>
      )}
      <Tarjeta>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-verde-oscuro">Evaluación del {fechaLarga(ficha.fecha)}</h2>
            <p className="mt-1 text-sm text-suave">
              Creada por {nombre(ficha.creadoPor)} el {fechaLarga(ficha.creadoEn)} · Última actualización por{' '}
              {nombre(ficha.actualizadoPor)} el {fechaLarga(ficha.actualizadoEn)}
            </p>
          </div>
          <Boton
            variante="secundario"
            onClick={() => {
              setExito(false)
              setEditando(true)
            }}
          >
            Editar ficha
          </Boton>
        </div>
        <dl className="mt-5 space-y-5">
          <Campo titulo="Diagnóstico de ingreso">{ficha.diagnosticoIngreso}</Campo>
          <Campo titulo="Hipótesis relacional">{ficha.hipotesisRelacional}</Campo>
          <Campo titulo="Comentarios clínicos">{ficha.comentariosClinicos}</Campo>
        </dl>
      </Tarjeta>
    </div>
  )
}

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-texto">{titulo}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-texto">
        {children || <span className="text-suave italic">Sin registro</span>}
      </dd>
    </div>
  )
}

interface Errores {
  fecha?: string
  diagnosticoIngreso?: string
}

function FormularioDiagnostico({
  carpetaId,
  actual,
  alCancelar,
  alGuardar,
}: {
  carpetaId: string
  actual: Diagnostico | null
  alCancelar: () => void
  alGuardar: (ficha: Diagnostico) => void
}) {
  const [fecha, setFecha] = useState(actual?.fecha ?? hoyIso())
  const [diagnosticoIngreso, setDiagnosticoIngreso] = useState(actual?.diagnosticoIngreso ?? '')
  const [hipotesisRelacional, setHipotesis] = useState(actual?.hipotesisRelacional ?? '')
  const [comentariosClinicos, setComentarios] = useState(actual?.comentariosClinicos ?? '')
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refFecha = useRef<HTMLInputElement>(null)
  const refDiagnostico = useRef<HTMLTextAreaElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    const encontrados: Errores = {}
    if (!fecha) encontrados.fecha = 'Indica la fecha de la evaluación.'
    else if (!esFechaValida(fecha)) encontrados.fecha = 'La fecha no es válida.'
    if (!tieneTexto(diagnosticoIngreso)) encontrados.diagnosticoIngreso = 'Escribe el diagnóstico de ingreso.'
    setErrores(encontrados)
    setFallo(null)
    if (encontrados.fecha) return refFecha.current?.focus()
    if (encontrados.diagnosticoIngreso) return refDiagnostico.current?.focus()

    setGuardando(true)
    try {
      alGuardar(
        await guardarDiagnostico(carpetaId, {
          fecha,
          diagnosticoIngreso: diagnosticoIngreso.trim(),
          hipotesisRelacional: hipotesisRelacional.trim() || null,
          comentariosClinicos: comentariosClinicos.trim() || null,
        }),
      )
    } catch (error) {
      setFallo(mensajeNoGuardado(error))
      setGuardando(false)
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  return (
    <Tarjeta className="max-w-3xl">
      <form onSubmit={enviar} noValidate className="space-y-5">
        <h2 className="text-lg font-semibold text-verde-oscuro">{actual ? 'Editar ficha' : 'Nueva ficha'}</h2>
        <CampoTexto
          ref={refFecha}
          etiqueta="Fecha de evaluación"
          type="date"
          max="9999-12-31"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={errores.fecha}
          className="max-w-xs"
        />
        <AreaTexto
          ref={refDiagnostico}
          etiqueta="Diagnóstico de ingreso"
          value={diagnosticoIngreso}
          maxLength={LIMITE_TEXTO_LARGO}
          onChange={(e) => setDiagnosticoIngreso(e.target.value)}
          error={errores.diagnosticoIngreso}
        />
        <AreaTexto
          etiqueta="Hipótesis relacional (opcional)"
          value={hipotesisRelacional}
          maxLength={LIMITE_TEXTO_LARGO}
          onChange={(e) => setHipotesis(e.target.value)}
        />
        <AreaTexto
          etiqueta="Comentarios clínicos (opcional)"
          value={comentariosClinicos}
          maxLength={LIMITE_TEXTO_LARGO}
          onChange={(e) => setComentarios(e.target.value)}
        />
        {fallo && (
          <Aviso ref={refFallo} tipo="error">
            {fallo}
          </Aviso>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton variante="texto" onClick={alCancelar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardando} textoCargando="Guardando…">
            Guardar ficha
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

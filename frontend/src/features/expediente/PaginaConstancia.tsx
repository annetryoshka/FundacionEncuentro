import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, AreaTexto, Boton, CampoTexto, Cargando, GrupoOpciones, Insignia, Tarjeta } from '../../componentes/ui'
import { esFechaValida, fechaLarga } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { NOMBRE_TIPO, type CarpetaDetalle } from '../carpetas/tipos'
import { crearNombrador } from './autoria'
import { enfocarPrimerError, mensajeNoGuardado, tieneTexto } from './errores'
import { guardarConstancia, obtenerConstancia } from './expedienteApi'
import { SeccionCarpeta } from './SeccionCarpeta'
import { NOMBRE_ESTADO_CONSTANCIA, type Constancia, type EstadoConstancia } from './tipos'

/**
 * FE-62 · Origen del caso y constancia de consentimiento (reglas FE-61). El origen técnico (voluntario o
 * derivado) es de solo lectura. Pendiente no lleva datos; Registrada exige fecha y referencia de evidencia;
 * No aplica exige una explicación. Si el origen es judicial, se guarda también el contexto judicial
 * (juzgado obligatorio; expediente, fecha de derivación y observaciones opcionales) en el mismo PUT.
 * Guardar no cambia número, tipo ni clasificación de la carpeta.
 */
export function PaginaConstancia() {
  return (
    <SeccionCarpeta titulo="Origen y consentimiento">
      {(carpeta) => <VistaConstancia carpeta={carpeta} />}
    </SeccionCarpeta>
  )
}

function VistaConstancia({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerConstancia(carpeta.id), [carpeta.id])
  const [guardada, setGuardada] = useState<Constancia | null>(null)
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState(false)
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo cargar la constancia." />
  }
  if (datos === undefined) return <Cargando texto="Cargando constancia…" />

  const constancia = guardada ?? datos

  if (editando) {
    return (
      <FormularioConstancia
        carpeta={carpeta}
        actual={constancia}
        alCancelar={() => setEditando(false)}
        alGuardar={(nueva) => {
          setGuardada(nueva)
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
          Origen y constancia guardados.
        </Aviso>
      )}
      <Tarjeta>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-verde-oscuro">Origen del caso</h2>
          <Boton
            variante="secundario"
            onClick={() => {
              setExito(false)
              setEditando(true)
            }}
          >
            {constancia ? 'Editar' : 'Registrar origen y constancia'}
          </Boton>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Dato titulo="Tipo de ingreso">{NOMBRE_TIPO[carpeta.tipo]}</Dato>
          <Dato titulo="Procedencia">{constancia?.procedencia}</Dato>
          <Dato titulo="Origen judicial">{constancia ? (constancia.origenJudicial ? 'Sí' : 'No') : null}</Dato>
          {constancia?.origenJudicial && (
            <>
              <Dato titulo="Juzgado">{constancia.contextoJudicial?.juzgado}</Dato>
              <Dato titulo="Nº de expediente">{constancia.contextoJudicial?.nroExpediente}</Dato>
              <Dato titulo="Fecha de derivación">
                {constancia.contextoJudicial?.fechaDerivacion &&
                  fechaLarga(constancia.contextoJudicial.fechaDerivacion)}
              </Dato>
              <Dato titulo="Observaciones judiciales" ancho>
                {constancia.contextoJudicial?.observaciones}
              </Dato>
            </>
          )}
        </dl>

        <h2 className="mt-7 text-lg font-semibold text-verde-oscuro">Constancia de consentimiento</h2>
        {!constancia ? (
          <p className="mt-2 text-suave">Sin registro. Todavía no se registró el origen ni la constancia.</p>
        ) : (
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato titulo="Estado">
              <EtiquetaConstancia estado={constancia.estado} />
            </Dato>
            {constancia.estado === 'registrado' && (
              <>
                <Dato titulo="Fecha del consentimiento">
                  {constancia.fechaConsentimiento && fechaLarga(constancia.fechaConsentimiento)}
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
            <Dato titulo="Última actualización" ancho>
              {nombre(constancia.actualizadoPor)}, el {fechaLarga(constancia.actualizadoEn)}
            </Dato>
          </dl>
        )}
      </Tarjeta>
    </div>
  )
}

export function EtiquetaConstancia({ estado }: { estado: EstadoConstancia }) {
  const color = estado === 'registrado' ? 'verde' : estado === 'pendiente' ? 'naranja' : 'gris'
  return <Insignia color={color}>{NOMBRE_ESTADO_CONSTANCIA[estado]}</Insignia>
}

function Dato({ titulo, children, ancho = false }: { titulo: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-suave">{titulo}</dt>
      <dd className="mt-0.5 font-medium whitespace-pre-wrap text-texto">
        {children || <span className="font-normal text-suave italic">Sin registro</span>}
      </dd>
    </div>
  )
}

interface Errores {
  procedencia?: string
  juzgado?: string
  nroExpediente?: string
  fechaDerivacion?: string
  observaciones?: string
  estado?: string
  fechaConsentimiento?: string
  referenciaEvidencia?: string
  explicacion?: string
}

function FormularioConstancia({
  carpeta,
  actual,
  alCancelar,
  alGuardar,
}: {
  carpeta: CarpetaDetalle
  actual: Constancia | null
  alCancelar: () => void
  alGuardar: (constancia: Constancia) => void
}) {
  const [procedencia, setProcedencia] = useState(actual?.procedencia ?? '')
  const [origenJudicial, setOrigenJudicial] = useState(actual?.origenJudicial ?? false)
  const [estado, setEstado] = useState<EstadoConstancia>(actual?.estado ?? 'pendiente')
  const [fechaConsentimiento, setFecha] = useState(actual?.fechaConsentimiento ?? '')
  const [referenciaEvidencia, setReferencia] = useState(actual?.referenciaEvidencia ?? '')
  const [explicacion, setExplicacion] = useState(actual?.explicacion ?? '')
  const judicialPrevio = actual?.contextoJudicial
  const [juzgado, setJuzgado] = useState(judicialPrevio?.juzgado ?? '')
  const [nroExpediente, setNroExpediente] = useState(judicialPrevio?.nroExpediente ?? '')
  const [fechaDerivacion, setFechaDerivacion] = useState(judicialPrevio?.fechaDerivacion ?? '')
  const [observaciones, setObservaciones] = useState(judicialPrevio?.observaciones ?? '')
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const refFormulario = useRef<HTMLFormElement>(null)

  function validar(): Errores {
    const e: Errores = {}
    if (procedencia.length > 500) e.procedencia = 'La procedencia supera los 500 caracteres.'
    if (origenJudicial) {
      if (!tieneTexto(juzgado)) e.juzgado = 'Indica el juzgado que derivó el caso.'
      else if (juzgado.length > 200) e.juzgado = 'El juzgado supera los 200 caracteres.'
      if (nroExpediente.length > 100) e.nroExpediente = 'El número de expediente supera los 100 caracteres.'
      if (fechaDerivacion && !esFechaValida(fechaDerivacion)) e.fechaDerivacion = 'La fecha no es válida.'
      if (observaciones.length > 1000) e.observaciones = 'Las observaciones superan los 1000 caracteres.'
    }
    if (estado === 'registrado') {
      if (!fechaConsentimiento) e.fechaConsentimiento = 'Indica la fecha del consentimiento.'
      else if (!esFechaValida(fechaConsentimiento)) e.fechaConsentimiento = 'La fecha no es válida.'
      if (!tieneTexto(referenciaEvidencia)) e.referenciaEvidencia = 'Indica la referencia de la evidencia.'
      else if (referenciaEvidencia.length > 1000) e.referenciaEvidencia = 'La referencia supera los 1000 caracteres.'
    }
    if (estado === 'no_aplica') {
      if (!tieneTexto(explicacion)) e.explicacion = 'Explica por qué no aplica la constancia.'
      else if (explicacion.length > 1000) e.explicacion = 'La explicación supera los 1000 caracteres.'
    }
    return e
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    const encontrados = validar()
    setErrores(encontrados)
    setFallo(null)
    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(refFormulario.current)
      return
    }
    setGuardando(true)
    try {
      // Solo se envían los datos que corresponden al estado elegido: el backend rechaza los demás.
      alGuardar(
        await guardarConstancia(carpeta.id, {
          procedencia: procedencia.trim() || null,
          origenJudicial,
          estado,
          fechaConsentimiento: estado === 'registrado' ? fechaConsentimiento : null,
          referenciaEvidencia: estado === 'registrado' ? referenciaEvidencia.trim() : null,
          explicacion: estado === 'no_aplica' ? explicacion.trim() : null,
          // Origen no judicial: el backend rechaza el contexto y borra el que hubiera.
          contextoJudicial: origenJudicial
            ? {
                juzgado: juzgado.trim(),
                nroExpediente: nroExpediente.trim() || null,
                fechaDerivacion: fechaDerivacion || null,
                observaciones: observaciones.trim() || null,
              }
            : null,
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
      <form ref={refFormulario} onSubmit={enviar} noValidate className="space-y-5">
        <p className="text-sm text-suave">
          Tipo de ingreso: <span className="font-semibold text-texto">{NOMBRE_TIPO[carpeta.tipo]}</span> (no se cambia
          aquí).
        </p>
        <CampoTexto
          etiqueta="Procedencia (opcional)"
          value={procedencia}
          maxLength={500}
          onChange={(e) => setProcedencia(e.target.value)}
          error={errores.procedencia}
          ayuda="Entidad o persona que derivó el caso."
        />
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={origenJudicial}
            onChange={(e) => setOrigenJudicial(e.target.checked)}
            className="size-5 accent-verde"
          />
          <span className="font-medium text-texto">El caso proviene de un juzgado</span>
        </label>

        {origenJudicial && (
          <fieldset className="space-y-5 rounded-2xl border border-linea p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-texto">Contexto judicial</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto
                etiqueta="Juzgado"
                value={juzgado}
                maxLength={200}
                onChange={(e) => setJuzgado(e.target.value)}
                error={errores.juzgado}
              />
              <CampoTexto
                etiqueta="Nº de expediente (opcional)"
                value={nroExpediente}
                maxLength={100}
                onChange={(e) => setNroExpediente(e.target.value)}
                error={errores.nroExpediente}
              />
              <CampoTexto
                etiqueta="Fecha de derivación (opcional)"
                type="date"
                max="9999-12-31"
                value={fechaDerivacion}
                onChange={(e) => setFechaDerivacion(e.target.value)}
                error={errores.fechaDerivacion}
              />
            </div>
            <AreaTexto
              etiqueta="Observaciones judiciales (opcional)"
              rows={3}
              value={observaciones}
              maxLength={1000}
              onChange={(e) => setObservaciones(e.target.value)}
              error={errores.observaciones}
              ayuda="Por ejemplo, qué corresponde a la atención clínica y qué a la intervención judicial."
            />
          </fieldset>
        )}
        {!origenJudicial && judicialPrevio && (
          <Aviso tipo="info">Al guardar como no judicial se borrará el contexto judicial registrado.</Aviso>
        )}

        <GrupoOpciones<EstadoConstancia>
          leyenda="Constancia de consentimiento"
          nombre="estado-constancia"
          valor={estado}
          alCambiar={setEstado}
          error={errores.estado}
          opciones={[
            { valor: 'pendiente', nombre: 'Pendiente', descripcion: 'Todavía no se firmó o no se recibió.' },
            { valor: 'registrado', nombre: 'Registrada', descripcion: 'Requiere fecha y referencia de evidencia.' },
            { valor: 'no_aplica', nombre: 'No aplica', descripcion: 'Requiere una explicación.' },
          ]}
        />

        {estado === 'registrado' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoTexto
              etiqueta="Fecha del consentimiento"
              type="date"
              max="9999-12-31"
              value={fechaConsentimiento}
              onChange={(e) => setFecha(e.target.value)}
              error={errores.fechaConsentimiento}
            />
            <CampoTexto
              etiqueta="Referencia de evidencia"
              value={referenciaEvidencia}
              maxLength={1000}
              onChange={(e) => setReferencia(e.target.value)}
              error={errores.referenciaEvidencia}
              ayuda="Código o ubicación del documento firmado."
            />
          </div>
        )}
        {estado === 'no_aplica' && (
          <AreaTexto
            etiqueta="Explicación"
            rows={3}
            value={explicacion}
            maxLength={1000}
            onChange={(e) => setExplicacion(e.target.value)}
            error={errores.explicacion}
          />
        )}

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
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

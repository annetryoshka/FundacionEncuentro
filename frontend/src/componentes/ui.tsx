/**
 * Piezas de interfaz reutilizables con la identidad de Fundación Encuentro.
 * Mantienen igual la accesibilidad en todas las pantallas: etiqueta, error asociado, foco visible.
 */
import { claseCampo } from './estilos'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

// ---- Botones ---------------------------------------------------------------

type VarianteBoton = 'primario' | 'secundario' | 'texto'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-verde text-white hover:bg-verde-oscuro px-5 py-3',
  secundario: 'border border-verde bg-white text-verde hover:bg-verde hover:text-white px-5 py-2.5',
  texto: 'text-naranja-texto hover:text-naranja px-2 py-1.5 underline-offset-4 hover:underline',
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  cargando?: boolean
  textoCargando?: string
}

export function Boton({
  variante = 'primario',
  cargando = false,
  textoCargando,
  className = '',
  children,
  disabled,
  ...resto
}: PropsBoton) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja disabled:cursor-not-allowed disabled:opacity-70 ${ESTILO_BOTON[variante]} ${className}`}
    >
      {cargando && <Indicador />}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  )
}

export function Indicador({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin motion-reduce:hidden`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ---- Campos ----------------------------------------------------------------

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  error?: string
  ayuda?: ReactNode
  /** Elemento a la derecha dentro del campo (p. ej. botón Mostrar). */
  accesorio?: ReactNode
}

export const CampoTexto = forwardRef<HTMLInputElement, PropsCampo>(function CampoTexto(
  { etiqueta, error, ayuda, accesorio, id, className = '', ...resto },
  ref,
) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const describe = [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={idCampo} className="block text-sm font-semibold text-texto">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          className={`${claseCampo(Boolean(error))} ${accesorio ? 'pr-24' : ''}`}
          {...resto}
        />
        {accesorio}
      </div>
      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-sm text-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
})

interface PropsArea extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string
  error?: string
  ayuda?: ReactNode
}

/** Texto largo (observaciones, motivo de consulta) con la misma accesibilidad que CampoTexto. */
export function AreaTexto({ etiqueta, error, ayuda, id, className = '', rows = 3, ...resto }: PropsArea) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado
  const describe = [ayuda && `${idCampo}-ayuda`, error && `${idCampo}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="block text-sm font-semibold text-texto">
        {etiqueta}
      </label>
      <textarea
        id={idCampo}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        className={`${claseCampo(Boolean(error))} resize-y`}
        {...resto}
      />
      {ayuda && !error && (
        <p id={`${idCampo}-ayuda`} className="mt-1.5 text-sm text-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${idCampo}-error`} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

interface Opcion<T extends string> {
  valor: T
  nombre: string
  descripcion?: string
}

interface PropsOpciones<T extends string> {
  leyenda: string
  nombre: string
  opciones: Opcion<T>[]
  valor: T | ''
  alCambiar: (valor: T) => void
  error?: string
}

/** Grupo de opciones (radio) en forma de tarjetas: más claro que un select para 2-3 opciones. */
export function GrupoOpciones<T extends string>({
  leyenda,
  nombre,
  opciones,
  valor,
  alCambiar,
  error,
}: PropsOpciones<T>) {
  const id = useId()
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-semibold text-texto">{leyenda}</legend>
      <div className="mt-1.5 grid gap-2">
        {opciones.map((opcion) => {
          const elegida = valor === opcion.valor
          return (
            <label
              key={opcion.valor}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-verde/30 ${
                elegida ? 'border-verde bg-verde/5' : error ? 'border-error' : 'border-linea hover:border-suave'
              }`}
            >
              <input
                type="radio"
                name={nombre}
                value={opcion.valor}
                checked={elegida}
                onChange={() => alCambiar(opcion.valor)}
                className="mt-1 size-4 accent-verde"
              />
              <span>
                <span className="block font-medium text-texto">{opcion.nombre}</span>
                {opcion.descripcion && <span className="block text-sm text-suave">{opcion.descripcion}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}

// ---- Avisos y etiquetas ----------------------------------------------------

type TipoAviso = 'error' | 'exito' | 'info'

const ESTILO_AVISO: Record<TipoAviso, string> = {
  error: 'border-error bg-error-fondo text-error',
  exito: 'border-verde bg-verde/8 text-verde-oscuro',
  info: 'border-naranja bg-naranja/8 text-texto',
}

export const Aviso = forwardRef<HTMLDivElement, { tipo: TipoAviso; children: ReactNode; className?: string }>(
  function Aviso({ tipo, children, className = '' }, ref) {
    return (
      <div
        ref={ref}
        role={tipo === 'error' ? 'alert' : 'status'}
        tabIndex={-1}
        className={`rounded-xl border-l-4 px-4 py-3 text-sm focus:outline-none ${ESTILO_AVISO[tipo]} ${className}`}
      >
        {children}
      </div>
    )
  },
)

type ColorInsignia = 'verde' | 'naranja' | 'gris'

const ESTILO_INSIGNIA: Record<ColorInsignia, string> = {
  verde: 'bg-verde/10 text-verde-oscuro',
  naranja: 'bg-naranja/12 text-naranja-texto',
  gris: 'bg-linea/60 text-suave',
}

export function Insignia({ color = 'gris', children }: { color?: ColorInsignia; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_INSIGNIA[color]}`}
    >
      {children}
    </span>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-linea bg-white p-5 sm:p-7 ${className}`}>{children}</section>
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: ReactNode
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1.5 max-w-prose text-suave">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}

/** Estado de carga de una sección. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2.5 py-8 text-suave">
      <Indicador className="size-5 text-verde" />
      {texto}
    </p>
  )
}

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Boton } from '../../componentes/ui'
import { Icono } from '../../componentes/iconos'
import { elementosDe, type PasoRecorrido } from './recorridos'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const MARGEN = 16
const HOLGURA = 8
const SEPARACION = 12
/** Distancia al borde superior a la que se lleva el elemento señalado. */
const ARRIBA = 32

/** Rectángulo que abarca todos los elementos del paso, en coordenadas de la ventana. */
function medir(elementos: HTMLElement[]): Rect | null {
  if (elementos.length === 0) return null
  const rects = elementos.map((el) => el.getBoundingClientRect())
  const top = Math.min(...rects.map((r) => r.top))
  const left = Math.min(...rects.map((r) => r.left))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const right = Math.max(...rects.map((r) => r.right))
  return {
    top: top - HOLGURA,
    left: left - HOLGURA,
    width: right - left + 2 * HOLGURA,
    height: bottom - top + 2 * HOLGURA,
  }
}

/**
 * Debajo del elemento si cabe; si no, encima, a la derecha o a la izquierda. Si el elemento ocupa casi toda la
 * pantalla, el cuadro va abajo, en la esquina que menos lo tapa.
 */
function ubicarCuadro(objetivo: Rect, ancho: number, alto: number) {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const ajustarX = (x: number) => Math.min(Math.max(x, MARGEN), Math.max(MARGEN, vw - ancho - MARGEN))
  const ajustarY = (y: number) => Math.min(Math.max(y, MARGEN), Math.max(MARGEN, vh - alto - MARGEN))
  const derecha = objetivo.left + objetivo.width
  const abajo = objetivo.top + objetivo.height

  if (abajo + SEPARACION + alto + MARGEN <= vh) return { top: abajo + SEPARACION, left: ajustarX(objetivo.left) }
  if (objetivo.top - SEPARACION - alto >= MARGEN)
    return { top: objetivo.top - SEPARACION - alto, left: ajustarX(objetivo.left) }
  if (derecha + SEPARACION + ancho + MARGEN <= vw) return { top: ajustarY(objetivo.top), left: derecha + SEPARACION }
  if (objetivo.left - SEPARACION - ancho >= MARGEN)
    return { top: ajustarY(objetivo.top), left: objetivo.left - SEPARACION - ancho }
  const centro = objetivo.left + objetivo.width / 2
  return { top: vh - alto - MARGEN, left: centro > vw / 2 ? MARGEN : ajustarX(vw - ancho - MARGEN) }
}

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Recorrido guiado: oscurece la pantalla, resalta un elemento y explica qué hace, paso a paso.
 * Pensado para personas mayores: letra grande, botones con texto, sin avances automáticos.
 * Esc o «Salir» lo cierran; las flechas avanzan y retroceden. Mientras está abierto, la pantalla no recibe clics.
 */
export function Recorrido({ pasos, alCerrar }: { pasos: PasoRecorrido[]; alCerrar: () => void }) {
  const [indice, setIndice] = useState(0)
  const [objetivo, setObjetivo] = useState<Rect | null>(null)
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null)
  const refCuadro = useRef<HTMLDivElement>(null)
  const refSiguiente = useRef<HTMLButtonElement>(null)
  const id = useId()

  const paso = pasos[indice]
  const esUltimo = indice === pasos.length - 1

  const siguiente = useCallback(() => {
    if (esUltimo) alCerrar()
    else setIndice((i) => i + 1)
  }, [esUltimo, alCerrar])
  const anterior = useCallback(() => setIndice((i) => Math.max(0, i - 1)), [])

  // Lleva el elemento a la vista y sigue su posición mientras se desplaza la página o cambia la ventana.
  useEffect(() => {
    // Siempre cerca del borde superior: así queda sitio debajo para la explicación.
    const inicial = medir(elementosDe(paso))
    if (inicial) {
      const raiz = document.scrollingElement ?? document.documentElement
      raiz.scrollTo?.({
        top: raiz.scrollTop + inicial.top - ARRIBA,
        behavior: reducirMovimiento() ? 'auto' : 'smooth',
      })
    }
    let cuadro = 0
    const actualizar = () => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => setObjetivo(medir(elementosDe(paso))))
    }
    actualizar()
    window.addEventListener('scroll', actualizar, true)
    window.addEventListener('resize', actualizar)
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('scroll', actualizar, true)
      window.removeEventListener('resize', actualizar)
    }
  }, [paso])

  useLayoutEffect(() => {
    const cuadro = refCuadro.current
    if (!objetivo || !cuadro) return setPosicion(null)
    setPosicion(ubicarCuadro(objetivo, cuadro.offsetWidth, cuadro.offsetHeight))
  }, [objetivo, indice])

  useEffect(() => {
    refSiguiente.current?.focus()
  }, [indice])

  useEffect(() => {
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        alCerrar()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        siguiente()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        anterior()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [alCerrar, siguiente, anterior])

  // El foco no sale del cuadro mientras el recorrido está abierto.
  const atraparFoco = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !refCuadro.current) return
    const enfocables = [...refCuadro.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
    if (enfocables.length === 0) return
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  const resaltado = objetivo !== null

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      {/* Bloquea los clics sobre la pantalla; el oscurecido lo da el resaltado o este fondo. */}
      <div aria-hidden="true" className={`absolute inset-0 ${resaltado ? '' : 'bg-black/55'}`} />
      {resaltado && (
        <div
          aria-hidden="true"
          data-testid="recorrido-resaltado"
          className="pointer-events-none fixed rounded-2xl outline-4 outline-naranja"
          style={{ ...objetivo, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
        />
      )}

      <div
        ref={refCuadro}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        onKeyDown={atraparFoco}
        className={`fixed w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-linea bg-white p-6 shadow-2xl ${
          resaltado ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
        } ${resaltado && !posicion ? 'opacity-0' : ''}`}
        style={resaltado && posicion ? posicion : undefined}
      >
        <div aria-live="polite">
          <p className="text-base text-suave">
            Paso {indice + 1} de {pasos.length}
          </p>
          <h2 id={`${id}-titulo`} className="mt-1 text-2xl font-semibold text-verde-oscuro">
            {paso.titulo}
          </h2>
          <p id={`${id}-texto`} className="mt-3 text-lg leading-relaxed text-texto">
            {paso.texto}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap-reverse items-center justify-between gap-3">
          <Boton variante="texto" icono="cerrar" onClick={alCerrar}>
            Salir
          </Boton>
          <div className="flex gap-2">
            {indice > 0 && (
              <Boton variante="secundario" icono="anterior" onClick={anterior}>
                Atrás
              </Boton>
            )}
            <Boton ref={refSiguiente} onClick={siguiente}>
              {esUltimo ? 'Terminar' : 'Siguiente'}
              {!esUltimo && <Icono nombre="siguiente" className="size-[1.125rem]" />}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  )
}

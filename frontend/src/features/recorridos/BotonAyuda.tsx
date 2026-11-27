import { useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useSesion } from '../auth/sesion'
import { Recorrido } from './Recorrido'
import { pasosEnPantalla, recorridoDe, type PasoRecorrido } from './recorridos'

/**
 * Botón flotante «?»: abre el recorrido guiado de la pantalla actual. Nunca se abre solo.
 * Solo aparece en las pantallas que tienen recorrido; en las demás confundiría.
 */
export function BotonAyuda() {
  const { usuario } = useSesion()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState<{ ruta: string; pasos: PasoRecorrido[] } | null>(null)
  const refBoton = useRef<HTMLButtonElement>(null)

  const recorrido = usuario ? recorridoDe(pathname, usuario.rol) : null
  if (!recorrido) return null
  // Si cambia la pantalla, el recorrido abierto ya no corresponde.
  const pasos = abierto?.ruta === pathname ? abierto.pasos : null

  const abrir = () => setAbierto({ ruta: pathname, pasos: pasosEnPantalla(recorrido) })

  const cerrar = () => {
    setAbierto(null)
    refBoton.current?.focus()
  }

  return (
    <>
      <div className="group fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6 print:hidden">
        <button
          ref={refBoton}
          type="button"
          onClick={abrir}
          aria-label="Ayuda: cómo se usa esta pantalla"
          aria-haspopup="dialog"
          data-recorrido="boton-ayuda"
          className="flex size-14 items-center justify-center rounded-full border-2 border-verde bg-white text-2xl font-bold text-verde shadow-lg transition-colors hover:bg-verde hover:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          <span aria-hidden="true">?</span>
        </button>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-full bottom-1/2 mr-3 w-max translate-y-1/2 rounded-xl bg-verde-oscuro px-3 py-2 text-sm text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          ¿Cómo se usa esta pantalla?
        </span>
      </div>
      {pasos && <Recorrido key={pathname} pasos={pasos} alCerrar={cerrar} />}
    </>
  )
}

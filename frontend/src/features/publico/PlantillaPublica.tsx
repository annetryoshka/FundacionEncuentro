import { Link, NavLink, Outlet } from 'react-router'
import { Icono } from '../../componentes/iconos'
import { Logo } from '../../componentes/marca'
import { ENLACE_TELEFONO, INSTITUCIONAL } from './institucional'

const ENFOQUE = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja'
const ANIO = new Date().getFullYear()

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold ${ENFOQUE} ${isActive ? 'text-verde-oscuro underline decoration-2 underline-offset-8' : 'text-suave hover:text-verde-oscuro'}`

/**
 * Estructura del portal público (visitantes sin cuenta). No muestra ninguna navegación clínica.
 * `anchoCompleto`: la página arma sus propias franjas (inicio); si no, el contenido va centrado.
 */
export function PlantillaPublica({ anchoCompleto = false }: { anchoCompleto?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-verde-oscuro"
      >
        Saltar al contenido
      </a>
      <header className="relative z-20 border-b-4 border-naranja bg-white/95 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-8">
          <Link to="/" className={`flex items-center gap-2.5 rounded-full sm:gap-3 ${ENFOQUE}`}>
            <Logo className="size-10 shrink-0 sm:size-11" />
            <span className="text-sm font-semibold text-verde-oscuro sm:text-base">Fundación Encuentro</span>
          </Link>
          <Link
            to="/login"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-verde px-3.5 text-sm font-semibold whitespace-nowrap text-verde hover:bg-verde hover:text-white sm:order-last ${ENFOQUE}`}
          >
            <Icono nombre="personas" className="size-4" />
            <span className="sm:hidden" aria-hidden="true">
              Personal
            </span>
            <span className="sr-only sm:not-sr-only">Ingreso del personal</span>
          </Link>
          <nav aria-label="Portal" className="-mx-3 flex w-full items-center sm:mx-0 sm:ml-auto sm:w-auto">
            <NavLink to="/" end className={claseEnlace}>
              Inicio
            </NavLink>
            <NavLink to="/publicaciones" className={claseEnlace}>
              Actividades
            </NavLink>
            <Link to={{ pathname: '/', hash: '#contacto' }} className={claseEnlace({ isActive: false })}>
              Contacto
            </Link>
          </nav>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className={anchoCompleto ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10'}
      >
        <Outlet />
      </main>
      <PiePublico />
    </div>
  )
}

function PiePublico() {
  const enlace = `rounded text-white/90 underline-offset-4 hover:text-white hover:underline ${ENFOQUE}`
  return (
    <footer className="bg-verde-oscuro text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="size-14 shrink-0 bg-white" />
            <div>
              <p className="font-semibold">{INSTITUCIONAL.nombre}</p>
              <p className="font-script text-lg text-white/90">{INSTITUCIONAL.lema}</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">
            Terapia familiar sistémica para personas, parejas y familias en La Paz, Bolivia.
          </p>
        </div>
        <nav aria-label="Pie de página">
          <p className="font-semibold">Navegación</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className={enlace}>
                Inicio
              </Link>
            </li>
            <li>
              <Link to={{ pathname: '/', hash: '#servicios' }} className={enlace}>
                Servicios
              </Link>
            </li>
            <li>
              <Link to="/publicaciones" className={enlace}>
                Campañas, actividades y cursos
              </Link>
            </li>
            <li>
              <Link to="/login" className={enlace}>
                Acceso para el equipo
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="font-semibold">Contacto</p>
          <address className="mt-3 space-y-2 text-sm text-white/90 not-italic">
            <p>{INSTITUCIONAL.direccion}</p>
            <p>
              <a href={ENLACE_TELEFONO} className={`font-semibold ${enlace}`}>
                {INSTITUCIONAL.telefono}
              </a>
            </p>
            <p>{INSTITUCIONAL.horario}</p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/80 sm:px-8">
          © {ANIO} {INSTITUCIONAL.nombre} · La Paz, Bolivia
        </p>
      </div>
    </footer>
  )
}

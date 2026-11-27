import { Link, NavLink, Outlet } from 'react-router'
import { Icono } from '../../componentes/iconos'
import { Logo, PieContacto } from '../../componentes/marca'

/**
 * FE-149 · Estructura del portal público (visitantes sin cuenta). No muestra ninguna navegación clínica:
 * solo las publicaciones y el acceso del personal.
 */
export function PlantillaPublica() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-verde-oscuro"
      >
        Saltar al contenido
      </a>
      <header className="border-b-4 border-naranja bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:flex-nowrap sm:px-8">
          <Link
            to="/publicaciones"
            className="flex items-center gap-3 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            <Logo className="size-11 shrink-0" />
            <span className="font-semibold text-verde-oscuro">Fundación Encuentro</span>
          </Link>
          <nav aria-label="Portal" className="flex items-center gap-2 sm:gap-4">
            <NavLink
              to="/fundacion"
              className={({ isActive }) =>
                `rounded-full px-2 py-2 text-sm font-semibold ${isActive ? 'text-verde-oscuro underline underline-offset-4' : 'text-suave hover:text-verde-oscuro'}`
              }
            >
              Fundación
            </NavLink>
            <NavLink
              to="/publicaciones"
              end
              className={({ isActive }) =>
                `hidden rounded-full px-3 py-2 text-sm font-semibold sm:inline-block ${isActive ? 'text-verde-oscuro underline underline-offset-4' : 'text-suave hover:text-verde-oscuro'}`
              }
            >
              Publicaciones
            </NavLink>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-verde px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-verde hover:bg-verde hover:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              <Icono nombre="personas" className="size-4" />
              Ingreso del personal
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>
      <PieContacto />
    </div>
  )
}

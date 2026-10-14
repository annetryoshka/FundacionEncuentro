import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSesion } from '../features/auth/sesion'
import type { Rol } from '../features/auth/tipos'
import { nombreRol } from '../features/usuarios/tipos'
import { Logo, PieContacto } from './marca'

interface Seccion {
  ruta: string
  nombre: string
  roles: Rol[]
}

/** Menú principal. Cada sección solo aparece para los roles que pueden usarla. */
const SECCIONES: Seccion[] = [
  { ruta: '/inicio', nombre: 'Inicio', roles: ['administrador', 'terapeuta', 'marketing'] },
  { ruta: '/carpetas', nombre: 'Carpetas', roles: ['administrador', 'terapeuta'] },
  { ruta: '/usuarios', nombre: 'Cuentas del personal', roles: ['administrador'] },
]

/** FE-43 · Estructura común de las pantallas internas: cabecera con menú por rol, contenido y pie. */
export function Plantilla() {
  const { usuario, cerrarSesion } = useSesion()
  const navegar = useNavigate()
  const [saliendo, setSaliendo] = useState(false)
  if (!usuario) return null

  const secciones = SECCIONES.filter((s) => s.roles.includes(usuario.rol))

  // FE-24: cierra la sesión en el backend (FE-26) y borra el estado privado; replace evita volver con Atrás.
  const salir = async () => {
    setSaliendo(true)
    await cerrarSesion()
    navegar('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-verde-oscuro"
      >
        Saltar al contenido
      </a>

      <header className="border-b-4 border-naranja bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <NavLink
            to="/inicio"
            className="flex items-center gap-3 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            <Logo className="size-11 shrink-0" />
            <span className="hidden font-semibold text-verde-oscuro sm:inline">Fundación Encuentro</span>
          </NavLink>

          <div className="flex items-center gap-3 sm:gap-4">
            <p className="text-right text-sm leading-tight">
              <span className="block font-semibold text-texto">{usuario.nombreCompleto}</span>
              <span className="text-suave">{nombreRol(usuario.rol)}</span>
            </p>
            <button
              type="button"
              onClick={salir}
              disabled={saliendo}
              className="rounded-full border border-verde px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-verde hover:bg-verde hover:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>

        {secciones.length > 1 && (
          <nav aria-label="Secciones" className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-8">
            <ul className="flex gap-1">
              {secciones.map((s) => (
                <li key={s.ruta}>
                  <NavLink
                    to={s.ruta}
                    className={({ isActive }) =>
                      `block border-b-[3px] px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-naranja ${
                        isActive
                          ? 'border-verde text-verde-oscuro'
                          : 'border-transparent text-suave hover:text-verde-oscuro'
                      }`
                    }
                  >
                    {s.nombre}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>

      <PieContacto />
    </div>
  )
}

import { Link } from 'react-router'
import { useSesion } from '../features/auth/sesion'
import { nombreRol } from '../features/usuarios/tipos'

interface Atajo {
  ruta: string
  titulo: string
  texto: string
}

/** Primera pantalla tras el login: muestra solo las funciones que permite el rol (FE-20). */
export function PaginaInicio() {
  const { usuario, tieneRol } = useSesion()
  if (!usuario) return null

  const atajos: Atajo[] = []
  if (tieneRol('administrador', 'terapeuta')) {
    atajos.push({
      ruta: '/carpetas',
      titulo: tieneRol('administrador') ? 'Buscar carpetas' : 'Mis carpetas',
      texto: tieneRol('administrador')
        ? 'Busca a un paciente por nombre, tipo o estado.'
        : 'Las carpetas que la dirección te asigne.',
    })
  }
  if (tieneRol('administrador')) {
    atajos.push(
      {
        ruta: '/carpetas/nueva',
        titulo: 'Registrar paciente',
        texto: 'Abre su carpeta digital con número correlativo.',
      },
      { ruta: '/usuarios', titulo: 'Cuentas del personal', texto: 'Crea cuentas para terapeutas y personal de apoyo.' },
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Hola, {usuario.nombreCompleto}</h1>
      <p className="mt-1.5 text-suave">Entraste como {nombreRol(usuario.rol)}.</p>

      {atajos.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atajos.map((a) => (
            <li key={a.ruta}>
              <Link
                to={a.ruta}
                className="block h-full rounded-3xl border border-linea bg-white p-6 transition-colors hover:border-verde focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
              >
                <span className="block text-lg font-semibold text-verde-oscuro">{a.titulo}</span>
                <span className="mt-1 block text-suave">{a.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 max-w-prose rounded-3xl border border-linea bg-white p-6 text-suave">
          Tu cuenta no tiene acceso a la información clínica de los pacientes. Las herramientas de difusión llegarán en
          próximas versiones.
        </p>
      )}
    </div>
  )
}

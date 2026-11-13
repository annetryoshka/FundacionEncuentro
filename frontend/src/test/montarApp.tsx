/**
 * Monta la aplicación completa contra la API simulada (src/api/simulado/servidor.ts),
 * que aplica las mismas reglas del contrato: así las pruebas recorren pantallas reales.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { CONTRASENA_DEMO, atenderSimulado, reiniciarSimulacion } from '../api/simulado/servidor'
import { ProveedorSesion } from '../features/auth/ProveedorSesion'

export const CUENTAS = {
  direccion: 'direccion@fundacion.test',
  sofia: 'terapeuta1@fundacion.test',
  carla: 'terapeuta2@fundacion.test',
  apoyo: 'apoyo@fundacion.test',
} as const

/** IDs fijos de los datos ficticios. */
export const CARPETA_DE_SOFIA = '10000000-0000-4000-8000-000000000001' // Nº 1 voluntario, Mariana Gutiérrez Paz
export const CARPETA_SIN_ASIGNAR = '10000000-0000-4000-8000-000000000004' // Nº 3 voluntario, Lucía Fernández Roca
/** Sprint 2: carpeta de Sofía sin sesiones, diagnóstico, constancia ni pagos. */
export const CARPETA_VACIA_DE_SOFIA = '10000000-0000-4000-8000-000000000002' // Nº 1 derivado, Familia Condori Apaza
/** Sesiones ficticias de la carpeta de Sofía (src/api/simulado/expediente.ts). */
export const SESION_1 = '30000000-0000-4000-8000-000000000001' // 12/10/2026, con tarea realizada y pago
export const SESION_2 = '30000000-0000-4000-8000-000000000002' // 19/10/2026, con tarea pendiente

/**
 * La siguiente petición a `ruta` (sin query) con `metodo` falla: 'red' sin respuesta o un código HTTP.
 * Las demás siguen yendo a la API simulada.
 */
export function fallarUnaVez(
  fetchEspia: ReturnType<typeof usarApiSimulada>,
  metodo: string,
  ruta: string,
  fallo: 'red' | number = 'red',
) {
  const simulado = fetchEspia.getMockImplementation()!
  let pendiente = true
  fetchEspia.mockImplementation((entrada, init) => {
    const coincide =
      new URL(String(entrada), 'http://x').pathname === ruta &&
      ((init as RequestInit | undefined)?.method ?? 'GET') === metodo
    if (coincide && pendiente) {
      pendiente = false
      return fallo === 'red'
        ? Promise.reject(new TypeError('Fallo ficticio QA'))
        : Promise.resolve(Response.json({ message: 'Fallo ficticio QA' }, { status: fallo }))
    }
    return simulado(entrada, init)
  })
}

/** Redirige fetch a la API simulada. Devuelve el espía para revisar las llamadas. */
export function usarApiSimulada() {
  reiniciarSimulacion({ retardoMs: 0 })
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((entrada, init) => atenderSimulado(String(entrada), init as RequestInit))
}

/** Abre `ruta`; como no hay sesión, aparece el login, entra con `como` y vuelve a `ruta`. */
export async function montarApp(ruta: string, como: keyof typeof CUENTAS = 'direccion') {
  const fetchEspia = usarApiSimulada()
  const usuario = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </MemoryRouter>,
  )
  await usuario.type(screen.getByLabelText('Correo electrónico'), CUENTAS[como])
  await usuario.type(screen.getByLabelText('Contraseña'), CONTRASENA_DEMO)
  await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  await screen.findByRole('button', { name: 'Cerrar sesión' })
  return { usuario, fetchEspia }
}

/** Peticiones hechas con un método y ruta (sin query string). */
export function llamadas(fetchEspia: ReturnType<typeof usarApiSimulada>, metodo: string, ruta: string) {
  return fetchEspia.mock.calls.filter(([url, init]) => {
    const { pathname } = new URL(String(url), 'http://x')
    return pathname === ruta && ((init as RequestInit | undefined)?.method ?? 'GET') === metodo
  })
}

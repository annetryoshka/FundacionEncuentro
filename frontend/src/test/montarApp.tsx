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

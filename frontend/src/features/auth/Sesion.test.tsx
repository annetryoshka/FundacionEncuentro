import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { atenderSimulado } from '../../api/simulado/servidor'
import { CUENTAS, llamadas, montarApp, usarApiSimulada } from '../../test/montarApp'
import { CONTRASENA_DEMO } from '../../api/simulado/servidor'
import { ProveedorSesion } from './ProveedorSesion'

/** Sesión contra el contrato real de backend/src/modules/auth (FE-20, FE-22, FE-24, FE-26). */
describe('Sesión', () => {
  function abrirApp(ruta: string) {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </MemoryRouter>,
    )
  }

  it('al recargar la página recupera la sesión con el refresh token, sin pedir login', async () => {
    const fetchEspia = usarApiSimulada()
    const login = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: CUENTAS.direccion, password: CONTRASENA_DEMO }),
    })
    const { refreshToken } = (await login.json()) as { refreshToken: string }
    sessionStorage.setItem('fundacion-encuentro:refresh', refreshToken)

    abrirApp('/carpetas')

    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/refresh')).toHaveLength(1)
  })

  it('si el refresh token guardado ya no sirve, muestra el login sin errores', async () => {
    usarApiSimulada()
    sessionStorage.setItem('fundacion-encuentro:refresh', 'token-viejo')

    abrirApp('/carpetas')

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('fundacion-encuentro:refresh')).toBeNull()
  })

  it('cierra la sesión tras 30 minutos sin actividad (propuesta de FE-20)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const { fetchEspia } = await montarApp('/inicio', 'direccion')

    await vi.advanceTimersByTimeAsync(31 * 60_000)

    expect(await screen.findByText(/sin actividad/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/logout')).toHaveLength(1)
  })

  it('si el backend todavía no tiene el endpoint, la pantalla lo dice claramente', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio', 'direccion')
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation((entrada, init) =>
      String(entrada).startsWith('/api/carpetas')
        ? Promise.resolve(
            new Response(JSON.stringify({ statusCode: 404, message: 'Cannot GET /api/carpetas', error: 'Not Found' }), {
              status: 404,
            }),
          )
        : simulado(entrada, init),
    )

    await usuario.click(screen.getByRole('link', { name: 'Carpetas' }))

    expect(await screen.findByText(/todavía no está disponible en el servidor/)).toBeInTheDocument()
  })
})

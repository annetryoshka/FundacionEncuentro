import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import userEvent from '@testing-library/user-event'
import { peticion } from '../../api/cliente'
import { vencerTokensDeAcceso } from '../../api/simulado/servidor'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { atenderSimulado } from '../../api/simulado/servidor'
import { CUENTAS, llamadas, montarApp, usarApiSimulada } from '../../test/montarApp'
import { CONTRASENA_DEMO } from '../../api/simulado/servidor'
import { ProveedorSesion } from './ProveedorSesion'

/** Sesión contra el contrato real de backend/src/modules/auth (FE-20, FE-22, FE-24, FE-26). */
describe('Sesión', () => {
  it('descarta una renovación pendiente y bloquea nuevas consultas al cerrar', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas', 'direccion')
    await screen.findByText('14 carpetas')
    const simulado = fetchEspia.getMockImplementation()!
    let completar!: (respuesta: Response) => void
    let renovada!: Response
    fetchEspia.mockImplementation(async (entrada, init) => {
      if (String(entrada).endsWith('/auth/refresh')) {
        renovada = await simulado(entrada, init)
        return new Promise<Response>((resolve) => { completar = resolve })
      }
      return simulado(entrada, init)
    })
    vencerTokensDeAcceso()
    const consulta = peticion('/auth/me').catch((error: unknown) => error)
    await vi.waitFor(() => expect(completar).toBeTypeOf('function'))
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
    const numeroLlamadas = fetchEspia.mock.calls.length
    await expect(peticion('/carpetas')).rejects.toMatchObject({ estado: 401 })
    expect(fetchEspia.mock.calls).toHaveLength(numeroLlamadas)
    await act(async () => { completar(renovada); await consulta })
    expect(sessionStorage.length).toBe(0)
    expect(screen.queryByText('14 carpetas')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('limpia antes de recibir logout y comunica un fallo de revocación', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas', 'direccion')
    await screen.findByText('14 carpetas')
    const simulado = fetchEspia.getMockImplementation()!
    let fallar!: (error: Error) => void
    let entregar!: (respuesta: Response) => void
    fetchEspia.mockImplementation((entrada, init) => {
      if (String(entrada).endsWith('/auth/logout')) {
        return new Promise<Response>((_resolve, reject) => { fallar = reject })
      }
      if (String(entrada).endsWith('/auth/me')) {
        return new Promise<Response>((resolve) => { entregar = resolve })
      }
      return simulado(entrada, init)
    })
    const pendiente = peticion('/auth/me').catch((error: unknown) => error)
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
    expect(screen.queryByText('14 carpetas')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('pendiente de confirmar')
    entregar(new Response(JSON.stringify({ nombreCompleto: 'Dato privado tardío' })))
    await expect(pendiente).resolves.toMatchObject({ estado: 401 })
    await act(async () => { fallar(new Error('Sin conexión')) })
    expect(await screen.findByText(/No se pudo confirmar la revocación/)).toBeInTheDocument()
  })

  it('Atrás y recargar no reabren las rutas clínicas tras salir', async () => {
    usarApiSimulada()
    function Atras() {
      const navegar = useNavigate()
      return <button onClick={() => navegar(-1)}>Atrás</button>
    }
    const usuario = userEvent.setup()
    const vista = render(<MemoryRouter initialEntries={['/carpetas', '/login']}>
      <Atras /><ProveedorSesion><App /></ProveedorSesion>
    </MemoryRouter>)
    await usuario.type(screen.getByLabelText('Correo electrónico'), CUENTAS.direccion)
    await usuario.type(screen.getByLabelText('Contraseña'), CONTRASENA_DEMO)
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    await usuario.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('14 carpetas')).not.toBeInTheDocument()
    vista.unmount()
    abrirApp('/carpetas')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('14 carpetas')).not.toBeInTheDocument()
  })
  function abrirApp(ruta: string) {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </MemoryRouter>,
    )
  }

  it.each(['/login', '/carpetas'])('sin refresh token abre %s sin renovar ni quedar recuperando', async (ruta) => {
    const fetchEspia = usarApiSimulada()

    abrirApp(ruta)

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('Recuperando tu sesión…')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/refresh')).toHaveLength(0)
    expect(sessionStorage.getItem('fundacion-encuentro:refresh')).toBeNull()
  })

  it('termina la recuperación inicial y limpia el refresh token si falla la conexión', async () => {
    const fetchEspia = usarApiSimulada()
    sessionStorage.setItem('fundacion-encuentro:refresh', 'token-guardado')
    fetchEspia.mockRejectedValue(new TypeError('Sin conexión'))

    abrirApp('/carpetas')

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('Recuperando tu sesión…')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/refresh')).toHaveLength(1)
    expect(sessionStorage.getItem('fundacion-encuentro:refresh')).toBeNull()
  })

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
    const fetchEspia = usarApiSimulada()
    sessionStorage.setItem('fundacion-encuentro:refresh', 'token-viejo')

    abrirApp('/carpetas')

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Recuperando tu sesión…')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/refresh')).toHaveLength(1)
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

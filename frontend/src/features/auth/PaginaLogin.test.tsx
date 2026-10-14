import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { PaginaLogin } from './PaginaLogin'
import { ProveedorSesion } from './ProveedorSesion'
import { useSesion } from './sesion'

/** Misma forma que RespuestaSesion en backend/src/modules/auth/auth.service.ts */
const RESPUESTA_OK = {
  accessToken: 'jwt-de-prueba',
  refreshToken: 'refresh-de-prueba',
  expiresIn: 3600,
  usuario: { id: 'u1', nombreCompleto: 'Laura Quiroga', rol: 'administrador' },
}

function Inicio() {
  const { usuario } = useSesion()
  return <p>Bienvenida {usuario?.nombreCompleto}</p>
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <ProveedorSesion>
        <Routes>
          <Route path="/login" element={<PaginaLogin />} />
          <Route path="/inicio" element={<Inicio />} />
        </Routes>
      </ProveedorSesion>
    </MemoryRouter>,
  )
  return {
    usuario: userEvent.setup(),
    correo: screen.getByLabelText('Correo electrónico'),
    contrasena: screen.getByLabelText('Contraseña'),
    boton: screen.getByRole('button', { name: 'Iniciar sesión' }),
  }
}

const respuestaJson = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })

describe('PaginaLogin (FE-21)', () => {
  it('muestra los campos con sus etiquetas y autocompletado correcto', () => {
    const { correo, contrasena } = montar()
    expect(correo).toHaveAttribute('type', 'email')
    expect(correo).toHaveAttribute('autocomplete', 'username')
    expect(contrasena).toHaveAttribute('type', 'password')
    expect(contrasena).toHaveAttribute('autocomplete', 'current-password')
  })

  it('valida campos vacíos sin llamar a la API y enfoca el primer error', async () => {
    const fetchEspia = vi.spyOn(globalThis, 'fetch')
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.click(boton)

    expect(screen.getByText('Escribe tu correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(correo).toHaveAttribute('aria-invalid', 'true')
    expect(contrasena).toHaveAttribute('aria-invalid', 'true')
    expect(correo).toHaveFocus()
    expect(fetchEspia).not.toHaveBeenCalled()
  })

  it('quita el error mientras la persona corrige el campo', async () => {
    const { usuario, correo, boton } = montar()
    await usuario.click(boton)
    await usuario.type(correo, 'laura@fundacion.org')
    expect(screen.queryByText('Escribe tu correo electrónico.')).not.toBeInTheDocument()
    expect(correo).not.toHaveAttribute('aria-invalid')
  })

  it('cuenta activa con credenciales correctas: inicia sesión y entra', async () => {
    const fetchEspia = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuestaJson(200, RESPUESTA_OK))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, '  laura@fundacion.org ')
    await usuario.type(contrasena, 'Secreta123')
    await usuario.click(boton)

    expect(await screen.findByText('Bienvenida Laura Quiroga')).toBeInTheDocument()
    const [url, opciones] = fetchEspia.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(opciones?.method).toBe('POST')
    expect(JSON.parse(String(opciones?.body))).toEqual({ email: 'laura@fundacion.org', password: 'Secreta123' })
    // El refresh token queda solo en esta pestaña para recuperar la sesión al recargar.
    expect(sessionStorage.getItem('fundacion-encuentro:refresh')).toBe('refresh-de-prueba')
  })

  it('muestra el estado de carga y bloquea el doble envío', async () => {
    let resolver!: (r: Response) => void
    const fetchEspia = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => (resolver = r)))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, 'laura@fundacion.org')
    await usuario.type(contrasena, 'Secreta123')
    await usuario.click(boton)

    const cargando = screen.getByRole('button', { name: 'Iniciando sesión…' })
    expect(cargando).toBeDisabled()
    expect(correo).toBeDisabled()
    await usuario.click(cargando)
    expect(fetchEspia).toHaveBeenCalledTimes(1)

    resolver(respuestaJson(200, RESPUESTA_OK))
    expect(await screen.findByText('Bienvenida Laura Quiroga')).toBeInTheDocument()
  })

  // Respuestas reales de backend/src/modules/auth (supabase-auth.client.ts y auth.service.ts)
  it.each([
    [401, 'Correo o contraseña incorrectos'],
    [403, 'Tu usuario no tiene acceso al sistema'],
  ])('backend responde %i "%s": mensaje genérico y contraseña borrada', async (estado, mensaje) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuestaJson(estado, { statusCode: estado, message: mensaje }))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, 'laura@fundacion.org')
    await usuario.type(contrasena, 'mala')
    await usuario.click(boton)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El correo o la contraseña no son correctos, o la cuenta no está habilitada.')
    // No se filtra el motivo real que mandó el servidor.
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
    expect(contrasena).toHaveValue('')
    expect(correo).toHaveValue('laura@fundacion.org')
    await waitFor(() => expect(alerta).toHaveFocus())
    expect(boton).toBeEnabled()
  })

  it('sin conexión con el servidor: lo dice claramente', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, 'laura@fundacion.org')
    await usuario.type(contrasena, 'Secreta123')
    await usuario.click(boton)

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con el servidor')
  })

  it.each([
    [429, 'demasiados intentos'],
    [500, 'El servidor tuvo un problema'],
    [503, 'El servicio de inicio de sesión no responde'],
  ])('error %i: muestra un mensaje que indica qué hacer', async (estado, texto) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuestaJson(estado, { message: 'x' }))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, 'laura@fundacion.org')
    await usuario.type(contrasena, 'Secreta123')
    await usuario.click(boton)

    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(texto, 'i'))
  })

  it('permite mostrar y ocultar la contraseña', async () => {
    const { usuario, contrasena } = montar()
    const alternar = screen.getByRole('button', { name: 'Mostrar' })

    await usuario.click(alternar)
    expect(contrasena).toHaveAttribute('type', 'text')
    expect(alternar).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(contrasena).toHaveAttribute('type', 'password')
  })

  it('nunca escribe la contraseña en la consola', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuestaJson(401, { message: 'x' }))
    const { usuario, correo, contrasena, boton } = montar()

    await usuario.type(correo, 'laura@fundacion.org')
    await usuario.type(contrasena, 'ContrasenaSecreta!')
    await usuario.click(boton)
    await screen.findByRole('alert')

    const todo = espias.flatMap((e) => e.mock.calls.flat().map(String)).join(' ')
    expect(todo).not.toContain('ContrasenaSecreta!')
  })
})

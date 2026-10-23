import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTRASENA_DEMO, atenderSimulado } from '../../api/simulado/servidor'
import { llamadas, montarApp } from '../../test/montarApp'
import { generarContrasena, validarNuevoUsuario } from './validacion'

/** FE-28 · Listado y formulario de usuarios (criterios de FE-10). */
describe('PaginaUsuarios', () => {
  const tabla = () => screen.findByRole('table', { name: /Cuentas del personal/ })
  const campo = (nombre: string) => screen.getByLabelText(nombre, { selector: 'input' })

  it('lista las cuentas con nombre, correo, rol y estado, sin contraseñas', async () => {
    await montarApp('/usuarios')
    const filas = within(await tabla()).getAllByRole('row')
    expect(filas).toHaveLength(6) // encabezado + 5 cuentas
    expect(within(await tabla()).getAllByText('Elena Choque')[0]).toBeInTheDocument()
    expect(within(await tabla()).getByText('Inactiva')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(CONTRASENA_DEMO)
  })

  it('los campos obligatorios vacíos impiden guardar', async () => {
    const { usuario, fetchEspia } = await montarApp('/usuarios')
    await tabla()
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByText('Escribe el nombre completo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe el correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Elige el rol de la cuenta.')).toBeInTheDocument()
    expect(screen.getByText('Escribe o genera una contraseña inicial.')).toBeInTheDocument()
    expect(campo('Nombre completo')).toHaveFocus()
    expect(llamadas(fetchEspia, 'POST', '/api/usuarios')).toHaveLength(0)
  })

  it('no permite dos cuentas con el mismo correo', async () => {
    const { usuario } = await montarApp('/usuarios')
    await tabla()
    await usuario.type(campo('Nombre completo'), 'Otra Persona')
    await usuario.type(campo('Correo electrónico'), 'TERAPEUTA1@fundacion.test')
    await usuario.click(screen.getByRole('radio', { name: /Terapeuta/ }))
    await usuario.type(campo('Contraseña inicial'), 'Segura1234')
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeInTheDocument()
    expect(campo('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
  })

  it('crea la cuenta, la agrega al listado y esa persona puede iniciar sesión con su rol', async () => {
    const { usuario, fetchEspia } = await montarApp('/usuarios')
    await tabla()
    await usuario.type(campo('Nombre completo'), 'Ana Prueba')
    await usuario.type(campo('Correo electrónico'), 'ana@fundacion.test')
    await usuario.click(screen.getByRole('radio', { name: /Terapeuta/ }))
    await usuario.type(campo('Contraseña inicial'), 'Segura1234')
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText(/Cuenta creada para/)).toBeInTheDocument()
    expect(await within(await tabla()).findByText('Ana Prueba')).toBeInTheDocument()
    expect(campo('Nombre completo')).toHaveValue('')

    const [, init] = llamadas(fetchEspia, 'POST', '/api/usuarios')[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      nombreCompleto: 'Ana Prueba',
      email: 'ana@fundacion.test',
      rol: 'terapeuta',
      password: 'Segura1234',
    })

    const login = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ana@fundacion.test', password: 'Segura1234' }),
    })
    expect(login.status).toBe(200)
    expect((await login.json()).usuario.rol).toBe('terapeuta')
  })

  it('pide una contraseña inicial segura', () => {
    const base = { nombreCompleto: 'Ana', correo: 'a@b.co', rol: 'terapeuta' }
    expect(validarNuevoUsuario({ ...base, contrasenaInicial: 'Segura123' }).contrasenaInicial).toMatch(/10 caracteres/)
    expect(validarNuevoUsuario({ ...base, contrasenaInicial: 'sololetras' }).contrasenaInicial).toBeDefined()
    expect(validarNuevoUsuario({ ...base, contrasenaInicial: 'Segura1234' }).contrasenaInicial).toBeUndefined()
  })

  it('genera contraseñas que cumplen la política', () => {
    for (let i = 0; i < 50; i++) {
      const contrasena = generarContrasena()
      expect(
        validarNuevoUsuario({
          nombreCompleto: 'Ana',
          correo: 'a@b.co',
          rol: 'terapeuta',
          contrasenaInicial: contrasena,
        }),
      ).toEqual({})
    }
  })
})

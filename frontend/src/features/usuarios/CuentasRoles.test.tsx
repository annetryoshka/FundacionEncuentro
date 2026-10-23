import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { configurarSesionApi } from '../../api/cliente'
import { llamadas, montarApp } from '../../test/montarApp'
import { listarUsuarios } from './usuariosApi'

describe('FE-30: restricciones y contrato de cuentas', () => {
  it.each([
    ['/usuarios', 'apoyo'],
    ['/carpetas/nueva', 'sofia'],
    ['/carpetas/nueva', 'apoyo'],
    ['/carpetas/10000000-0000-4000-8000-000000000001', 'apoyo'],
  ] as const)('%s no se abre con la cuenta %s aunque se escriba la URL', async (ruta, cuenta) => {
    const { fetchEspia } = await montarApp(ruta, cuenta)
    expect(screen.getByRole('heading', { name: /no está disponible para tu cuenta/ })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/usuarios')).toHaveLength(0)
    expect(llamadas(fetchEspia, 'POST', '/api/usuarios')).toHaveLength(0)
    expect(llamadas(fetchEspia, 'POST', '/api/carpetas')).toHaveLength(0)
  })

  it('el listado { usuarios } del backend se interpreta como listado de usuarios', async () => {
    configurarSesionApi({ token: () => 'fixture', renovar: async () => null, invalidar: () => {} })
    const cuenta = { id: 'cuenta-ficticia', email: 'qa@example.test', nombreCompleto: 'Cuenta QA',
      rol: 'terapeuta', activo: true, creadoEn: '2026-10-16T12:00:00Z' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ usuarios: [cuenta] }))
    try {
      expect(await listarUsuarios()).toEqual([cuenta])
    } finally {
      configurarSesionApi(null)
    }
  })

  it.each([400, 409])('el formulario maneja HTTP %s del backend sin anunciar una cuenta creada', async (estado) => {
    const { usuario, fetchEspia } = await montarApp('/usuarios')
    await screen.findByRole('table', { name: /Cuentas del personal/ })
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation((entrada, init) => String(entrada).endsWith('/usuarios') && init?.method === 'POST'
      ? Promise.resolve(Response.json({ message: estado === 409 ? 'Ya existe un usuario con ese correo' : 'Datos inválidos' }, { status: estado }))
      : simulado(entrada, init))
    await usuario.type(screen.getByLabelText('Nombre completo', { selector: 'input' }), 'Cuenta QA')
    await usuario.type(screen.getByLabelText('Correo electrónico', { selector: 'input' }), 'qa@example.test')
    await usuario.click(screen.getByRole('radio', { name: /Terapeuta/ }))
    await usuario.type(screen.getByLabelText('Contraseña inicial', { selector: 'input' }), 'Abcd123456')
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText(estado === 409
      ? 'Ya existe una cuenta con este correo.'
      : 'El servidor rechazó los datos: Datos inválidos')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/usuarios')).toHaveLength(1)
    expect(screen.queryByText(/Cuenta creada para/)).not.toBeInTheDocument()
  })
})

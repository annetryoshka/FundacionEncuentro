import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { atenderSimulado, revocarSesiones, vencerTokensDeAcceso } from '../api/simulado/servidor'
import { llamadas, montarApp } from '../test/montarApp'

/** FE-43 · Navegación y estructura común (y permisos por rol de FE-20). */
describe('Plantilla y navegación', () => {
  const menu = () => within(screen.getByRole('navigation', { name: 'Secciones' }))

  it('dirección ve todas las secciones', async () => {
    await montarApp('/inicio', 'direccion')
    expect(menu().getByRole('link', { name: 'Carpetas' })).toBeInTheDocument()
    expect(menu().getByRole('link', { name: 'Cuentas del personal' })).toBeInTheDocument()
  })

  it('terapeuta no ve la gestión de cuentas', async () => {
    await montarApp('/inicio', 'sofia')
    expect(menu().getByRole('link', { name: 'Carpetas' })).toBeInTheDocument()
    expect(menu().queryByRole('link', { name: 'Cuentas del personal' })).not.toBeInTheDocument()
  })

  it('apoyo/marketing no ve ninguna sección clínica', async () => {
    await montarApp('/inicio', 'apoyo')
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument()
    expect(screen.getByText(/no tiene acceso a la información clínica/)).toBeInTheDocument()
  })

  it('una terapeuta que abre /usuarios a mano ve el aviso de permiso', async () => {
    await montarApp('/usuarios', 'sofia')
    expect(screen.getByRole('heading', { name: /no está disponible para tu cuenta/ })).toBeInTheDocument()
  })

  it('apoyo/marketing que abre /carpetas a mano ve el aviso de permiso', async () => {
    await montarApp('/carpetas', 'apoyo')
    expect(screen.getByRole('heading', { name: /no está disponible para tu cuenta/ })).toBeInTheDocument()
  })

  it('una ruta inexistente muestra una página clara', async () => {
    await montarApp('/no-existe', 'direccion')
    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })

  it('cerrar sesión avisa al backend y vuelve al acceso; solo el simulador garantiza rechazo inmediato del token', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio', 'direccion')
    const refreshToken = sessionStorage.getItem('fundacion-encuentro:refresh')
    const token = new Headers(fetchEspia.mock.calls.at(-1)?.[1]?.headers).get('Authorization')
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/logout')).toHaveLength(1)
    expect(sessionStorage.length).toBe(0)
    const reuso = await atenderSimulado('/api/auth/me', { headers: { Authorization: token ?? '' } })
    expect(reuso.status).toBe(401)
    const renovar = await atenderSimulado('/api/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken }),
    })
    expect(renovar.status).toBe(401)
  })

  it('si el token venció, lo renueva con el refresh token y sigue sin interrumpir', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio', 'direccion')
    vencerTokensDeAcceso()
    await usuario.click(menu().getByRole('link', { name: 'Carpetas' }))

    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/auth/refresh')).toHaveLength(1)
  })

  it('si la sesión ya no se puede renovar, la cierra y explica por qué', async () => {
    const { usuario } = await montarApp('/inicio', 'direccion')
    revocarSesiones()
    await usuario.click(menu().getByRole('link', { name: 'Carpetas' }))

    expect(await screen.findByText('Tu sesión terminó. Vuelve a iniciar sesión.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

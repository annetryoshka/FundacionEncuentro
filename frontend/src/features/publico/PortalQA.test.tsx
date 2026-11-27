import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PUBLICACION_BORRADOR, PUBLICACION_CAMPANA, montarSinSesion } from '../../test/montarApp'

const RUTAS_PRIVADAS = /\/api\/(carpetas|casos|indicadores|difusion|importaciones|investigacion\/|gastos|usuarios)/

describe('FE-150 · navegación pública sin sesión', () => {
  it('con el teclado: primero «Saltar al contenido», que lleva el foco al contenido principal', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { level: 1, name: /Campañas, actividades y cursos/ })
    await usuario.tab()
    const saltar = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(saltar).toHaveFocus()
    expect(saltar).toHaveAttribute('href', '#contenido')
    expect(document.getElementById('contenido')?.tagName).toBe('MAIN')
  })

  it('con el teclado se llega, en orden, al logo, Ingreso del personal e Inicio, Actividades y Contacto', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { level: 1 })
    const orden: string[] = []
    for (let i = 0; i < 6; i++) {
      await usuario.tab()
      orden.push((document.activeElement?.textContent ?? '').trim())
    }
    const posicion = (texto: string) => orden.findIndex((t) => t.includes(texto))
    expect(posicion('Fundación Encuentro')).toBeGreaterThan(-1)
    expect(posicion('Fundación Encuentro')).toBeLessThan(posicion('Ingreso del personal'))
    expect(posicion('Ingreso del personal')).toBeLessThan(orden.indexOf('Inicio'))
    expect(orden.indexOf('Inicio')).toBeLessThan(orden.indexOf('Actividades'))
    expect(orden.indexOf('Actividades')).toBeLessThan(orden.indexOf('Contacto'))
  })

  it('la navegación del portal no ofrece ninguna sección del personal', async () => {
    montarSinSesion('/publicaciones')
    const nav = within(await screen.findByRole('navigation', { name: 'Portal' }))
    expect(nav.getAllByRole('link').map((a) => a.textContent?.trim())).toEqual(['Inicio', 'Actividades', 'Contacto'])
    expect(screen.getByRole('link', { name: /Ingreso del personal/ })).toHaveAttribute('href', '/login')
    for (const privado of [/Carpetas/, /Indicadores/, /Difusión/, /Importaci/, /Gastos/, /Cerrar sesión/]) {
      expect(screen.queryByRole('link', { name: privado })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: privado })).not.toBeInTheDocument()
    }
  })

  it('del listado al detalle y de vuelta, sin llamar a rutas privadas', async () => {
    const { usuario, fetchEspia } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { level: 1 })
    const enlaces = await screen.findAllByRole('link', { name: /.+/ })
    const detalle = enlaces.find((a) => a.getAttribute('href') === `/publicaciones/${PUBLICACION_CAMPANA}`)
    expect(detalle).toBeDefined()
    await usuario.click(detalle!)
    const titulo = await screen.findByRole('heading', { level: 1 })
    expect(titulo.textContent).not.toMatch(/no está disponible/)
    await usuario.click(screen.getByRole('link', { name: /Ver todas las publicaciones/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Campañas, actividades y cursos/ })).toBeInTheDocument()
    expect(fetchEspia.mock.calls.map(([u]) => String(u)).filter((u) => RUTAS_PRIVADAS.test(u))).toEqual([])
  })

  it('el contacto es un enlace telefónico real y la Fundación muestra el teléfono autorizado', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { level: 1 })
    const telefono = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('tel:'))
    expect(telefono?.getAttribute('href')).toMatch(/^tel:\+?\d{7,}$/)
    await usuario.click(within(screen.getByRole('navigation', { name: 'Portal' })).getByRole('link', { name: 'Contacto' }))
    await waitFor(() => expect(screen.getAllByText(/\+591/).length).toBeGreaterThan(0))
  })

  it('un borrador abierto por URL no muestra su contenido ni revela que existe', async () => {
    montarSinSesion(`/publicaciones/${PUBLICACION_BORRADOR}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Esta publicación no está disponible' })).toBeInTheDocument()
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument()
  })

  it('una página fuera de rango no rompe el listado', async () => {
    montarSinSesion('/publicaciones?pagina=999')
    await screen.findByRole('heading', { level: 1, name: /Campañas, actividades y cursos/ })
    await waitFor(() => expect(screen.queryByText(/No se pudieron cargar/)).not.toBeInTheDocument())
  })

  it('«Ingreso del personal» lleva al login y no abre ninguna sesión', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await usuario.click(await screen.findByRole('link', { name: /Ingreso del personal/ }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(sessionStorage.getItem('fundacion-encuentro:refresh')).toBeNull()
  })
})

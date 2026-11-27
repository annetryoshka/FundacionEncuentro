import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { montarApp, montarSinSesion, llamadas } from '../../test/montarApp'
import { ProveedorSesion } from '../auth/ProveedorSesion'

describe('Página de inicio pública', () => {
  it('abre en la raíz sin iniciar sesión, con servicios, contacto y mapa, sin consultar rutas clínicas', async () => {
    const { fetchEspia } = montarSinSesion('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Encuentro\s*con tu\s*Bienestar/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Terapia familiar sistémica' })).toBeInTheDocument()

    const contacto = within(screen.getByRole('region', { name: 'Contacto y ubicación' }))
    expect(contacto.getByRole('link', { name: '+591 77263336' })).toHaveAttribute('href', 'tel:+59177263336')
    expect(contacto.getAllByText(/Calle 11 de Obrajes/).length).toBeGreaterThan(0)
    expect(contacto.getByTitle(/Mapa: ubicación de la Fundación Encuentro/)).toHaveAttribute(
      'src',
      expect.stringMatching(/^https:\/\/www\.google\.com\/maps\?q=-16\.52\d+,-68\.10\d+.*output=embed$/),
    )
    const whatsapp = screen.getByRole('link', { name: /Escríbenos por WhatsApp/ })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/59177263336\?text=/)
    expect(whatsapp).toHaveAttribute('rel', 'noreferrer')

    expect(screen.queryByRole('link', { name: 'Carpetas' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/carpetas')).toHaveLength(0)
  })

  it('muestra las últimas publicaciones y lleva al listado completo', async () => {
    const { usuario } = montarSinSesion('/')
    const actividades = within(screen.getByRole('region', { name: 'Campañas, actividades y cursos' }))
    expect((await actividades.findAllByRole('article')).length).toBeLessThanOrEqual(3)
    await usuario.click(actividades.getByRole('link', { name: /Ver todas/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Campañas, actividades y cursos' })).toBeInTheDocument()
  })

  it('la ruta anterior /fundacion lleva a la raíz y el portal conserva el acceso del personal', async () => {
    const { usuario } = montarSinSesion('/fundacion')
    expect(await screen.findByRole('heading', { level: 1, name: /Bienestar/ })).toBeInTheDocument()
    const portal = () => within(screen.getByRole('navigation', { name: 'Portal' }))
    await usuario.click(portal().getByRole('link', { name: 'Actividades' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Campañas, actividades y cursos' })).toBeInTheDocument()
    await usuario.click(portal().getByRole('link', { name: 'Inicio' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Bienestar/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ingreso del personal' })).toHaveAttribute('href', '/login')
  })

  it('con sesión iniciada, la raíz sigue llevando al panel', async () => {
    await montarApp('/inicio')
    cleanup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: /Bienestar/ })).not.toBeInTheDocument()
  })
})

import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montarSinSesion, llamadas } from '../../test/montarApp'

describe('FE-146 · presentación institucional', () => {
  it('abre sin iniciar sesión, muestra el contenido autorizado y no consulta rutas clínicas', async () => {
    const { fetchEspia } = montarSinSesion('/fundacion')
    expect(await screen.findByRole('heading', { level: 1, name: 'Fundación Encuentro' })).toBeInTheDocument()
    expect(screen.getByText(/Centro de atención terapéutica en La Paz/)).toBeInTheDocument()
    const contacto = within(screen.getByRole('region', { name: 'Contacto' }))
    expect(contacto.getByRole('link', { name: 'Llamar al +591 77263336' })).toHaveAttribute('href', 'tel:+59177263336')
    expect(contacto.getByText(/Calle 11 de Obrajes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conocer campañas, actividades y cursos' })).toHaveAttribute(
      'href',
      '/publicaciones',
    )
    expect(screen.queryByRole('link', { name: 'Carpetas' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/carpetas')).toHaveLength(0)
  })

  it('permite ir desde publicaciones a la Fundación y conserva el acceso separado del personal', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await usuario.click(screen.getByRole('link', { name: /^Fundación$/ }))
    expect(await screen.findByRole('heading', { name: 'Atención psicológica' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ingreso del personal' })).toHaveAttribute('href', '/login')
  })
})

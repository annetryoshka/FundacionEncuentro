import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ListadoInvestigaciones } from './ListadoInvestigaciones'
import { TarjetaInvestigacion } from './TarjetaInvestigacion'
import type { InvestigacionPublica } from './investigaciones'

// Datos ficticios: no son investigaciones reales de la Fundación.
const articulo: InvestigacionPublica = {
  id: 'i-1',
  titulo: 'Artículo ficticio QA',
  resumen: 'Resumen de prueba sin datos de pacientes.',
  autor: 'Autor ficticio',
  imagen: null,
  fechaPublicacion: '2026-12-02',
}

function conRutas(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('TarjetaInvestigacion', () => {
  it('muestra la etiqueta, el título enlazado, el resumen, el autor y la fecha', () => {
    conRutas(<TarjetaInvestigacion investigacion={articulo} aDetalle="/investigaciones/i-1" />)
    expect(screen.getByText('Investigación')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Artículo ficticio QA' })).toHaveAttribute('href', '/investigaciones/i-1')
    expect(screen.getByText('Resumen de prueba sin datos de pacientes.')).toBeInTheDocument()
    expect(screen.getByText('Por Autor ficticio · Publicado el 2 de diciembre de 2026')).toBeInTheDocument()
  })

  it('omite el autor si no se autorizó mostrarlo, y la línea completa si tampoco hay fecha', () => {
    const { unmount } = conRutas(<TarjetaInvestigacion investigacion={{ ...articulo, autor: null }} aDetalle="/i/1" />)
    expect(screen.getByText('Publicado el 2 de diciembre de 2026')).toBeInTheDocument()
    expect(screen.queryByText(/Por /)).not.toBeInTheDocument()
    unmount()

    conRutas(
      <TarjetaInvestigacion investigacion={{ ...articulo, autor: null, fechaPublicacion: null }} aDetalle="/i/1" />,
    )
    expect(screen.queryByText(/Publicado el/)).not.toBeInTheDocument()
  })

  it('si la imagen falla conserva el texto y avisa', () => {
    conRutas(
      <TarjetaInvestigacion
        investigacion={{
          ...articulo,
          imagen: { url: 'https://ejemplo.invalid/rota.jpg', textoAlternativo: 'Portada' },
        }}
        aDetalle="/i/1"
      />,
    )
    fireEvent.error(screen.getByRole('img', { name: 'Portada' }))
    expect(screen.getByText('La imagen no está disponible por ahora.')).toBeInTheDocument()
    expect(screen.getByText('Resumen de prueba sin datos de pacientes.')).toBeInTheDocument()
  })

  it('no ofrece comentarios: el foro no está ratificado', () => {
    conRutas(<TarjetaInvestigacion investigacion={articulo} aDetalle="/i/1" />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('muestra el texto tal cual, sin interpretar HTML', () => {
    const { container } = conRutas(
      <TarjetaInvestigacion investigacion={{ ...articulo, resumen: '<script>alert(1)</script>' }} aDetalle="/i/1" />,
    )
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('ListadoInvestigaciones', () => {
  it('conserva el orden de la API', () => {
    conRutas(
      <ListadoInvestigaciones
        investigaciones={[{ ...articulo, id: 'i-2', titulo: 'Segundo' }, articulo]}
        rutaDetalle={(id) => `/investigaciones/${id}`}
      />,
    )
    const titulos = within(screen.getByRole('list'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titulos).toEqual(['Segundo', 'Artículo ficticio QA'])
  })

  it('sin artículos muestra un vacío, no un error', () => {
    conRutas(<ListadoInvestigaciones investigaciones={[]} rutaDetalle={(id) => `/i/${id}`} />)
    expect(screen.getByRole('status')).toHaveTextContent('Por ahora no hay investigaciones publicadas.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

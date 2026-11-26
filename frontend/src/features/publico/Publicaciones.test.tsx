import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { CategoriasPublicaciones, ListadoPublicaciones } from './ListadoPublicaciones'
import { TarjetaPublicacion } from './TarjetaPublicacion'
import { esUrlHttp, formatearFecha, textoFechas, type PublicacionPublica } from './publicaciones'

// Datos ficticios, como el ejemplo del contrato FE-140: no hay contenido institucional real.
const actividad: PublicacionPublica = {
  id: 'p-1',
  tipo: 'actividad',
  titulo: 'Actividad ficticia QA',
  resumen: 'Texto de prueba para revisar el portal.',
  imagen: null,
  fechaInicio: '2026-12-01',
  fechaFin: '2026-12-01',
  modalidad: 'presencial',
  lugar: 'Lugar ficticio de QA',
  contactoUrl: null,
}

const curso: PublicacionPublica = {
  ...actividad,
  id: 'p-2',
  tipo: 'curso',
  titulo: 'Curso ficticio QA',
  fechaInicio: '2026-12-05',
  fechaFin: '2026-12-19',
  modalidad: 'virtual',
  lugar: null,
}

function conRutas(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('fechas de publicaciones', () => {
  it('formatea sin correr el día por la zona horaria', () => {
    expect(formatearFecha('2026-12-01')).toBe('1 de diciembre de 2026')
    expect(formatearFecha('2026-01-31')).toBe('31 de enero de 2026')
  })

  it('no inventa una fecha ante un dato imposible o mal formado', () => {
    expect(formatearFecha('2026-02-30')).toBe('')
    expect(formatearFecha('01/12/2026')).toBe('')
    expect(formatearFecha(null)).toBe('')
  })

  it('muestra una fecha, un rango o nada', () => {
    expect(textoFechas('2026-12-01', '2026-12-01')).toBe('1 de diciembre de 2026')
    expect(textoFechas('2026-12-05', '2026-12-19')).toBe('5 de diciembre de 2026 al 19 de diciembre de 2026')
    expect(textoFechas('2026-12-05', null)).toBe('5 de diciembre de 2026')
    expect(textoFechas(null, null)).toBeNull()
  })

  it('solo considera enlace seguro un canal http o https', () => {
    expect(esUrlHttp('https://ejemplo.invalid/contacto')).toBe(true)
    expect(esUrlHttp('http://ejemplo.invalid')).toBe(true)
    expect(esUrlHttp('javascript:alert(1)')).toBe(false)
    expect(esUrlHttp('no es una url')).toBe(false)
    expect(esUrlHttp(null)).toBe(false)
  })
})

describe('TarjetaPublicacion', () => {
  it('muestra tipo, título enlazado al detalle, resumen, fecha y lugar', () => {
    conRutas(<TarjetaPublicacion publicacion={actividad} aDetalle="/difusion/p-1" />)
    expect(screen.getByText('Actividad')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Actividad ficticia QA' })).toHaveAttribute('href', '/difusion/p-1')
    expect(screen.getByText('Texto de prueba para revisar el portal.')).toBeInTheDocument()
    expect(screen.getByText('1 de diciembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Presencial · Lugar ficticio de QA')).toBeInTheDocument()
  })

  it('no muestra fecha ni lugar cuando la publicación no los tiene', () => {
    conRutas(
      <TarjetaPublicacion
        publicacion={{ ...actividad, fechaInicio: null, fechaFin: null, modalidad: null, lugar: null }}
        aDetalle="/difusion/p-1"
      />,
    )
    expect(screen.queryByText(/de 2026/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Modalidad y lugar/)).not.toBeInTheDocument()
  })

  it('usa el texto alternativo de la imagen', () => {
    conRutas(
      <TarjetaPublicacion
        publicacion={{
          ...actividad,
          imagen: { url: 'https://ejemplo.invalid/a.jpg', textoAlternativo: 'Sala de talleres' },
        }}
        aDetalle="/difusion/p-1"
      />,
    )
    expect(screen.getByRole('img', { name: 'Sala de talleres' })).toHaveAttribute(
      'src',
      'https://ejemplo.invalid/a.jpg',
    )
  })

  it('si la imagen falla conserva el texto y avisa con claridad', () => {
    conRutas(
      <TarjetaPublicacion
        publicacion={{ ...actividad, imagen: { url: 'https://ejemplo.invalid/rota.jpg', textoAlternativo: 'Sala' } }}
        aDetalle="/difusion/p-1"
      />,
    )
    fireEvent.error(screen.getByRole('img', { name: 'Sala' }))
    expect(screen.getByText('La imagen no está disponible por ahora.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Actividad ficticia QA' })).toBeInTheDocument()
    expect(screen.getByText('Texto de prueba para revisar el portal.')).toBeInTheDocument()
  })

  it('enlaza el contacto solo si es un canal http/https verificado', () => {
    const { unmount } = conRutas(
      <TarjetaPublicacion
        publicacion={{ ...actividad, contactoUrl: 'https://ejemplo.invalid/contacto' }}
        aDetalle="/d"
      />,
    )
    const enlace = screen.getByRole('link', { name: /Contactar/ })
    expect(enlace).toHaveAttribute('href', 'https://ejemplo.invalid/contacto')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
    unmount()

    conRutas(<TarjetaPublicacion publicacion={{ ...actividad, contactoUrl: 'javascript:alert(1)' }} aDetalle="/d" />)
    expect(screen.queryByRole('link', { name: /Contactar/ })).not.toBeInTheDocument()
  })

  it('muestra el texto tal cual: no interpreta HTML', () => {
    const { container } = conRutas(
      <TarjetaPublicacion
        publicacion={{ ...actividad, titulo: '<b>negrita</b>', resumen: '<img src=x onerror=alert(1)>' }}
        aDetalle="/d"
      />,
    )
    expect(screen.getByText('<b>negrita</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('ListadoPublicaciones', () => {
  it('conserva el orden que entrega la API', () => {
    conRutas(<ListadoPublicaciones publicaciones={[curso, actividad]} rutaDetalle={(id) => `/difusion/${id}`} />)
    const titulos = within(screen.getByRole('list'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titulos).toEqual(['Curso ficticio QA', 'Actividad ficticia QA'])
  })

  it('sin publicaciones muestra un vacío, no un error', () => {
    conRutas(<ListadoPublicaciones publicaciones={[]} rutaDetalle={(id) => `/d/${id}`} />)
    expect(screen.getByRole('status')).toHaveTextContent('Por ahora no hay publicaciones.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('el vacío nombra el tipo filtrado', () => {
    conRutas(<ListadoPublicaciones publicaciones={[]} tipo="campana" rutaDetalle={(id) => `/d/${id}`} />)
    expect(screen.getByRole('status')).toHaveTextContent('Por ahora no hay campañas publicadas.')
  })
})

describe('CategoriasPublicaciones', () => {
  it('marca la categoría activa y avisa al elegir otra', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<CategoriasPublicaciones valor="" alCambiar={alCambiar} />)
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Cursos' })).toHaveAttribute('aria-pressed', 'false')
    await usuario.click(screen.getByRole('button', { name: 'Cursos' }))
    expect(alCambiar).toHaveBeenCalledWith('curso')
    await usuario.click(screen.getByRole('button', { name: 'Campañas' }))
    expect(alCambiar).toHaveBeenLastCalledWith('campana')
  })
})

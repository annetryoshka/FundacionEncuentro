import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_VACIA_DE_SOFIA, fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'

/** FE-82 · Vista consolidada de la carpeta (secciones y permisos de FE-81, API FE-83). */
describe('Historial clínico', () => {
  const titulos = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
  const seccion = (titulo: string) =>
    within(screen.getByRole('heading', { level: 2, name: new RegExp(titulo) }).closest('section')!)

  it('administración ve las cinco secciones en orden, con las tareas dentro de su sesión', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/historial`)
    await screen.findByRole('heading', { name: /Identificación/ })
    expect(titulos()).toEqual([
      '1. Identificación',
      '2. Contexto y constancia',
      '3. Diagnóstico',
      '4. Sesiones y tareas',
      '5. Pagos',
    ])
    const sesiones = seccion('Sesiones y tareas')
    const s1 = sesiones.getByRole('link', { name: 'Sesión 1 · 12 de octubre de 2026' }).closest('li')!
    expect(within(s1).getByText(/Registrar tres situaciones/)).toBeInTheDocument()
    expect(within(s1).queryByText(/Conversar en familia/)).not.toBeInTheDocument()
    expect(await seccion('Pagos').findByText('Bs 75,50')).toBeInTheDocument()
    expect(seccion('Contexto y constancia').getByText('EVIDENCIA-DEMO')).toBeInTheDocument()
  })

  it('la terapeuta asignada ve lo clínico pero no los pagos', async () => {
    const { fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/historial`, 'sofia')
    await screen.findByRole('heading', { name: /Identificación/ })
    expect(titulos()).not.toContain('5. Pagos')
    expect(screen.queryByText(/Bs /)).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/pagos`)).toHaveLength(0)
  })

  it('las secciones sin datos muestran «Sin registro»', async () => {
    await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/historial`)
    await screen.findByRole('heading', { name: /Identificación/ })
    for (const titulo of ['Contexto y constancia', 'Diagnóstico', 'Sesiones y tareas']) {
      expect(seccion(titulo).getByText('Sin registro')).toBeInTheDocument()
    }
    expect(await seccion('Pagos').findByText('Sin registro')).toBeInTheDocument()
  })

  it('si fallan los pagos, el resto del historial se sigue viendo y se puede reintentar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    fallarUnaVez(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/pagos`, 500)
    await usuario.click(await screen.findByRole('link', { name: /^Historial/ }))
    await screen.findByRole('heading', { name: '5. Pagos' })
    expect(await seccion('Pagos').findByRole('alert')).toHaveTextContent('No se pudieron cargar los pagos.')
    expect(seccion('Diagnóstico').getByText(/Dificultades de comunicación/)).toBeInTheDocument()
    await usuario.click(seccion('Pagos').getByRole('button', { name: 'Reintentar' }))
    expect(await seccion('Pagos').findByText('Bs 75,50')).toBeInTheDocument()
  })

  it('otra terapeuta no obtiene datos del caso', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/historial`, 'carla')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
    expect(screen.queryByText('Mariana Gutiérrez Paz')).not.toBeInTheDocument()
  })
})

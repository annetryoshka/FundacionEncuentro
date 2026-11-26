import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'

/** FE-92 · Tarjetas de indicadores y selector de período (cálculo FE-91, API FE-93). */
describe('Indicadores', () => {
  const cifra = (titulo: string) => within(screen.getByRole('heading', { name: titulo }).closest('section')!)
  const ultimaConsulta = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia']) =>
    new URL(String(llamadas(fetchEspia, 'GET', '/api/indicadores').at(-1)![0]), 'http://x').searchParams

  it('muestra casos actuales, casos por estado, sesiones y pagos del período', async () => {
    await montarApp('/indicadores?desde=2026-10-12&hasta=2026-10-19')
    await screen.findByRole('heading', { name: 'Casos actuales' })
    expect(cifra('Casos actuales').getByText('14')).toBeInTheDocument()
    const estados = cifra('Casos por estado')
    expect(estados.getByText('Iniciado').nextSibling).toHaveTextContent('6')
    expect(estados.getByText('En proceso').nextSibling).toHaveTextContent('6')
    expect(estados.getByText('En conclusión').nextSibling).toHaveTextContent('2')
    expect(cifra('Sesiones del período').getByText('2')).toBeInTheDocument()
    expect(cifra('Pagos recibidos').getByText('Bs 75,50')).toBeInTheDocument()
  })

  it('un período sin actividad da cero sesiones y Bs 0,00, sin cambiar los casos', async () => {
    const { usuario, fetchEspia } = await montarApp('/indicadores?desde=2026-10-12&hasta=2026-10-19')
    await screen.findByRole('heading', { name: 'Casos actuales' })
    await usuario.clear(screen.getByLabelText('Desde'))
    await usuario.type(screen.getByLabelText('Desde'), '2026-10-01')
    await usuario.clear(screen.getByLabelText('Hasta'))
    await usuario.type(screen.getByLabelText('Hasta'), '2026-10-05')
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }))

    await waitFor(() => expect(cifra('Pagos recibidos').getByText('Bs 0,00')).toBeInTheDocument())
    expect(cifra('Sesiones del período').getByText('0')).toBeInTheDocument()
    expect(cifra('Casos actuales').getByText('14')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).get('desde')).toBe('2026-10-01')
    expect(ultimaConsulta(fetchEspia).get('hasta')).toBe('2026-10-05')
  })

  it('no consulta un período con la fecha desde posterior a hasta', async () => {
    const { usuario, fetchEspia } = await montarApp('/indicadores?desde=2026-10-12&hasta=2026-10-19')
    await screen.findByRole('heading', { name: 'Casos actuales' })
    const antes = llamadas(fetchEspia, 'GET', '/api/indicadores').length
    await usuario.clear(screen.getByLabelText('Desde'))
    await usuario.type(screen.getByLabelText('Desde'), '2026-10-25')
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(await screen.findByText('Debe ser igual o posterior a la fecha desde.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/indicadores')).toHaveLength(antes)
  })

  it('sin período en la URL usa el mes en curso hasta hoy', async () => {
    const { fetchEspia } = await montarApp('/indicadores')
    await screen.findByRole('heading', { name: 'Casos actuales' })
    const hoy = new Date()
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    expect(ultimaConsulta(fetchEspia).get('desde')).toBe(`${mes}-01`)
    expect(ultimaConsulta(fetchEspia).get('hasta')?.startsWith(mes)).toBe(true)
  })

  it('un error se muestra como error, con opción de reintentar', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio')
    fallarUnaVez(fetchEspia, 'GET', '/api/indicadores', 500)
    await usuario.click(screen.getAllByRole('link', { name: /Indicadores/ })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron calcular los indicadores.')
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Casos actuales' })).toBeInTheDocument()
  })

  // FE-138 · Desglose por ciudad de residencia (FE-134/FE-136).
  const filaResidencia = (nombre: string) =>
    within(screen.getByRole('table')).getByRole('rowheader', { name: nombre }).closest('tr')!

  it('desglosa casos, sesiones y pagos por ciudad de residencia con el mismo período', async () => {
    const { fetchEspia } = await montarApp('/indicadores?desde=2026-10-12&hasta=2026-10-19')
    expect(await screen.findByRole('heading', { name: 'Por ciudad de residencia' })).toBeInTheDocument()
    await screen.findByRole('table')
    const celdas = (nombre: string) => [...filaResidencia(nombre).querySelectorAll('td')].map((td) => td.textContent)
    // Casos actuales, Iniciado, En proceso, En conclusión, Sesiones, Pagos
    expect(celdas('La Paz')).toEqual(['5', '1', '3', '1', '2', 'Bs 75,50'])
    expect(celdas('El Alto')).toEqual(['4', '2', '2', '0', '0', 'Bs 0,00'])
    expect(celdas('Otra localidad')).toEqual(['2', '2', '0', '0', '0', 'Bs 0,00'])
    expect(celdas('Sin registrar')).toEqual(['3', '1', '1', '1', '0', 'Bs 0,00'])
    const consulta = new URL(
      String(llamadas(fetchEspia, 'GET', '/api/indicadores/por-residencia').at(-1)![0]),
      'http://x',
    )
    expect(consulta.searchParams.get('desde')).toBe('2026-10-12')
    expect(consulta.searchParams.get('hasta')).toBe('2026-10-19')
  })

  it('si falla el desglose por residencia se muestra el error y el resto sigue visible', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio')
    fallarUnaVez(fetchEspia, 'GET', '/api/indicadores/por-residencia', 500)
    await usuario.click(screen.getAllByRole('link', { name: /Indicadores/ })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo calcular el desglose por residencia.')
    expect(screen.getByRole('heading', { name: 'Casos actuales' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('una terapeuta no tiene el menú ni puede abrir los indicadores', async () => {
    const { fetchEspia } = await montarApp('/indicadores', 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Indicadores' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/indicadores')).toHaveLength(0)
    expect(llamadas(fetchEspia, 'GET', '/api/indicadores/por-residencia')).toHaveLength(0)
  })
})

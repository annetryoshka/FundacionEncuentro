import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { atenderSimulado, CONTRASENA_DEMO } from '../../api/simulado/servidor'
import { llamadas, montarApp } from '../../test/montarApp'

/**
 * FE-47 · Filtros del listado de carpetas (historia FE-14, reglas de FE-59).
 * Datos simulados: 5 social, 5 privado y 4 sin clasificar.
 */
describe('Filtros del listado de carpetas', () => {
  const resultados = async () => within((await screen.findAllByRole('list')).at(-1)!)
  const ultimaConsulta = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia']) =>
    new URL(String(llamadas(fetchEspia, 'GET', '/api/carpetas').at(-1)![0]), 'http://x').searchParams

  it('cada carpeta muestra su clasificación, también cuando no la tiene', async () => {
    await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    const lista = await resultados()
    const mateo = lista.getByRole('link', { name: /Mateo Chávez Ticona/ })
    expect(within(mateo).getByText('Sin clasificar')).toBeInTheDocument()
    const camila = lista.getByRole('link', { name: /Camila Vargas Aliaga/ })
    expect(within(camila).getByText('Privado')).toBeInTheDocument()
  })

  it('filtra por clasificación al elegirla y envía solo los filtros elegidos', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    expect(ultimaConsulta(fetchEspia).has('clasificacion')).toBe(false)
    expect(ultimaConsulta(fetchEspia).has('estado')).toBe(false)

    await usuario.selectOptions(screen.getByLabelText('Clasificación'), 'social')
    expect(await screen.findByText('5 carpetas · Filtro: Social')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).get('clasificacion')).toBe('social')
    expect(ultimaConsulta(fetchEspia).has('estado')).toBe(false)
  })

  it('combina clasificación, estado y búsqueda', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await usuario.selectOptions(screen.getByLabelText('Clasificación'), 'social')
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'en_proceso')
    expect(await screen.findByText('3 carpetas · Filtro: Social · En proceso')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Buscar por nombre o número de carpeta'), 'familia')
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('2 resultados para «familia» · Filtro: Social · En proceso')).toBeInTheDocument()
    const lista = await resultados()
    expect(lista.getByText('Familia Condori Apaza')).toBeInTheDocument()
    expect(lista.getByText('Familia Nina Calle')).toBeInTheDocument()

    const consulta = ultimaConsulta(fetchEspia)
    expect(consulta.get('busqueda')).toBe('familia')
    expect(consulta.get('clasificacion')).toBe('social')
    expect(consulta.get('estado')).toBe('en_proceso')
  })

  it('el texto escrito y no buscado se aplica junto con el filtro elegido', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await usuario.type(screen.getByLabelText('Buscar por nombre o número de carpeta'), 'gutierrez')
    await usuario.selectOptions(screen.getByLabelText('Clasificación'), 'privado')
    expect(await screen.findByText('1 resultado para «gutierrez» · Filtro: Privado')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).get('busqueda')).toBe('gutierrez')
  })

  it('cambiar un filtro vuelve a la página 1', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas')
    await screen.findByText('Página 1 de 2')
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('Página 2 de 2')

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'iniciado')
    expect(await screen.findByText('6 carpetas · Filtro: Iniciado')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).get('pagina')).toBe('1')
  })

  it('los filtros se conservan al paginar y al abrir el enlace', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas?estado=iniciado&pagina=1')
    expect(await screen.findByText('6 carpetas · Filtro: Iniciado')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado')).toHaveValue('iniciado')
    expect(screen.getByLabelText('Clasificación')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Estado'), '')
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('Página 2 de 2')
    await usuario.selectOptions(screen.getByLabelText('Clasificación'), 'privado')
    await screen.findByText('5 carpetas · Filtro: Privado')
    expect(ultimaConsulta(fetchEspia).get('pagina')).toBe('1')
  })

  it('un valor desconocido en la URL se ignora en vez de romper el listado', async () => {
    const { fetchEspia } = await montarApp('/carpetas?clasificacion=vip&estado=cerrado')
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).has('clasificacion')).toBe(false)
    expect(ultimaConsulta(fetchEspia).has('estado')).toBe(false)
  })

  it('sin coincidencias explica qué filtro se aplicó y permite quitar solo los filtros', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas?q=gutierrez&clasificacion=social')
    expect(await screen.findByText('No encontramos carpetas para «gutierrez» con el filtro Social')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(await screen.findByText('2 resultados para «gutierrez»')).toBeInTheDocument()
    expect(ultimaConsulta(fetchEspia).get('busqueda')).toBe('gutierrez')
    expect(ultimaConsulta(fetchEspia).has('clasificacion')).toBe(false)
  })

  it('Limpiar quita la búsqueda y los filtros', async () => {
    const { usuario } = await montarApp('/carpetas?q=familia&clasificacion=social&estado=iniciado')
    expect(await screen.findByText('1 resultado para «familia» · Filtro: Social · Iniciado')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nombre o número de carpeta')).toHaveValue('')
    expect(screen.getByLabelText('Clasificación')).toHaveValue('')
    expect(screen.getByLabelText('Estado')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
  })

  it('una terapeuta filtra solo dentro de sus carpetas asignadas', async () => {
    const { usuario } = await montarApp('/carpetas', 'carla')
    await screen.findByText('5 carpetas')
    await usuario.selectOptions(screen.getByLabelText('Clasificación'), 'social')
    expect(await screen.findByText('2 carpetas · Filtro: Social')).toBeInTheDocument()
    const lista = await resultados()
    expect(lista.getByText('Andrés Mamani Quispe')).toBeInTheDocument()
    expect(lista.queryByText('Familia Condori Apaza')).not.toBeInTheDocument() // social, pero de Sofía
  })

  it('la API simulada rechaza un filtro inválido como el backend (400)', async () => {
    const login = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'direccion@fundacion.test', password: CONTRASENA_DEMO }),
    })
    const { accessToken } = (await login.json()) as { accessToken: string }
    const respuesta = await atenderSimulado('/api/carpetas?clasificacion=vip', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(respuesta.status).toBe(400)
  })
})

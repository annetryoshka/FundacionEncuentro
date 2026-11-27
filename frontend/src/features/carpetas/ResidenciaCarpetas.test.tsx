import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, llamadas, montarApp } from '../../test/montarApp'

/**
 * FE-138 · Residencia del paciente integrada en alta, edición, listado y resumen (FE-134, API FE-136).
 * Datos simulados: 5 La Paz, 4 El Alto, 2 otra localidad (Viacha, Achocalla) y 3 sin registrar.
 */
describe('Residencia en las carpetas', () => {
  const resultados = async () => within((await screen.findAllByRole('list')).at(-1)!)
  const consultas = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia']) =>
    llamadas(fetchEspia, 'GET', '/api/carpetas').map(([url]) => new URL(String(url), 'http://x').searchParams)
  const cuerpo = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia'], metodo: string, ruta: string) =>
    JSON.parse(String((llamadas(fetchEspia, metodo, ruta).at(-1)![1] as RequestInit).body))

  it('cada fila muestra la residencia; los casos antiguos sin dato dicen «Sin registrar»', async () => {
    await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    const lista = await resultados()
    expect(within(lista.getByRole('link', { name: /Valeria Ríos Céspedes/ })).getByText('La Paz')).toBeInTheDocument()
    expect(
      within(lista.getByRole('link', { name: /Familia Nina Calle/ })).getByText('Sin registrar'),
    ).toBeInTheDocument()
    expect(
      within(lista.getByRole('link', { name: /Familia Huanca Limachi/ })).getByText('Otra localidad: Viacha'),
    ).toBeInTheDocument()
  })

  it('filtra por residencia, lo guarda en la URL y vuelve a la página 1', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas?pagina=2')
    await screen.findByText('14 carpetas')
    expect(consultas(fetchEspia).at(-1)!.has('residencia')).toBe(false)

    await usuario.selectOptions(screen.getByLabelText('Residencia'), 'el_alto')
    expect(await screen.findByText('4 carpetas · Filtro: Residencia: El Alto')).toBeInTheDocument()
    expect(consultas(fetchEspia).at(-1)!.get('residencia')).toBe('el_alto')
    expect(consultas(fetchEspia).at(-1)!.get('pagina')).toBe('1')

    // «Sin registrar» es un valor de consulta, no una ciudad guardada.
    await usuario.selectOptions(screen.getByLabelText('Residencia'), 'sin_registrar')
    expect(await screen.findByText('3 carpetas · Filtro: Residencia: Sin registrar')).toBeInTheDocument()
    expect(consultas(fetchEspia).at(-1)!.get('residencia')).toBe('sin_registrar')

    // «Todas» quita el parámetro e incluye a los que no tienen el dato.
    await usuario.selectOptions(screen.getByLabelText('Residencia'), '')
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect(consultas(fetchEspia).at(-1)!.has('residencia')).toBe(false)
  })

  it('la residencia se combina con los demás filtros, y un valor desconocido en la URL se ignora', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas?residencia=marte')
    await screen.findByText('14 carpetas')
    expect(consultas(fetchEspia).at(-1)!.has('residencia')).toBe(false)

    await usuario.selectOptions(screen.getByLabelText('Residencia'), 'la_paz')
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'en_proceso')
    expect(await screen.findByText('3 carpetas · Filtro: En proceso · Residencia: La Paz')).toBeInTheDocument()
    const ultima = consultas(fetchEspia).at(-1)!
    expect(ultima.get('residencia')).toBe('la_paz')
    expect(ultima.get('estado')).toBe('en_proceso')
  })

  it('una terapeuta filtra solo dentro de sus carpetas', async () => {
    const { usuario } = await montarApp('/carpetas', 'sofia')
    await screen.findByText('5 carpetas')
    await usuario.selectOptions(screen.getByLabelText('Residencia'), 'el_alto')
    expect(await screen.findByText('2 carpetas · Filtro: Residencia: El Alto')).toBeInTheDocument()
  })

  it('el alta exige el nombre de la localidad con «Otra localidad» y la guarda en el paciente', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    await usuario.type(screen.getByLabelText('Nombre completo del paciente'), 'Rosa Apaza Limachi')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.selectOptions(screen.getByLabelText('Ciudad de residencia'), 'otra')
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(screen.getByText('Escribe el nombre de la localidad.')).toBeInTheDocument()
    expect(screen.getByLabelText('Localidad')).toHaveFocus()
    expect(llamadas(fetchEspia, 'POST', '/api/casos')).toHaveLength(0)

    await usuario.type(screen.getByLabelText('Localidad'), ' Viacha ')
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))
    expect(await screen.findByRole('heading', { name: 'Rosa Apaza Limachi', level: 1 })).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', '/api/casos').paciente).toEqual({
      nombreCompleto: 'Rosa Apaza Limachi',
      ciudadResidencia: 'otra',
      otraLocalidad: 'Viacha',
    })
    expect(screen.getAllByText('Otra localidad: Viacha').length).toBeGreaterThan(0)
  })

  it('sin residencia el alta no la envía y la carpeta queda «Sin registrar»', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    await usuario.type(screen.getByLabelText('Nombre completo del paciente'), 'Pedro Ticona Mamani')
    await usuario.click(screen.getByRole('radio', { name: /Derivado/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))
    expect(await screen.findByRole('heading', { name: 'Pedro Ticona Mamani', level: 1 })).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', '/api/casos').paciente).toEqual({ nombreCompleto: 'Pedro Ticona Mamani' })
    expect(screen.getAllByText('Sin registrar').length).toBeGreaterThan(0)
  })

  it('cambiar la residencia conserva número, fecha y terapeuta, y envía nombre y fecha juntos', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    await screen.findByRole('heading', { name: 'Mariana Gutiérrez Paz', level: 1 })
    const resumen = () => within(screen.getByRole('heading', { name: 'Resumen' }).closest('section, div')!)
    expect(resumen().getByText('La Paz')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Editar datos' }))
    await usuario.selectOptions(screen.getByLabelText('Ciudad de residencia'), 'el_alto')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Los datos del paciente se actualizaron correctamente.')).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'PATCH', `/api/carpetas/${CARPETA_DE_SOFIA}`)).toEqual({
      nombreCompleto: 'Mariana Gutiérrez Paz',
      fechaIngreso: '2026-03-12',
      ciudadResidencia: 'el_alto',
      otraLocalidad: null,
    })
    expect(resumen().getByText('El Alto')).toBeInTheDocument()
    expect(resumen().getAllByText('Nº 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sofía Mamani/).length).toBeGreaterThan(0)
  })

  it('volver a «Sin registrar» limpia la residencia (envía null)', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    await screen.findByRole('heading', { name: 'Mariana Gutiérrez Paz', level: 1 })
    await usuario.click(screen.getByRole('button', { name: 'Editar datos' }))
    await usuario.selectOptions(screen.getByLabelText('Ciudad de residencia'), '')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Los datos del paciente se actualizaron correctamente.')
    expect(cuerpo(fetchEspia, 'PATCH', `/api/carpetas/${CARPETA_DE_SOFIA}`)).toMatchObject({
      ciudadResidencia: null,
      otraLocalidad: null,
    })
  })
})

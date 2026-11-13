import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_VACIA_DE_SOFIA, fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'

/** FE-67 · Formulario y consulta de la ficha de diagnóstico (reglas FE-66, API FE-68). */
describe('Ficha de diagnóstico', () => {
  const cuerpo = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown

  it('una carpeta sin ficha lo dice y permite crearla; los campos opcionales quedan «Sin registro»', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`, 'sofia')
    expect(await screen.findByText('Sin ficha de diagnóstico')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Crear ficha' }))

    const fecha = screen.getByLabelText('Fecha de evaluación')
    await usuario.clear(fecha)
    await usuario.type(fecha, '2026-11-03')
    await usuario.type(screen.getByLabelText('Diagnóstico de ingreso'), '  Conflicto parental  ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(await screen.findByText('Ficha de diagnóstico guardada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evaluación del 3 de noviembre de 2026' })).toBeInTheDocument()
    expect(screen.getByText('Conflicto parental')).toBeInTheDocument()
    expect(screen.getAllByText('Sin registro')).toHaveLength(2)
    expect(screen.getByText(/Creada por Sofía Mamani \(tú\)/)).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`)[0])).toEqual({
      fecha: '2026-11-03',
      diagnosticoIngreso: 'Conflicto parental',
      hipotesisRelacional: null,
      comentariosClinicos: null,
    })
  })

  it('no guarda un diagnóstico de solo espacios ni una fecha vacía', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Crear ficha' }))
    await usuario.clear(screen.getByLabelText('Fecha de evaluación'))
    await usuario.type(screen.getByLabelText('Diagnóstico de ingreso'), '   ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(await screen.findByText('Indica la fecha de la evaluación.')).toBeInTheDocument()
    expect(screen.getByText('Escribe el diagnóstico de ingreso.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`)).toHaveLength(0)
  })

  it('cancelar una edición conserva la ficha anterior sin enviar nada', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/diagnostico`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar ficha' }))
    const campo = screen.getByLabelText('Diagnóstico de ingreso')
    await usuario.clear(campo)
    await usuario.type(campo, 'Texto que se descarta')
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Dificultades de comunicación en el sistema familiar.')).toBeInTheDocument()
    expect(screen.queryByText('Texto que se descarta')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/diagnostico`)).toHaveLength(0)
  })

  it('editar conserva la autoría de creación y registra la actualización', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/diagnostico`)
    await usuario.click(await screen.findByRole('button', { name: 'Editar ficha' }))
    await usuario.type(screen.getByLabelText('Hipótesis relacional (opcional)'), 'Triangulación con la madre')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(await screen.findByText('Triangulación con la madre')).toBeInTheDocument()
    expect(
      screen.getByText(/Creada por Sofía Mamani .* Última actualización por Laura Quiroga \(tú\)/),
    ).toBeInTheDocument()
  })

  it('un error de carga se distingue de una ficha ausente y se puede reintentar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}`, 'sofia')
    fallarUnaVez(fetchEspia, 'GET', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`, 500)
    await usuario.click(await screen.findByRole('link', { name: /^Diagnóstico/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la ficha de diagnóstico.')
    expect(screen.queryByText('Sin ficha de diagnóstico')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Sin ficha de diagnóstico')).toBeInTheDocument()
  })
})

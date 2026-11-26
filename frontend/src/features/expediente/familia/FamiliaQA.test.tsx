import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_VACIA_DE_SOFIA, llamadas, montarApp } from '../../../test/montarApp'

describe('FE-128 · verificación QA de la interfaz de la composición familiar', () => {
  const rutaApi = (carpeta: string) => `/api/carpetas/${carpeta}/familia`

  it('ficha B: datos desconocidos se muestran como tales y los parentescos se repiten', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Registrar composición familiar' }))

    const filas = [
      { parentesco: 'hijo', nombre: 'Hijo QA' },
      { parentesco: 'tio', nombre: 'Tío uno QA' },
      { parentesco: 'tio', nombre: 'Tío dos QA' },
      { parentesco: 'abuelo_paterno', nombre: '' },
      { parentesco: 'otro', nombre: 'Padrino QA', detalle: 'Padrino' },
    ]
    for (const [i, fila] of filas.entries()) {
      if (i > 0) await usuario.click(screen.getByRole('button', { name: 'Agregar integrante' }))
      await usuario.selectOptions(screen.getAllByLabelText('Parentesco respecto del paciente')[i], fila.parentesco)
      if (fila.nombre) await usuario.type(screen.getAllByLabelText('Nombre completo')[i], fila.nombre)
      if (fila.detalle) await usuario.type(screen.getByLabelText('¿Qué parentesco?'), fila.detalle)
    }
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    expect(await screen.findByRole('heading', { name: '5 integrantes' })).toBeInTheDocument()
    expect(screen.getAllByText('Tío')).toHaveLength(2)
    expect(screen.getByText('Padrino')).toBeInTheDocument()
    const abuelo = screen.getByText('Abuelo paterno').closest('li')!
    expect(within(abuelo).getByText('Nombre no registrado')).toBeInTheDocument()
    expect(within(abuelo).getByText('Edad no registrada')).toBeInTheDocument()
    expect(within(abuelo).getAllByText('Sin dato')).toHaveLength(3)
  }, 30_000)

  it('registrar sin integrantes se distingue de no haber registrado la familia', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`, 'sofia')
    expect(await screen.findByText('Sin composición familiar registrada')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Registrar composición familiar' }))
    await usuario.click(screen.getByRole('button', { name: /Quitar integrante/ }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    expect(await screen.findByRole('heading', { name: 'Registrada sin integrantes' })).toBeInTheDocument()
    expect(screen.queryByText('Sin composición familiar registrada')).not.toBeInTheDocument()
    const enviado = JSON.parse(
      String((llamadas(fetchEspia, 'PUT', rutaApi(CARPETA_VACIA_DE_SOFIA)).at(-1)![1] as RequestInit).body),
    )
    expect(enviado).toMatchObject({ version: null, familiares: [], eliminarIds: [] })
  })

  it('cancelar después de agregar y quitar integrantes no envía nada y deja la lista igual', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    await usuario.click(screen.getByRole('button', { name: 'Agregar integrante' }))
    const parentescos = screen.getAllByLabelText('Parentesco respecto del paciente')
    await usuario.selectOptions(parentescos[parentescos.length - 1], 'tia')
    await usuario.click(screen.getByRole('button', { name: /Quitar integrante\s*1/ }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('heading', { name: '4 integrantes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Padre QA' })).toBeInTheDocument()
    expect(screen.queryByText('Tía')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', rutaApi(CARPETA_DE_SOFIA))).toHaveLength(0)
  })

  it('el orden de la ficha es familia, genograma, diagnóstico y después historial', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/historial`, 'sofia')
    const apartados = within(await screen.findByRole('navigation', { name: 'Apartados de la carpeta' }))
    const nombres = apartados.getAllByRole('link').map((a) => a.textContent ?? '')
    const posicion = (nombre: string) => nombres.findIndex((t) => t.startsWith(nombre))
    const orden = ['Familia', 'Genograma', 'Diagnóstico', 'Historial'].map(posicion)
    expect(orden.every((p) => p > -1)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
  })

  it('administración también puede editar la composición familiar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'direccion')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    await usuario.type(screen.getAllByLabelText('Observaciones')[0], 'Nota de dirección QA.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    expect(await screen.findByText('Composición familiar guardada.')).toBeInTheDocument()
    expect(screen.getByText('Nota de dirección QA.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', rutaApi(CARPETA_DE_SOFIA))).toHaveLength(1)
  })

  it('marketing no ve ni modifica la composición familiar', async () => {
    const { fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'apoyo')
    await waitFor(() => expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument())
    expect(screen.queryByText('Padre QA')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar composición' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', rutaApi(CARPETA_DE_SOFIA))).toHaveLength(0)
  })

  it('al cerrar sesión desde la familia, sus datos desaparecen de la pantalla', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'Padre QA' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('Padre QA')).not.toBeInTheDocument()
  })
})

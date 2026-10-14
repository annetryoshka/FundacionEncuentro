import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_SIN_ASIGNAR, llamadas, montarApp } from '../../test/montarApp'

/** FE-36 · Asignación de terapeuta en la carpeta (criterios de FE-35 que tocan la interfaz). */
describe('AsignacionTerapeuta', () => {
  const selector = () => screen.findByRole('combobox')

  it('una carpeta sin asignar lo indica', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    expect(await screen.findByText('Sin terapeuta asignada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Lucía Fernández Roca' })).toBeInTheDocument()
  })

  it('solo ofrece terapeutas con cuenta activa (filtradas de GET /api/usuarios)', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const opciones = within(await selector())
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(opciones).toEqual(['Elige una terapeuta', 'Carla Rojas', 'Sofía Mamani'])
  })

  it('asigna una terapeuta y muestra a la responsable', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    await usuario.selectOptions(await selector(), 'Carla Rojas')
    await usuario.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(
      await screen.findByText('Carla Rojas es ahora la responsable y ya puede ver esta carpeta.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Asignada el .* por Laura Quiroga/)).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/casos/${CARPETA_SIN_ASIGNAR}/terapeuta`)).toHaveLength(1)
  })

  it('si el backend aún no tiene el endpoint (FE-37), lo avisa sin romper la carpeta', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation((entrada, init) =>
      String(entrada).endsWith('/terapeuta')
        ? Promise.resolve(
            new Response(
              JSON.stringify({ statusCode: 404, message: `Cannot PUT ${String(entrada)}`, error: 'Not Found' }),
              { status: 404 },
            ),
          )
        : simulado(entrada, init),
    )
    await usuario.selectOptions(await selector(), 'Carla Rojas')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar responsable' }))

    expect(await screen.findByText(/todavía no está disponible en el servidor/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mariana Gutiérrez Paz' })).toBeInTheDocument()
  })

  it('una terapeuta no puede abrir una carpeta por URL', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'carla')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
    expect(screen.queryByText('Mariana Gutiérrez Paz')).not.toBeInTheDocument()
  })
})

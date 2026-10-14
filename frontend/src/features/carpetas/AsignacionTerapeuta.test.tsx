import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTRASENA_DEMO, atenderSimulado } from '../../api/simulado/servidor'
import { CARPETA_DE_SOFIA, CARPETA_SIN_ASIGNAR, CUENTAS, llamadas, montarApp } from '../../test/montarApp'

/** FE-36 · Asignación de terapeuta en la carpeta (criterios de FE-35 que tocan la interfaz). */
describe('AsignacionTerapeuta', () => {
  const selector = () => screen.findByRole('combobox')

  async function tokenDe(correo: string) {
    const r = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: correo, password: CONTRASENA_DEMO }),
    })
    return ((await r.json()) as { accessToken: string }).accessToken
  }

  it('una carpeta sin asignar lo indica y sigue disponible para la dirección', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    expect(await screen.findByText('Sin terapeuta asignada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Lucía Fernández Roca' })).toBeInTheDocument()
  })

  it('solo ofrece terapeutas con cuenta activa', async () => {
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
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_SIN_ASIGNAR}/terapeuta`)).toHaveLength(1)
  })

  it('al cambiar de responsable, la anterior pierde el acceso', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    expect(await screen.findByText('Sofía Mamani', { selector: 'span' })).toBeInTheDocument()

    await usuario.selectOptions(await selector(), 'Carla Rojas')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar responsable' }))
    expect(
      await screen.findByText('Carla Rojas es ahora la responsable. Sofía Mamani ya no puede ver esta carpeta.'),
    ).toBeInTheDocument()

    const tokenSofia = await tokenDe(CUENTAS.sofia)
    const consulta = await atenderSimulado(`/api/carpetas/${CARPETA_DE_SOFIA}`, {
      headers: { Authorization: `Bearer ${tokenSofia}` },
    })
    expect(consulta.status).toBe(404)
  })

  it('una terapeuta ve a la responsable pero no puede cambiarla', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'Terapeuta responsable' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('cambiar el id en la URL no abre una carpeta ajena', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'carla')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
    expect(screen.queryByText('Mariana Gutiérrez Paz')).not.toBeInTheDocument()
  })
})

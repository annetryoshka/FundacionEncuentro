import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { atenderSimulado, CONTRASENA_DEMO } from '../../api/simulado/servidor'
import { CARPETA_DE_SOFIA, CARPETA_SIN_ASIGNAR, llamadas, montarApp } from '../../test/montarApp'

/** FE-47 · Clasificación y estado dentro de la carpeta (historia FE-14, reglas de FE-59). */
describe('ClasificacionYEstado', () => {
  const tarjeta = async () =>
    within((await screen.findByRole('heading', { name: 'Clasificación y estado' })).closest('section, div')!)
  const resumen = () => within(screen.getByRole('heading', { name: 'Resumen' }).parentElement!)
  /** El texto completo del dato «titulo» del Resumen (dt + dd). */
  const dato = async (titulo: string) => (await resumen().findByText(titulo)).parentElement!.textContent
  const cuerpoDe = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown

  async function tokenDe(correo: string) {
    const r = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: correo, password: CONTRASENA_DEMO }),
    })
    return ((await r.json()) as { accessToken: string }).accessToken
  }

  it('una carpeta nueva o sin clasificar lo indica y no deja guardar sin elegir', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const control = await tarjeta()
    expect(control.getByText('Esta carpeta todavía no está clasificada.')).toBeInTheDocument()
    expect(control.getByLabelText('Clasificación')).toHaveValue('')
    expect(control.getByRole('button', { name: 'Guardar clasificación' })).toBeDisabled()
    expect(control.getByRole('button', { name: 'Guardar estado' })).toBeDisabled()
    expect(resumen().getByText('Sin clasificar')).toBeInTheDocument()
  })

  it('guarda la clasificación de esa carpeta y muestra quién la actualizó', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const control = await tarjeta()
    await usuario.selectOptions(control.getByLabelText('Clasificación'), 'social')
    await usuario.click(control.getByRole('button', { name: 'Guardar clasificación' }))

    expect(await control.findByText('Clasificación guardada: Social.')).toBeInTheDocument()
    const enviados = llamadas(fetchEspia, 'PATCH', `/api/carpetas/${CARPETA_SIN_ASIGNAR}/clasificacion`)
    expect(enviados).toHaveLength(1)
    expect(cuerpoDe(enviados[0])).toEqual({ clasificacion: 'social' })
    // El estado no se toca: son guardados independientes.
    expect(llamadas(fetchEspia, 'PATCH', `/api/casos/${CARPETA_SIN_ASIGNAR}/estado`)).toHaveLength(0)

    expect(resumen().getByText('Social')).toBeInTheDocument()
    await vi.waitFor(async () => expect(await dato('Última actualización')).toMatch(/Laura Quiroga/))
    expect(control.getByRole('button', { name: 'Guardar clasificación' })).toBeDisabled()
    expect(control.queryByText('Esta carpeta todavía no está clasificada.')).not.toBeInTheDocument()

    // Se conservan número, origen y paciente; recargar muestra lo guardado.
    expect(screen.getByRole('heading', { level: 1, name: 'Lucía Fernández Roca' })).toBeInTheDocument()
    expect(resumen().getByText('Voluntario')).toBeInTheDocument()
  })

  it('guarda el estado sin cambiar la clasificación', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    const control = await tarjeta()
    expect(control.getByLabelText('Clasificación')).toHaveValue('privado')
    expect(control.getByLabelText('Estado del caso')).toHaveValue('en_proceso')

    await usuario.selectOptions(control.getByLabelText('Estado del caso'), 'concluido')
    await usuario.click(control.getByRole('button', { name: 'Guardar estado' }))

    expect(await control.findByText('Estado guardado: En conclusión.')).toBeInTheDocument()
    const enviados = llamadas(fetchEspia, 'PATCH', `/api/casos/${CARPETA_DE_SOFIA}/estado`)
    expect(enviados).toHaveLength(1)
    expect(cuerpoDe(enviados[0])).toEqual({ estado: 'concluido' })
    expect(llamadas(fetchEspia, 'PATCH', `/api/carpetas/${CARPETA_DE_SOFIA}/clasificacion`)).toHaveLength(0)
    expect(control.getByLabelText('Clasificación')).toHaveValue('privado')
    expect(resumen().getByText('En conclusión')).toBeInTheDocument()
  })

  it('el cambio guardado se ve en el listado con el filtro correspondiente', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const control = await tarjeta()
    await usuario.selectOptions(control.getByLabelText('Clasificación'), 'privado')
    await usuario.click(control.getByRole('button', { name: 'Guardar clasificación' }))
    await control.findByText('Clasificación guardada: Privado.')

    await usuario.click(screen.getByRole('link', { name: 'Volver a carpetas' }))
    await usuario.selectOptions(await screen.findByLabelText('Clasificación'), 'privado')
    expect(await screen.findByText('6 carpetas · Filtro: Privado')).toBeInTheDocument()
    expect(screen.getByText('Lucía Fernández Roca')).toBeInTheDocument()
  })

  it('la terapeuta asignada puede clasificar y cambiar el estado de su carpeta', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    const control = await tarjeta()
    await usuario.selectOptions(control.getByLabelText('Clasificación'), 'social')
    await usuario.click(control.getByRole('button', { name: 'Guardar clasificación' }))
    expect(await control.findByText('Clasificación guardada: Social.')).toBeInTheDocument()

    await usuario.selectOptions(control.getByLabelText('Estado del caso'), 'iniciado')
    await usuario.click(control.getByRole('button', { name: 'Guardar estado' }))
    expect(await control.findByText('Estado guardado: Iniciado.')).toBeInTheDocument()
    // Cada control muestra su propio resultado.
    expect(control.getByText('Clasificación guardada: Social.')).toBeInTheDocument()
    await vi.waitFor(async () => expect(await dato('Última actualización')).toMatch(/Sofía Mamani/))
  })

  it('si a la terapeuta le quitan el caso antes de guardar, avisa y no muestra el cambio', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    const control = await tarjeta()

    // La dirección reasigna la carpeta a Carla mientras Sofía la tiene abierta.
    const tokenDireccion = await tokenDe('direccion@fundacion.test')
    await atenderSimulado(`/api/carpetas/${CARPETA_DE_SOFIA}/terapeuta`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenDireccion}` },
      body: JSON.stringify({ perfilId: '00000000-0000-4000-8000-000000000003' }),
    })

    await usuario.selectOptions(control.getByLabelText('Estado del caso'), 'concluido')
    await usuario.click(control.getByRole('button', { name: 'Guardar estado' }))
    expect(
      await control.findByText('No se guardó: esta carpeta ya no está disponible para tu cuenta.'),
    ).toBeInTheDocument()
    expect(resumen().getByText('En proceso')).toBeInTheDocument()
    // Lo elegido se conserva para que la persona sepa qué intentó guardar.
    expect(control.getByLabelText('Estado del caso')).toHaveValue('concluido')
  })

  it('un error de conexión se muestra en ese control y el otro sigue funcionando', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const control = await tarjeta()
    const fetchReal = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation((url, init) =>
      String(url).endsWith('/clasificacion') ? Promise.reject(new TypeError('Failed to fetch')) : fetchReal(url, init),
    )

    await usuario.selectOptions(control.getByLabelText('Clasificación'), 'social')
    await usuario.click(control.getByRole('button', { name: 'Guardar clasificación' }))
    const aviso = await control.findByRole('alert')
    expect(aviso).toHaveTextContent(/^No se guardó\./)
    expect(resumen().getByText('Sin clasificar')).toBeInTheDocument()

    await usuario.selectOptions(control.getByLabelText('Estado del caso'), 'en_proceso')
    await usuario.click(control.getByRole('button', { name: 'Guardar estado' }))
    expect(await control.findByText('Estado guardado: En proceso.')).toBeInTheDocument()
  })

  it('la API simulada aplica los permisos y validaciones del backend', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}`)
    const pedir = async (token: string, ruta: string, cuerpo: unknown) =>
      (
        await atenderSimulado(ruta, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(cuerpo),
        })
      ).status
    const marketing = await tokenDe('apoyo@fundacion.test')
    const sofia = await tokenDe('terapeuta1@fundacion.test')
    const direccion = await tokenDe('direccion@fundacion.test')

    expect(await pedir(marketing, `/api/carpetas/${CARPETA_DE_SOFIA}/clasificacion`, { clasificacion: 'social' })).toBe(
      403,
    )
    expect(await pedir(sofia, `/api/carpetas/${CARPETA_SIN_ASIGNAR}/clasificacion`, { clasificacion: 'social' })).toBe(
      404,
    )
    expect(await pedir(sofia, `/api/casos/${CARPETA_SIN_ASIGNAR}/estado`, { estado: 'concluido' })).toBe(404)
    expect(await pedir(direccion, `/api/carpetas/${CARPETA_DE_SOFIA}/clasificacion`, { clasificacion: 'vip' })).toBe(
      400,
    )
    expect(await pedir(direccion, `/api/casos/${CARPETA_DE_SOFIA}/estado`, { estado: 'cerrado' })).toBe(400)
    expect(await pedir(direccion, `/api/casos/${CARPETA_DE_SOFIA}/estado`, { estado: 'concluido' })).toBe(200)
  })
})

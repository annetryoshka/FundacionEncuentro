import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, SESION_1, SESION_2, fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'

/** FE-77 · Tareas terapéuticas dentro de la sesión (reglas FE-76). */
describe('Tareas de la sesión', () => {
  const RUTA_TAREAS = `/api/carpetas/${CARPETA_DE_SOFIA}/tareas`
  const cuerpo = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown
  const tarjeta = async () =>
    within((await screen.findByRole('heading', { name: 'Tareas de esta sesión' })).closest('section')!)

  it('muestra solo las tareas de esa sesión, con su estado y quién cambió el cumplimiento', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_1}`, 'sofia')
    const tareas = await tarjeta()
    expect(await tareas.findByText(/Registrar tres situaciones/)).toBeInTheDocument()
    expect(tareas.getByText('Realizada')).toBeInTheDocument()
    expect(tareas.getByText(/Cumplimiento actualizado por Sofía Mamani \(tú\)/)).toBeInTheDocument()
    expect(tareas.queryByText(/Conversar en familia/)).not.toBeInTheDocument() // es de la sesión 2
  })

  it('agrega una tarea pendiente a la sesión correcta', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_2}`, 'sofia')
    const tareas = await tarjeta()
    await usuario.type(await tareas.findByLabelText('Nueva tarea'), '  Leer el material entregado  ')
    await usuario.click(tareas.getByRole('button', { name: 'Agregar tarea' }))

    expect(await tareas.findByText('Tarea agregada como pendiente.')).toBeInTheDocument()
    const fila = tareas.getByText('Leer el material entregado').closest('li')!
    expect(within(fila).getByText('Pendiente')).toBeInTheDocument()
    expect(tareas.getByLabelText('Nueva tarea')).toHaveValue('')
    expect(cuerpo(llamadas(fetchEspia, 'POST', RUTA_TAREAS)[0])).toEqual({
      sesionId: SESION_2,
      descripcion: 'Leer el material entregado',
    })
  })

  it('no agrega una tarea sin descripción', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_2}`, 'sofia')
    const tareas = await tarjeta()
    await usuario.type(await tareas.findByLabelText('Nueva tarea'), '   ')
    await usuario.click(tareas.getByRole('button', { name: 'Agregar tarea' }))
    expect(await tareas.findByText('Describe la tarea.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', RUTA_TAREAS)).toHaveLength(0)
  })

  it('marca una tarea como realizada y la puede volver a pendiente', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_2}`)
    const tareas = await tarjeta()
    await usuario.click(await tareas.findByRole('button', { name: /^Marcar como realizada: Conversar en familia/ }))

    const fila = tareas.getByText(/Conversar en familia/).closest('li')!
    expect(await within(fila).findByText('Realizada')).toBeInTheDocument()
    expect(within(fila).getByText(/Cumplimiento actualizado por Laura Quiroga \(tú\)/)).toBeInTheDocument()
    const ruta = `${RUTA_TAREAS}/40000000-0000-4000-8000-000000000002/cumplimiento`
    expect(cuerpo(llamadas(fetchEspia, 'PATCH', ruta)[0])).toEqual({ estado: 'realizada' })

    await usuario.click(within(fila).getByRole('button', { name: /^Volver a pendiente/ }))
    expect(await within(fila).findByText('Pendiente')).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'PATCH', ruta)[1])).toEqual({ estado: 'pendiente' })
  })

  it('si falla el cambio de cumplimiento, la tarea conserva su estado y se avisa', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_2}`, 'sofia')
    const tareas = await tarjeta()
    const boton = await tareas.findByRole('button', { name: /^Marcar como realizada/ })
    fallarUnaVez(fetchEspia, 'PATCH', `${RUTA_TAREAS}/40000000-0000-4000-8000-000000000002/cumplimiento`, 500)
    await usuario.click(boton)
    expect(await tareas.findByRole('alert')).toHaveTextContent(/^No se guardó\./)
    expect(tareas.getByText('Pendiente')).toBeInTheDocument()
  })
})

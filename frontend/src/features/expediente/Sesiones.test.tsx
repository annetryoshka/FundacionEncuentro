import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CARPETA_DE_SOFIA,
  CARPETA_SIN_ASIGNAR,
  CARPETA_VACIA_DE_SOFIA,
  SESION_2,
  fallarUnaVez,
  llamadas,
  montarApp,
} from '../../test/montarApp'

/** FE-72 · Registro, listado y detalle de sesiones (reglas FE-71). */
describe('Sesiones', () => {
  const cuerpo = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown
  const lista = async () =>
    within((await screen.findByRole('heading', { name: 'Sesiones registradas' })).closest('section')!)

  it('lista las sesiones en orden, con responsable y el estado de sus tareas', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones`, 'sofia')
    const sesiones = await lista()
    const enlaces = await sesiones.findAllByRole('link', { name: /^Sesión \d/ })
    expect(enlaces.map((e) => e.textContent)).toEqual([
      expect.stringMatching(/^Sesión 1 · 12 de octubre de 2026Responsable: Sofía Mamani1 tarea · al día$/),
      expect.stringMatching(/^Sesión 2 · 19 de octubre de 2026Responsable: Sofía Mamani1 tarea · 1 pendiente$/),
    ])
  })

  it('distingue una carpeta sin sesiones de un error de carga', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`, 'sofia')
    expect(await screen.findByText('Aún no hay sesiones registradas en esta carpeta.')).toBeInTheDocument()

    fallarUnaVez(fetchEspia, 'GET', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`, 500)
    await usuario.click(screen.getByRole('link', { name: 'Diagnóstico' }))
    await usuario.click(await screen.findByRole('link', { name: 'Sesiones y tareas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las sesiones.')
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no hay sesiones registradas en esta carpeta.')).toBeInTheDocument()
  })

  it('registra una sesión y abre su detalle con el número asignado', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`, 'sofia')
    await usuario.click(await screen.findByRole('link', { name: 'Registrar sesión' }))
    expect(await screen.findByText(/Responsable:/)).toHaveTextContent('Sofía Mamani')

    const fecha = screen.getByLabelText('Fecha de la sesión')
    await usuario.clear(fecha)
    await usuario.type(fecha, '2026-11-05')
    await usuario.type(screen.getByLabelText('Evolución'), '  Primera entrevista con la familia.  ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar sesión' }))

    expect(await screen.findByText('Sesión 1 registrada. Ahora puedes agregarle tareas.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sesión 1 · 5 de noviembre de 2026' })).toBeInTheDocument()
    expect(screen.getByText('Primera entrevista con la familia.')).toBeInTheDocument()
    const enviados = llamadas(fetchEspia, 'POST', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`)
    expect(enviados).toHaveLength(1)
    expect(cuerpo(enviados[0])).toEqual({ fecha: '2026-11-05', evolucion: 'Primera entrevista con la familia.' })
  })

  it('no envía una evolución de solo espacios ni una fecha vacía', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones/nueva`, 'sofia')
    await usuario.clear(await screen.findByLabelText('Fecha de la sesión'))
    await usuario.type(screen.getByLabelText('Evolución'), '    ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar sesión' }))

    expect(await screen.findByText('Indica la fecha de la sesión.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la evolución de la sesión.')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de la sesión')).toHaveFocus()
    expect(llamadas(fetchEspia, 'POST', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`)).toHaveLength(0)
  })

  it('si falla el guardado, conserva lo escrito y explica el error', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones/nueva`, 'sofia')
    await usuario.type(await screen.findByLabelText('Evolución'), 'Texto largo que no se debe perder')
    fallarUnaVez(fetchEspia, 'POST', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/sesiones`)
    await usuario.click(screen.getByRole('button', { name: 'Guardar sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/^No se guardó\. No hay conexión/)
    expect(screen.getByLabelText('Evolución')).toHaveValue('Texto largo que no se debe perder')
    await usuario.click(screen.getByRole('button', { name: 'Guardar sesión' }))
    expect(await screen.findByText(/Sesión 1 registrada/)).toBeInTheDocument()
  })

  it('una carpeta sin terapeuta asignada no permite registrar sesiones', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}/sesiones`)
    expect(await screen.findByText(/la carpeta necesita una terapeuta asignada/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar sesión' })).not.toBeInTheDocument()
  })

  it('cada sesión se abre por su identificador y muestra su propia evolución', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/${SESION_2}`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'Sesión 2 · 19 de octubre de 2026' })).toBeInTheDocument()
    expect(screen.getByText(/Se trabaja la comunicación familiar/)).toBeInTheDocument()
    expect(screen.queryByText(/Primera entrevista/)).not.toBeInTheDocument()
  })

  it('una sesión que no existe en la carpeta se informa sin romper la pantalla', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones/30000000-0000-4000-8000-000000000099`, 'sofia')
    expect(await screen.findByText('No encontramos esta sesión en la carpeta.')).toBeInTheDocument()
  })

  it('otra terapeuta no puede ver las sesiones de un caso ajeno', async () => {
    const { fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones`, 'carla')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
    expect(screen.queryByText(/Sesión 1/)).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/sesiones`)).toHaveLength(0)
  })
})

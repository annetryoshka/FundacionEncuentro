import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CARPETA_DE_SOFIA,
  CARPETA_SIN_ASIGNAR,
  CARPETA_VACIA_DE_SOFIA,
  fallarUnaVez,
  llamadas,
  montarApp,
} from '../../../test/montarApp'
import { atenderSimulado } from '../../../api/simulado/servidor'
import { cambios, edadCumplida, textoEdad, validarFila, aFila, filaVacia, type Familiar } from './familia'

/**
 * FE-127 · Composición familiar (FE-123, API FE-126). Carpeta de Sofía: caso A de FE-123 (padre 44, madre 41,
 * hermana 8 y abuela materna 68, edades referidas al 12/10/2026). La carpeta vacía no tiene ficha familiar.
 */
describe('Composición familiar', () => {
  const cuerpoPut = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia'], carpeta: string) =>
    JSON.parse(String((llamadas(fetchEspia, 'PUT', `/api/carpetas/${carpeta}/familia`).at(-1)![1] as RequestInit).body))

  it('muestra cada integrante por su relación con el paciente, sin convertir la edad referida', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    expect(await screen.findByRole('heading', { name: '4 integrantes' })).toBeInTheDocument()
    const padre = screen.getByRole('heading', { name: 'Padre QA' }).closest('li')!
    expect(within(padre).getByText('Padre')).toBeInTheDocument()
    expect(within(padre).getByText('44 años al 12 de octubre de 2026 (edad referida)')).toBeInTheDocument()
    expect(within(padre).getByText('Conductor')).toBeInTheDocument()
    // Nombre desconocido: se dice, no se inventa.
    const abuela = screen.getByText('Abuela materna').closest('li')!
    expect(within(abuela).getByText('Nombre no registrado')).toBeInTheDocument()
  })

  it('sin ficha familiar ofrece registrarla; registrar, recargar y ver el resultado', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`, 'sofia')
    expect(await screen.findByText('Sin composición familiar registrada')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Registrar composición familiar' }))

    await usuario.selectOptions(screen.getByLabelText('Parentesco respecto del paciente'), 'hijo')
    await usuario.type(screen.getByLabelText('Nombre completo'), 'Hijo QA')
    await usuario.selectOptions(screen.getByLabelText('Edad'), 'referida')
    await usuario.type(screen.getByLabelText('Años'), '15')
    await usuario.type(screen.getByLabelText('Ocupación o actividad'), 'Estudiante')
    await usuario.selectOptions(screen.getByLabelText('¿Vive con el paciente?'), 'si')
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    await waitFor(() => expect(screen.getByText('Composición familiar guardada.')).toHaveFocus())
    expect(screen.getByRole('heading', { name: '1 integrante' })).toBeInTheDocument()
    const enviado = cuerpoPut(fetchEspia, CARPETA_VACIA_DE_SOFIA)
    expect(enviado.version).toBeNull()
    expect(enviado.eliminarIds).toEqual([])
    expect(enviado.familiares).toEqual([
      expect.objectContaining({
        parentesco: 'hijo',
        nombreCompleto: 'Hijo QA',
        edadReferida: 15,
        conviveConPaciente: true,
      }),
    ])
    expect(enviado.familiares[0]).not.toHaveProperty('id')

    // Recargar trae lo guardado desde el servidor.
    const respuesta = await atenderSimulado(`/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`, {
      headers: (llamadas(fetchEspia, 'GET', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`)[0][1] as RequestInit)
        .headers,
    })
    expect((await respuesta.json()).version).toBe(1)
  })

  it('editar un integrante envía solo ese cambio con la versión vigente y conserva los demás', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    const ocupaciones = screen.getAllByLabelText('Ocupación o actividad')
    await usuario.clear(ocupaciones[1])
    await usuario.type(ocupaciones[1], 'Docente')
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    await screen.findByText('Composición familiar guardada.')
    const enviado = cuerpoPut(fetchEspia, CARPETA_DE_SOFIA)
    expect(enviado.version).toBe(1)
    expect(enviado.familiares).toHaveLength(1)
    expect(enviado.familiares[0]).toMatchObject({ id: '40000000-0000-4000-8000-000000000002', ocupacion: 'Docente' })
    expect(screen.getByRole('heading', { name: '4 integrantes' })).toBeInTheDocument()
    expect(screen.getByText('Docente')).toBeInTheDocument()
  })

  it('quitar un integrante guardado se puede deshacer y, al guardar, se pide en eliminarIds', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    await usuario.click(screen.getByRole('button', { name: /Quitar integrante\s*3/ }))
    expect(screen.getByText(/Se quitará a/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(screen.queryByText(/Se quitará a/)).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Quitar integrante\s*3/ }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))
    await screen.findByText('Composición familiar guardada.')
    const enviado = cuerpoPut(fetchEspia, CARPETA_DE_SOFIA)
    expect(enviado.eliminarIds).toEqual(['40000000-0000-4000-8000-000000000003'])
    expect(enviado.familiares).toEqual([])
    expect(screen.getByRole('heading', { name: '3 integrantes' })).toBeInTheDocument()
    expect(screen.queryByText('Hermana QA')).not.toBeInTheDocument()
  })

  it('cancelar no envía nada y deja la composición como estaba', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    await usuario.clear(screen.getAllByLabelText('Nombre completo')[0])
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('heading', { name: 'Padre QA' })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/familia`)).toHaveLength(0)
  })

  it('valida antes de enviar: parentesco requerido, «otro» exige descripción y edad entre 0 y 130', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`)
    await usuario.click(await screen.findByRole('button', { name: 'Registrar composición familiar' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))
    expect(screen.getByText('Elige el parentesco respecto del paciente.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Parentesco respecto del paciente')).toHaveFocus())

    await usuario.selectOptions(screen.getByLabelText('Parentesco respecto del paciente'), 'otro')
    await usuario.selectOptions(screen.getByLabelText('Edad'), 'referida')
    await usuario.type(screen.getByLabelText('Años'), '140')
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))
    expect(screen.getByText('Describe el parentesco.')).toBeInTheDocument()
    expect(screen.getByText('Escribe una edad entre 0 y 130 años.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/familia`)).toHaveLength(0)
  })

  it('un 409 avisa que otra persona guardó, conserva lo escrito y permite cargar la versión actual', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/familia`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar composición' }))
    await usuario.type(screen.getAllByLabelText('Observaciones')[0], 'Trabaja de noche.')
    fallarUnaVez(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/familia`, 409)
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))

    const aviso = await screen.findByText(/Otra persona guardó cambios/)
    await waitFor(() => expect(aviso.closest('[role="alert"], div')).toBeInTheDocument())
    expect(screen.getAllByLabelText('Observaciones')[0]).toHaveValue('Trabaja de noche.')
    await usuario.click(screen.getByRole('button', { name: 'Cargar la versión actual' }))
    expect(await screen.findByRole('heading', { name: '4 integrantes' })).toBeInTheDocument()
  })

  it('un fallo de red no borra el formulario; un fallo de carga no se presenta como «sin familia»', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones`, 'sofia')
    fallarUnaVez(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/familia`, 'red')
    const apartados = within(await screen.findByRole('navigation', { name: 'Apartados de la carpeta' }))
    await usuario.click(apartados.getByRole('link', { name: 'Familia' }))
    expect(await screen.findByText(/No se pudo cargar la composición familiar/)).toBeInTheDocument()
    expect(screen.queryByText('Sin composición familiar registrada')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: '4 integrantes' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Editar composición' }))
    fallarUnaVez(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/familia`, 'red')
    await usuario.click(screen.getByRole('button', { name: 'Guardar composición' }))
    expect(await screen.findByText(/No se guardó/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Nombre completo')[0]).toHaveValue('Padre QA')
  })

  it('una terapeuta sin la carpeta asignada no ve la familia (404 del backend)', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}/familia`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
  })

  it('el resumen de la carpeta muestra familia, genograma y diagnóstico después de los apartados', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    const contexto = within((await screen.findByRole('heading', { name: 'Contexto del paciente' })).closest('div')!)
    expect(await contexto.findByText('Padre QA', { exact: false })).toBeInTheDocument()
    expect(await contexto.findByText('Sin genograma.')).toBeInTheDocument()
    expect(contexto.getByRole('link', { name: /Ver composición familiar/ })).toHaveAttribute(
      'href',
      `/carpetas/${CARPETA_DE_SOFIA}/familia`,
    )
    // Los botones del expediente van arriba; el contexto familiar, después.
    const enlaces = screen.getAllByRole('link').map((a) => a.textContent ?? '')
    const familia = enlaces.findIndex((t) => t.startsWith('Ver composición familiar'))
    const historial = enlaces.findIndex((t) => t.startsWith('Historial'))
    expect(historial).toBeGreaterThan(-1)
    expect(historial).toBeLessThan(familia)
  })
})

describe('reglas de la composición familiar', () => {
  const guardado: Familiar = {
    id: 'f1',
    parentesco: 'padre',
    parentescoDetalle: null,
    nombreCompleto: 'Padre QA',
    fechaNacimiento: null,
    edadReferida: 44,
    fechaReferencia: '2026-11-20',
    ocupacion: 'Conductor',
    lugarTrabajoEstudio: null,
    conviveConPaciente: true,
    observaciones: null,
    creadoPor: null,
    creadoEn: '2026-11-20T10:00:00Z',
    actualizadoPor: null,
    actualizadoEn: '2026-11-20T10:00:00Z',
  }

  it('la edad referida se muestra con su fecha y no se recalcula; la de nacimiento sí', () => {
    const fecha = (v: string) => v
    expect(textoEdad(guardado, fecha)).toBe('44 años al 2026-11-20 (edad referida)')
    expect(edadCumplida('2014-11-21', '2026-11-20')).toBe(11)
    expect(edadCumplida('2014-11-20', '2026-11-20')).toBe(12)
    expect(textoEdad({ fechaNacimiento: null, edadReferida: null, fechaReferencia: null }, fecha)).toBe(
      'Edad no registrada',
    )
  })

  it('sin cambios no se envía nada; un integrante nuevo va sin id', () => {
    expect(cambios([guardado], [aFila(guardado)])).toEqual({ familiares: [], eliminarIds: [] })
    const nueva = { ...filaVacia(), parentesco: 'madre' as const }
    expect(cambios([guardado], [aFila(guardado), nueva]).familiares).toEqual([
      expect.not.objectContaining({ id: expect.anything() }),
    ])
  })

  it('no admite fechas futuras ni edad sin fecha de referencia', () => {
    const fila = {
      ...filaVacia(),
      parentesco: 'padre' as const,
      modoEdad: 'nacimiento' as const,
      fechaNacimiento: '2999-01-01',
    }
    expect(validarFila(fila).fechaNacimiento).toMatch(/futura/)
    expect(
      validarFila({ ...fila, modoEdad: 'referida', edadReferida: '40', fechaReferencia: '' }).fechaReferencia,
    ).toBeTruthy()
  })
})

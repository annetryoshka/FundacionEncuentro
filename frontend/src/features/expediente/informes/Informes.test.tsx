import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CARPETA_DE_SOFIA,
  CARPETA_SIN_ASIGNAR,
  SESION_1,
  fallarUnaVez,
  llamadas,
  montarApp,
} from '../../../test/montarApp'
import * as archivos from '../../../utilidades/archivos'

/**
 * FE-154 · Informes (plantillas FE-151, API FE-153) y FE-160 · exportación del informe revisado (API FE-159).
 * Carpeta de Sofía: dos sesiones, diagnóstico y constancia sin origen judicial (sin juzgado).
 */
describe('Informes', () => {
  const ruta = `/carpetas/${CARPETA_DE_SOFIA}/informes`
  const cuerpo = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia'], metodo: string, r: string) =>
    JSON.parse(String((llamadas(fetchEspia, metodo, r).at(-1)![1] as RequestInit).body))

  it('genera el borrador sistémico con las sesiones elegidas, lo corrige, lo revisa y lo exporta', async () => {
    const guardar = vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await usuario.click(await screen.findByRole('radio', { name: /Informe de intervención sistémica/ }))
    const sesion2 = await screen.findByRole('checkbox', { name: /Sesión 2/ })
    expect(sesion2).toBeChecked()
    await usuario.click(sesion2)
    await usuario.click(screen.getByRole('button', { name: 'Generar borrador' }))

    expect(await screen.findByText(/Borrador generado/)).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', `/api/carpetas/${CARPETA_DE_SOFIA}/informes`)).toEqual({
      tipo: 'intervencion_sistemica',
      sesionesIds: [SESION_1],
      incluirFamilia: true,
      incluirGenograma: false,
    })
    const vista = within(screen.getByRole('article', { name: 'Vista previa del informe' }))
    expect(vista.getByText(/Primera entrevista/)).toBeInTheDocument()
    expect(vista.queryByText(/Se trabaja la comunicación/)).not.toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
    // Un borrador todavía no se exporta.
    expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Revisar y corregir' }))
    const conclusiones = screen.getByLabelText('Conclusiones y recomendaciones')
    await usuario.clear(conclusiones)
    await usuario.type(conclusiones, 'Se recomienda continuar el proceso.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar como revisado' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, marcar como revisado' })).toHaveFocus())
    await usuario.click(screen.getByRole('button', { name: 'Sí, marcar como revisado' }))

    expect(await screen.findByText(/Informe revisado/)).toBeInTheDocument()
    expect(screen.getByText('Revisado')).toBeInTheDocument()
    expect(screen.getByText('Se recomienda continuar el proceso.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: /Word editable/ }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar Word' }))
    expect(await screen.findByText(/Listo: se descargó/)).toBeInTheDocument()
    const pedido = cuerpo(fetchEspia, 'POST', `/api/carpetas/${CARPETA_DE_SOFIA}/exportaciones`)
    expect(pedido).toMatchObject({ documento: 'informe', formato: 'docx' })
    expect(pedido.informeVersionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(pedido).not.toHaveProperty('secciones')
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar.mock.calls[0][0].nombre).toMatch(/\.docx$/)
  })

  it('el judicial pide el objeto y explica el 422 con lo que falta y dónde completarlo', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await usuario.click(await screen.findByRole('radio', { name: /Informe judicial/ }))
    await usuario.click(screen.getByRole('button', { name: 'Generar borrador' }))
    expect(screen.getByText('Escribe qué solicitó el juzgado (objeto del informe).')).toBeInTheDocument()
    expect(screen.getByLabelText('Objeto del informe')).toHaveFocus()
    expect(llamadas(fetchEspia, 'POST', `/api/carpetas/${CARPETA_DE_SOFIA}/informes`)).toHaveLength(0)

    await usuario.type(screen.getByLabelText('Objeto del informe'), 'Informar sobre la evolución del proceso.')
    await usuario.click(screen.getByRole('button', { name: 'Generar borrador' }))
    expect(await screen.findByText('Faltan datos para generar el informe:')).toBeInTheDocument()
    const faltante = screen.getByText(/Falta el juzgado de derivación/).closest('li')!
    expect(within(faltante).getByRole('link', { name: 'completarlo' })).toHaveAttribute(
      'href',
      `/carpetas/${CARPETA_DE_SOFIA}/constancia`,
    )
  })

  it('revisar dos veces la misma versión: el 409 conserva lo escrito y ofrece ver la revisada', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await usuario.click(await screen.findByRole('radio', { name: /Informe de intervención sistémica/ }))
    await screen.findByRole('checkbox', { name: /Sesión 1/ })
    await usuario.click(screen.getByRole('button', { name: 'Generar borrador' }))
    await usuario.click(await screen.findByRole('button', { name: 'Revisar y corregir' }))
    await usuario.type(screen.getByLabelText('Conclusiones y recomendaciones'), ' Agregado.')
    const rutaRevision = new RegExp(`/api/carpetas/${CARPETA_DE_SOFIA}/informes/[^/]+/revision$`)
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementationOnce((url, init) =>
      rutaRevision.test(new URL(String(url), 'http://x').pathname)
        ? Promise.resolve(Response.json({ message: 'Esta versión del informe ya fue revisada' }, { status: 409 }))
        : simulado(url, init),
    )
    await usuario.click(screen.getByRole('button', { name: 'Guardar como revisado' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, marcar como revisado' }))
    expect(await screen.findByText(/ya fue revisada/)).toBeInTheDocument()
    expect(screen.getByLabelText('Conclusiones y recomendaciones')).toHaveValue(
      'Pendiente de redacción profesional. Agregado.',
    )
    expect(screen.getByRole('button', { name: 'Ver la versión revisada' })).toBeInTheDocument()
  })

  it('administración no tiene el apartado de informes (solo la terapeuta asignada)', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    await screen.findByRole('heading', { name: 'Expediente clínico' })
    expect(screen.queryByRole('link', { name: /^Informes/ })).not.toBeInTheDocument()
  })

  it('otra terapeuta no llega a los informes de una carpeta ajena', async () => {
    await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}/informes`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
  })

  it('un enlace a un informe inexistente lo dice claramente', async () => {
    await montarApp(`${ruta}/00000000-0000-4000-8000-0000000000aa`, 'sofia')
    expect(await screen.findByText('No encontramos este informe')).toBeInTheDocument()
  })

  it('lista los informes del caso para volver a abrir un borrador', async () => {
    const { usuario } = await montarApp(ruta, 'sofia')
    expect(await screen.findByText('Todavía no se generó ningún informe para este caso.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: /Informe de intervención sistémica/ }))
    await usuario.click(screen.getByRole('button', { name: 'Generar borrador' }))
    await screen.findByText(/Borrador generado/)

    await usuario.click(screen.getByRole('link', { name: 'Informes' }))
    const lista = within((await screen.findByRole('heading', { name: 'Informes del caso' })).closest('section')!)
    const enlace = await lista.findByRole('link', {
      name: /^Revisar borrador: Informe de intervención sistémica del \d+ de \w+ de \d{4}$/,
    })
    expect(lista.getByText('Borrador')).toBeInTheDocument()
    expect(lista.getByText(/Generado por .*\(tú\)/)).toBeInTheDocument()

    await usuario.click(enlace)
    expect(await screen.findByRole('button', { name: 'Revisar y corregir' })).toBeInTheDocument()
  })
})

describe('Exportación de ficha e historial (FE-160)', () => {
  const rutaExport = `/api/carpetas/${CARPETA_DE_SOFIA}/exportaciones`
  const pedido = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia']) =>
    JSON.parse(String((llamadas(fetchEspia, 'POST', rutaExport).at(-1)![1] as RequestInit).body))

  it('exporta la ficha con las secciones elegidas y descarga el archivo privado', async () => {
    const guardar = vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    await screen.findByRole('heading', { name: 'Exportar a PDF o Word' })
    await usuario.click(screen.getByRole('checkbox', { name: 'Composición familiar' }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(await screen.findByText(/Listo: se descargó/)).toBeInTheDocument()
    expect(pedido(fetchEspia)).toEqual({
      formatoVersion: 1,
      documento: 'ficha',
      formato: 'pdf',
      secciones: ['identificacion', 'diagnostico', 'familia'],
    })
    const [archivo, respaldo] = guardar.mock.calls[0]
    expect(archivo.contenido.size).toBeGreaterThan(0)
    expect(respaldo).toBe('ficha-carpeta-1.pdf')
  })

  it('una terapeuta no ve la opción de pagos; administración sí, solo en el historial', async () => {
    vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    await usuario.click(await screen.findByRole('radio', { name: /Historial/ }))
    expect(screen.queryByRole('checkbox', { name: /Pagos/ })).not.toBeInTheDocument()
  })

  it('administración puede incluir pagos en el historial', async () => {
    vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    await usuario.click(await screen.findByRole('radio', { name: /Historial/ }))
    await usuario.click(screen.getByRole('checkbox', { name: /Pagos por sesión/ }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await screen.findByText(/Listo: se descargó/)
    expect(pedido(fetchEspia)).toMatchObject({ documento: 'historial', incluirPagos: true })
  })

  it('sin secciones no envía nada; un fallo se explica y un doble clic no duplica el pedido', async () => {
    const guardar = vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    await screen.findByRole('heading', { name: 'Exportar a PDF o Word' })
    await usuario.click(screen.getByRole('checkbox', { name: /Identificación/ }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Evaluación y diagnóstico' }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(screen.getByText('Elige al menos una sección.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', rutaExport)).toHaveLength(0)

    await usuario.click(screen.getByRole('checkbox', { name: /Identificación/ }))
    fallarUnaVez(fetchEspia, 'POST', rutaExport, 500)
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(
      await screen.findByText('No se pudo generar el archivo. Intenta de nuevo en unos minutos.'),
    ).toBeInTheDocument()
    expect(guardar).not.toHaveBeenCalled()

    // Mientras el primer pedido no responde, otro clic no genera un segundo archivo.
    let soltar: () => void = () => undefined
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementationOnce(
      (url, init) => new Promise((listo) => (soltar = () => listo(simulado(url, init) as Promise<Response>))),
    )
    const boton = screen.getByRole('button', { name: 'Descargar PDF' })
    await usuario.dblClick(boton)
    expect(screen.getByRole('button', { name: 'Generando…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Generando el archivo')
    soltar()
    await screen.findByText(/Listo: se descargó/)
    expect(llamadas(fetchEspia, 'POST', rutaExport)).toHaveLength(2)
  })
})

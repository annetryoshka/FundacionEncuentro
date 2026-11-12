import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_VACIA_DE_SOFIA, fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'

/** FE-62 · Origen del caso y constancia de consentimiento (reglas FE-61, API FE-63). */
describe('Origen y consentimiento', () => {
  const RUTA = `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/constancia`
  const cuerpo = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown

  async function abrirFormulario() {
    const montado = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/constancia`, 'sofia')
    expect(await screen.findByText(/Sin registro\. Todavía no se registró/)).toBeInTheDocument()
    expect(screen.getByText('Derivado')).toBeInTheDocument() // tipo de ingreso, solo lectura
    await montado.usuario.click(screen.getByRole('button', { name: 'Registrar origen y constancia' }))
    return montado
  }

  it('muestra una constancia registrada con su fecha y evidencia', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/constancia`, 'sofia')
    expect(await screen.findByText('Registrada')).toBeInTheDocument()
    expect(screen.getByText('12 de octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('EVIDENCIA-DEMO')).toBeInTheDocument()
  })

  it('Registrada exige fecha y referencia; con ellas se guarda y se muestra', async () => {
    const { usuario, fetchEspia } = await abrirFormulario()
    await usuario.type(screen.getByLabelText('Procedencia (opcional)'), 'Juzgado 2º de Familia')
    await usuario.click(screen.getByLabelText('El caso proviene de un juzgado'))
    await usuario.click(screen.getByRole('radio', { name: /Registrada/ }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Indica la fecha del consentimiento.')).toBeInTheDocument()
    expect(screen.getByText('Indica la referencia de la evidencia.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', RUTA)).toHaveLength(0)

    await usuario.type(screen.getByLabelText('Fecha del consentimiento'), '2026-11-10')
    await usuario.type(screen.getByLabelText('Referencia de evidencia'), 'EVIDENCIA-DEMO')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Origen y constancia guardados.')).toBeInTheDocument()
    expect(screen.getByText('Registrada')).toBeInTheDocument()
    expect(screen.getByText('10 de noviembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Juzgado 2º de Familia')).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'PUT', RUTA)[0])).toEqual({
      procedencia: 'Juzgado 2º de Familia',
      origenJudicial: true,
      estado: 'registrado',
      fechaConsentimiento: '2026-11-10',
      referenciaEvidencia: 'EVIDENCIA-DEMO',
      explicacion: null,
    })
  })

  it('No aplica exige explicación y no envía fecha ni evidencia', async () => {
    const { usuario, fetchEspia } = await abrirFormulario()
    await usuario.click(screen.getByRole('radio', { name: /Registrada/ }))
    await usuario.type(screen.getByLabelText('Referencia de evidencia'), 'algo escrito antes')
    await usuario.click(screen.getByRole('radio', { name: /No aplica/ }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Explica por qué no aplica la constancia.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Explicación'), 'Atención de orientación única')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('No aplica')).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'PUT', RUTA)[0])).toMatchObject({
      estado: 'no_aplica',
      fechaConsentimiento: null,
      referenciaEvidencia: null,
      explicacion: 'Atención de orientación única',
    })
  })

  it('Pendiente se guarda sin datos de la constancia', async () => {
    const { usuario, fetchEspia } = await abrirFormulario()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'PUT', RUTA)[0])).toEqual({
      procedencia: null,
      origenJudicial: false,
      estado: 'pendiente',
      fechaConsentimiento: null,
      referenciaEvidencia: null,
      explicacion: null,
    })
  })

  it('si el servidor rechaza el guardado, se conserva el formulario y su mensaje', async () => {
    const { usuario, fetchEspia } = await abrirFormulario()
    await usuario.type(screen.getByLabelText('Procedencia (opcional)'), 'DNA El Alto')
    fallarUnaVez(fetchEspia, 'PUT', RUTA, 400)
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó: Fallo ficticio QA')
    expect(screen.getByLabelText('Procedencia (opcional)')).toHaveValue('DNA El Alto')
  })
})

import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { llamadas, montarApp } from '../../test/montarApp'
import { hoyIso } from '../../utilidades/fechas'
import { validarNuevaCarpeta } from './validacion'

/** FE-31 · Formulario y resumen de carpeta (criterios de FE-11 que tocan la interfaz). */
describe('PaginaNuevaCarpeta', () => {
  const campo = (nombre: string) => screen.getByLabelText(nombre, { selector: 'input' })

  it('el número de carpeta no se puede escribir en el formulario', async () => {
    await montarApp('/carpetas/nueva')
    expect(screen.queryByLabelText(/número/i, { selector: 'input' })).not.toBeInTheDocument()
    expect(screen.getByText(/se asigna automáticamente/)).toBeInTheDocument()
  })

  it('nombre vacío impide guardar y no llama a la API', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(screen.getByText('Escribe el nombre completo del paciente.')).toBeInTheDocument()
    expect(campo('Nombre completo del paciente')).toHaveFocus()
    expect(llamadas(fetchEspia, 'POST', '/api/casos')).toHaveLength(0)
  })

  it('valida la fecha de ingreso', () => {
    const base = { nombreCompleto: 'Rosa Apaza', tipo: 'voluntario' }
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '' }).fechaIngreso).toBe('Indica la fecha de ingreso.')
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '2026-02-31' }).fechaIngreso).toBe('La fecha no es válida.')
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '2999-01-01' }).fechaIngreso).toMatch(/futura/)
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: hoyIso() })).toEqual({})
  })

  it('un registro válido abre el resumen con el número asignado', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), '  Rosa   Apaza Limachi ')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    // Los datos ficticios tienen 9 carpetas voluntarias: la nueva es la Nº 10.
    expect(await screen.findByText(/abierta para Rosa Apaza Limachi/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Rosa Apaza Limachi' })).toBeInTheDocument()
    expect(screen.getAllByText('Nº 10').length).toBeGreaterThan(0)

    const [, init] = llamadas(fetchEspia, 'POST', '/api/casos')[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      paciente: { nombreCompleto: 'Rosa Apaza Limachi' },
      caso: { fechaIngreso: hoyIso(), tipo: 'voluntario' },
    })
  })

  it('un nombre similar permite el alta y muestra una advertencia sin inventar un conflicto', async () => {
    const { usuario } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), 'mariana gutierrez paz')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(await screen.findByText(/Se encontraron pacientes con nombres similares/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'mariana gutierrez paz' })).toBeInTheDocument()
  })

  it('doble clic mientras el alta está pendiente envía una sola solicitud', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    const simulado = fetchEspia.getMockImplementation()!
    let completar!: () => void
    fetchEspia.mockImplementation((entrada, init) => String(entrada).endsWith('/casos') && init?.method === 'POST'
      ? new Promise<Response>((resolve) => { completar = () => { void simulado(entrada, init).then(resolve) } })
      : simulado(entrada, init))
    await usuario.type(campo('Nombre completo del paciente'), 'Paciente QA doble envío')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.dblClick(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))
    expect(llamadas(fetchEspia, 'POST', '/api/casos')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled()
    await act(async () => { completar() })
    expect(await screen.findByRole('heading', { level: 1, name: 'Paciente QA doble envío' })).toBeInTheDocument()
  })

  it('409 de numeración no se presenta como un paciente duplicado', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation((entrada, init) => String(entrada).endsWith('/casos') && init?.method === 'POST'
      ? Promise.resolve(Response.json({ message: 'Número ya registrado' }, { status: 409 }))
      : simulado(entrada, init))
    await usuario.type(campo('Nombre completo del paciente'), 'Paciente QA conflicto')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))
    expect(await screen.findByText(/El número de carpeta ya está registrado/)).toBeInTheDocument()
    expect(screen.queryByText(/Ya existe una carpeta con un nombre igual/)).not.toBeInTheDocument()
  })

  it.each(['red', 'servidor'])('POST confirmado y GET fallido por %s: recupera el mismo detalle sin otra alta', async (fallo) => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    const simulado = fetchEspia.getMockImplementation()!
    let carpetaId = ''
    let fallarDetalle = true
    const consultas: string[] = []
    fetchEspia.mockImplementation(async (entrada, init) => {
      const ruta = new URL(String(entrada), 'http://qa').pathname
      if (ruta === '/api/casos' && init?.method === 'POST') {
        const respuesta = await simulado(entrada, init)
        carpetaId = ((await respuesta.clone().json()) as { id: string }).id
        return respuesta
      }
      if (carpetaId && ruta === `/api/carpetas/${carpetaId}` && (init?.method ?? 'GET') === 'GET') {
        consultas.push(ruta)
        if (fallarDetalle) {
          if (fallo === 'red') throw new TypeError('Fallo de red simulado')
          return Response.json({ message: 'Error del servidor simulado' }, { status: 500 })
        }
      }
      return simulado(entrada, init)
    })
    await usuario.type(campo('Nombre completo del paciente'), 'Paciente QA detalle recuperable')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(await screen.findByText(/El registro se guardó/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar y abrir carpeta' })).not.toBeInTheDocument()
    expect(carpetaId).not.toBe('')
    expect(consultas).toEqual([`/api/carpetas/${carpetaId}`])
    expect(llamadas(fetchEspia, 'POST', '/api/casos')).toHaveLength(1)

    fallarDetalle = false
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Paciente QA detalle recuperable' })).toBeInTheDocument()
    expect(consultas).toEqual([`/api/carpetas/${carpetaId}`, `/api/carpetas/${carpetaId}`])
    expect(llamadas(fetchEspia, 'POST', '/api/casos')).toHaveLength(1)
    expect(screen.queryByText(/El registro se guardó/)).not.toBeInTheDocument()
  })
})

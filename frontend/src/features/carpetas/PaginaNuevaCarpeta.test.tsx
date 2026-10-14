import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { llamadas, montarApp } from '../../test/montarApp'
import { hoyIso } from '../../utilidades/fechas'
import { aNuevaCarpeta, FORMULARIO_VACIO, validarNuevaCarpeta } from './validacion'

/** FE-31 · Registro integral con POST /api/casos (criterios de FE-11 que tocan la interfaz). */
describe('PaginaNuevaCarpeta', () => {
  const campo = (nombre: string | RegExp) => screen.getByLabelText(nombre, { selector: 'input' })
  const base = { ...FORMULARIO_VACIO, nombreCompleto: 'Rosa Apaza', tipo: 'voluntario', fechaIngreso: hoyIso() }

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

  it('valida las fechas igual que el backend', () => {
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '' }).fechaIngreso).toBe('Indica la fecha de ingreso.')
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '2026-02-31' }).fechaIngreso).toBe('La fecha no es válida.')
    expect(validarNuevaCarpeta({ ...base, fechaIngreso: '2999-01-01' }).fechaIngreso).toMatch(/futura/)
    expect(
      validarNuevaCarpeta({ ...base, fechaIngreso: '2026-01-10', fechaNacimiento: '2026-02-01' }).fechaNacimiento,
    ).toMatch(/posterior/)
    expect(validarNuevaCarpeta(base)).toEqual({})
  })

  it('el cuerpo no lleva campos vacíos ni contexto judicial en un caso voluntario', () => {
    expect(aNuevaCarpeta({ ...base, nombreCompleto: '  Rosa   Apaza ', juzgado: 'Juzgado 1' })).toEqual({
      paciente: { nombreCompleto: 'Rosa Apaza' },
      caso: { tipo: 'voluntario', fechaIngreso: hoyIso() },
    })
    expect(JSON.parse(JSON.stringify(aNuevaCarpeta({ ...base, tipo: 'derivado', juzgado: ' Juzgado 1 ' })))).toEqual({
      paciente: { nombreCompleto: 'Rosa Apaza' },
      caso: { tipo: 'derivado', fechaIngreso: hoyIso() },
      contextoJudicial: { juzgado: 'Juzgado 1' },
    })
  })

  it('un registro válido abre el resumen con el número asignado', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), '  Rosa   Apaza Limachi ')
    await usuario.type(campo(/Teléfono/), '77263336')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    // Los datos ficticios tienen 9 carpetas voluntarias: la nueva es la Nº 10.
    expect(await screen.findByText(/abierta para Rosa Apaza Limachi/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Rosa Apaza Limachi' })).toBeInTheDocument()
    expect(screen.getAllByText('Nº 10').length).toBeGreaterThan(0)
    expect(screen.getByText('77263336')).toBeInTheDocument()

    const [, init] = llamadas(fetchEspia, 'POST', '/api/casos')[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      paciente: { nombreCompleto: 'Rosa Apaza Limachi', telefono: '77263336' },
      caso: { tipo: 'voluntario', fechaIngreso: hoyIso() },
    })
  })

  it('un derivado guarda el contexto judicial y lo muestra en la carpeta', async () => {
    const { usuario } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), 'Familia Quispe Mamani')
    await usuario.click(screen.getByRole('radio', { name: /Derivado/ }))
    await usuario.type(campo('Juzgado o institución'), 'Juzgado Público de Familia 5.º')
    await usuario.type(campo('Nº de expediente'), 'EXP-2026-118')
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(await screen.findByRole('heading', { name: 'Contexto de la derivación' })).toBeInTheDocument()
    expect(screen.getByText('EXP-2026-118')).toBeInTheDocument()
  })

  it('un nombre parecido a otro paciente registra igual pero avisa para revisarlo', async () => {
    const { usuario } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), 'Mariana Gutierrez Paz')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(await screen.findByText(/abierta para Mariana Gutierrez Paz/)).toBeInTheDocument()
    expect(screen.getByText(/ya hay pacientes con un nombre parecido/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mariana Gutiérrez Paz' })).toHaveAttribute(
      'href',
      '/carpetas?q=Mariana%20Guti%C3%A9rrez%20Paz',
    )
  })
})

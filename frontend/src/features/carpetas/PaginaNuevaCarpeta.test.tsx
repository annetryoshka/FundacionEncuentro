import { screen } from '@testing-library/react'
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
    expect(llamadas(fetchEspia, 'POST', '/api/carpetas')).toHaveLength(0)
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

    const [, init] = llamadas(fetchEspia, 'POST', '/api/carpetas')[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      nombreCompleto: 'Rosa Apaza Limachi',
      fechaIngreso: hoyIso(),
      tipo: 'voluntario',
    })
  })

  it('un paciente duplicado muestra la advertencia y enlaza a la carpeta existente', async () => {
    const { usuario } = await montarApp('/carpetas/nueva')
    await usuario.type(campo('Nombre completo del paciente'), 'mariana gutierrez paz')
    await usuario.click(screen.getByRole('radio', { name: /Voluntario/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar y abrir carpeta' }))

    expect(await screen.findByText(/Ya existe una carpeta con un nombre igual/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carpeta Nº 1 \(Voluntario\): Mariana Gutiérrez Paz/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registrar paciente' })).toBeInTheDocument()
  })
})

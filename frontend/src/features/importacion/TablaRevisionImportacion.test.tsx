import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TablaRevisionImportacion } from './TablaRevisionImportacion'
import type { FilaImportacion } from './importacion'

const fila: FilaImportacion = {
  numeroFila: 2,
  referenciaOrigen: 'ARCH-QA-1',
  datos: { nombreCompleto: 'Paciente QA', tipo: 'voluntario' },
  estado: 'error',
  errores: [{ campo: 'fechaIngreso', mensaje: 'Fecha inválida' }],
  advertencias: [],
  coincidencias: [{ tipo: 'fila', numeroFila: 3, mismoNumero: true }],
  decision: null,
  resultado: null,
}

describe('FE-162 · tabla de revisión', () => {
  it('muestra el mapeo, los errores y coincidencias y abre el detalle de la fila correcta', async () => {
    const alRevisar = vi.fn()
    const usuario = userEvent.setup()
    render(<TablaRevisionImportacion filas={[fila]} alRevisar={alRevisar} />)
    const tabla = within(screen.getByRole('table', { name: 'Resumen de revisión' }))
    expect(tabla.getByText('ARCH-QA-1')).toBeInTheDocument()
    expect(tabla.getByText('Paciente QA')).toBeInTheDocument()
    expect(tabla.getByText('Número por asignar')).toBeInTheDocument()
    expect(tabla.getByText('1 error · 1 coincidencia')).toBeInTheDocument()
    expect(tabla.getByText('Sin decidir')).toBeInTheDocument()
    await usuario.click(tabla.getByRole('button', { name: 'Revisar fila 2' }))
    expect(alRevisar).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('respeta las decisiones del servidor y bloquea el acceso a una revisión obsoleta', () => {
    render(<TablaRevisionImportacion filas={[{ ...fila, decision: 'excluir' }]} alRevisar={vi.fn()} bloqueada />)
    expect(screen.getByText('Excluir')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar fila 2' })).toBeDisabled()
  })

  it('no inventa filas cuando el filtro queda vacío', () => {
    render(<TablaRevisionImportacion filas={[]} alRevisar={vi.fn()} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

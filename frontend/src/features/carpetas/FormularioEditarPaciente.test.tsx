
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorApi } from '../../api/cliente'
import { FormularioEditarPaciente } from './FormularioEditarPaciente'
import { actualizarDatosPaciente } from './carpetasApi'
import type { CarpetaDetalle } from './tipos'

vi.mock('./carpetasApi', () => ({
  actualizarDatosPaciente: vi.fn(),
}))

const carpeta: CarpetaDetalle = {
  id: '10000000-0000-4000-8000-000000000001',
  numero: 9,
  tipo: 'voluntario',
  estado: 'iniciado',
  fechaIngreso: '2026-09-15',
  paciente: {
    id: '20000000-0000-4000-8000-000000000001',
    nombreCompleto: 'Juan Pérez',
  },
  terapeuta: null,
  creadoPor: null,
  creadoEn: '2026-09-15T12:00:00.000Z',
  asignadoPor: null,
  asignadoEn: null,
}

const actualizar = vi.mocked(actualizarDatosPaciente)

function montarFormulario() {
  const alGuardar = vi.fn()
  const alCancelar = vi.fn()

  render(
    <FormularioEditarPaciente
      carpeta={carpeta}
      alGuardar={alGuardar}
      alCancelar={alCancelar}
    />,
  )

  return { alGuardar, alCancelar }
}

describe('FE-52 - Edición de datos del paciente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga los datos actuales del paciente', () => {
    montarFormulario()

    expect(
      screen.getByRole('textbox', {
        name: 'Nombre completo del paciente',
      }),
    ).toHaveValue('Juan Pérez')

    expect(
      screen.getByLabelText('Fecha de ingreso'),
    ).toHaveValue('2026-09-15')
  })

  it('muestra el número de carpeta como solo lectura', () => {
    montarFormulario()

    const numero = screen.getByRole('textbox', {
      name: 'Número de carpeta',
    })

    expect(numero).toHaveValue('Nº 9')
    expect(numero).toHaveAttribute('readonly')
  })

  it('guarda correctamente los cambios', async () => {
    const usuario = userEvent.setup()

    const actualizada: CarpetaDetalle = {
      ...carpeta,
      paciente: {
        ...carpeta.paciente,
        nombreCompleto: 'Juan Carlos Pérez',
      },
    }

    actualizar.mockResolvedValueOnce(actualizada)

    const { alGuardar } = montarFormulario()

    const nombre = screen.getByRole('textbox', {
      name: 'Nombre completo del paciente',
    })

    await usuario.clear(nombre)
    await usuario.type(nombre, 'Juan Carlos Pérez')

    await usuario.click(
      screen.getByRole('button', {
        name: 'Guardar cambios',
      }),
    )

    expect(actualizar).toHaveBeenCalledWith(
      carpeta.id,
      {
        nombreCompleto: 'Juan Carlos Pérez',
        fechaIngreso: '2026-09-15',
      },
    )

    expect(alGuardar).toHaveBeenCalledWith(actualizada)
  })

  it('cancelar no guarda los cambios', async () => {
    const usuario = userEvent.setup()
    const { alCancelar } = montarFormulario()

    const nombre = screen.getByRole('textbox', {
      name: 'Nombre completo del paciente',
    })

    await usuario.clear(nombre)
    await usuario.type(nombre, 'Otro nombre')

    await usuario.click(
      screen.getByRole('button', {
        name: 'Cancelar',
      }),
    )

    expect(alCancelar).toHaveBeenCalledOnce()
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('no permite guardar un nombre vacío', async () => {
    const usuario = userEvent.setup()
    montarFormulario()

    const nombre = screen.getByRole('textbox', {
      name: 'Nombre completo del paciente',
    })

    await usuario.clear(nombre)

    await usuario.click(
      screen.getByRole('button', {
        name: 'Guardar cambios',
      }),
    )

    expect(
      screen.getByText('Escribe el nombre completo del paciente.'),
    ).toBeInTheDocument()

    expect(actualizar).not.toHaveBeenCalled()
  })

  it('muestra el error del backend sin confirmar el guardado', async () => {
    const usuario = userEvent.setup()

    actualizar.mockRejectedValueOnce(
      new ErrorApi(400, 'La fecha de ingreso no es válida'),
    )

    const { alGuardar } = montarFormulario()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Guardar cambios',
      }),
    )

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('La fecha de ingreso no es válida')

    expect(alGuardar).not.toHaveBeenCalled()
  })
})

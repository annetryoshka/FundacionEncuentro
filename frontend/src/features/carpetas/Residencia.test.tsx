import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { EtiquetaResidencia } from './EtiquetaResidencia'
import { FiltroResidenciaCarpetas, SelectorResidencia } from './SelectorResidencia'
import {
  aDatosResidencia,
  aValorResidencia,
  textoResidencia,
  validarResidencia,
  type FiltroResidencia,
  type ValorResidencia,
} from './residencia'

describe('reglas de residencia (contrato FE-134)', () => {
  it('escribe la residencia con texto, también para datos antiguos y «otra localidad»', () => {
    expect(textoResidencia({ ciudadResidencia: 'la_paz', otraLocalidad: null })).toBe('La Paz')
    expect(textoResidencia({ ciudadResidencia: 'el_alto', otraLocalidad: null })).toBe('El Alto')
    expect(textoResidencia({ ciudadResidencia: null, otraLocalidad: null })).toBe('Sin registrar')
    expect(textoResidencia({ ciudadResidencia: 'otra', otraLocalidad: ' Viacha ficticia ' })).toBe(
      'Otra localidad: Viacha ficticia',
    )
  })

  it('«otra» exige el nombre de la localidad; las demás no', () => {
    expect(validarResidencia({ ciudad: 'otra', localidad: '   ' }).localidad).toMatch(/localidad/i)
    expect(validarResidencia({ ciudad: 'otra', localidad: 'Viacha ficticia' })).toEqual({})
    expect(validarResidencia({ ciudad: 'la_paz', localidad: '' })).toEqual({})
    expect(validarResidencia({ ciudad: '', localidad: '' })).toEqual({})
  })

  it('rechaza una ciudad fuera del catálogo', () => {
    expect(validarResidencia({ ciudad: 'cochabamba', localidad: '' }).ciudad).toBeTruthy()
  })

  it('envía la localidad solo con «otra» y null cuando no hay ciudad', () => {
    expect(aDatosResidencia({ ciudad: 'el_alto', localidad: 'residuo' })).toEqual({
      ciudadResidencia: 'el_alto',
      otraLocalidad: null,
    })
    expect(aDatosResidencia({ ciudad: 'otra', localidad: ' Viacha ficticia ' })).toEqual({
      ciudadResidencia: 'otra',
      otraLocalidad: 'Viacha ficticia',
    })
    expect(aDatosResidencia({ ciudad: '', localidad: '' })).toEqual({ ciudadResidencia: null, otraLocalidad: null })
  })

  it('convierte lo que devuelve la API en el valor inicial del formulario', () => {
    expect(aValorResidencia({ ciudadResidencia: null, otraLocalidad: null })).toEqual({ ciudad: '', localidad: '' })
    expect(aValorResidencia({ ciudadResidencia: 'otra', otraLocalidad: 'Viacha ficticia' })).toEqual({
      ciudad: 'otra',
      localidad: 'Viacha ficticia',
    })
  })
})

describe('EtiquetaResidencia', () => {
  it('muestra el texto de cada caso del contrato', () => {
    const { rerender } = render(<EtiquetaResidencia ciudadResidencia="el_alto" otraLocalidad={null} />)
    expect(screen.getByText('El Alto')).toBeInTheDocument()
    rerender(<EtiquetaResidencia ciudadResidencia={null} otraLocalidad={null} />)
    expect(screen.getByText('Sin registrar')).toBeInTheDocument()
    rerender(<EtiquetaResidencia ciudadResidencia="otra" otraLocalidad="Viacha ficticia" />)
    expect(screen.getByText('Otra localidad: Viacha ficticia')).toBeInTheDocument()
  })
})

function Formulario({ inicial, alCambiar }: { inicial: ValorResidencia; alCambiar?: (v: ValorResidencia) => void }) {
  const [valor, setValor] = useState(inicial)
  const errores = validarResidencia(valor)
  return (
    <SelectorResidencia
      valor={valor}
      errores={errores}
      alCambiar={(v) => {
        setValor(v)
        alCambiar?.(v)
      }}
    />
  )
}

describe('SelectorResidencia', () => {
  it('ofrece las opciones acordadas y «Sin registrar» por defecto', () => {
    render(<Formulario inicial={{ ciudad: '', localidad: '' }} />)
    const campo = screen.getByLabelText('Ciudad de residencia')
    const textos = Array.from((campo as HTMLSelectElement).options).map((o) => o.textContent)
    expect(textos).toEqual(['Sin registrar', 'La Paz', 'El Alto', 'Otra localidad'])
    expect(campo).toHaveValue('')
    expect(screen.queryByLabelText('Localidad')).not.toBeInTheDocument()
  })

  it('explica que es la ciudad donde vive el paciente, no la sede', () => {
    render(<Formulario inicial={{ ciudad: '', localidad: '' }} />)
    expect(screen.getByText(/donde vive el paciente, no donde se atiende/i)).toBeInTheDocument()
  })

  it('«Otra localidad» muestra el campo obligatorio y avisa si queda vacío', async () => {
    const usuario = userEvent.setup()
    render(<Formulario inicial={{ ciudad: '', localidad: '' }} />)
    await usuario.selectOptions(screen.getByLabelText('Ciudad de residencia'), 'otra')
    const localidad = screen.getByLabelText('Localidad')
    expect(localidad).toBeInTheDocument()
    expect(screen.getByText('Escribe el nombre de la localidad.')).toBeInTheDocument()
    await usuario.type(localidad, 'Viacha ficticia')
    expect(screen.queryByText('Escribe el nombre de la localidad.')).not.toBeInTheDocument()
  })

  it('al cambiar a otra ciudad descarta la localidad escrita', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<Formulario inicial={{ ciudad: 'otra', localidad: 'Viacha ficticia' }} alCambiar={alCambiar} />)
    await usuario.selectOptions(screen.getByLabelText('Ciudad de residencia'), 'el_alto')
    expect(alCambiar).toHaveBeenLastCalledWith({ ciudad: 'el_alto', localidad: '' })
    expect(screen.queryByLabelText('Localidad')).not.toBeInTheDocument()
  })

  it('un error de la API en la ciudad queda asociado al campo', () => {
    render(
      <SelectorResidencia
        valor={{ ciudad: '', localidad: '' }}
        alCambiar={() => {}}
        errores={{ ciudad: 'Elige una opción de la lista.' }}
      />,
    )
    const campo = screen.getByLabelText('Ciudad de residencia')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription('Elige una opción de la lista.')
  })
})

describe('FiltroResidenciaCarpetas', () => {
  function Filtro({ alCambiar }: { alCambiar: (v: FiltroResidencia) => void }) {
    const [valor, setValor] = useState<FiltroResidencia>('')
    return (
      <FiltroResidenciaCarpetas
        valor={valor}
        alCambiar={(v) => {
          setValor(v)
          alCambiar(v)
        }}
      />
    )
  }

  it('ofrece «Todas» y «Sin registrar» además de las ciudades', () => {
    render(<Filtro alCambiar={() => {}} />)
    const campo = screen.getByLabelText('Residencia') as HTMLSelectElement
    expect(Array.from(campo.options).map((o) => o.textContent)).toEqual([
      'Todas',
      'La Paz',
      'El Alto',
      'Otra localidad',
      'Sin registrar',
    ])
    expect(campo).toHaveValue('')
  })

  it('«Sin registrar» envía sin_registrar y «Todas» vuelve a vacío', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<Filtro alCambiar={alCambiar} />)
    const campo = screen.getByLabelText('Residencia')
    await usuario.selectOptions(campo, 'sin_registrar')
    expect(alCambiar).toHaveBeenLastCalledWith('sin_registrar')
    await usuario.selectOptions(campo, 'el_alto')
    expect(alCambiar).toHaveBeenLastCalledWith('el_alto')
    await usuario.selectOptions(campo, '')
    expect(alCambiar).toHaveBeenLastCalledWith('')
  })
})

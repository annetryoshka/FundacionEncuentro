import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ResumenFamilia } from './ResumenFamilia'
import type { Familiar } from './familia'
import { CARPETA_DE_SOFIA, montarApp } from '../../../test/montarApp'

const padre: Familiar = {
  id: 'padre-qa',
  parentesco: 'padre',
  parentescoDetalle: null,
  nombreCompleto: 'Padre QA',
  fechaNacimiento: null,
  edadReferida: 44,
  fechaReferencia: '2026-10-12',
  ocupacion: 'Conductor',
  lugarTrabajoEstudio: 'Transporte Demo',
  conviveConPaciente: true,
  observaciones: 'Texto reservado al detalle',
  creadoPor: 'terapeuta-qa',
  creadoEn: '2026-10-12',
  actualizadoPor: null,
  actualizadoEn: '2026-10-12',
}

describe('FE-124 · resumen familiar', () => {
  it('sitúa el expediente clínico arriba, luego los datos generales y después el contexto', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    const generales = await screen.findByRole('heading', { name: 'Resumen' })
    const contexto = screen.getByRole('heading', { name: 'Contexto del paciente' })
    const historial = screen.getByRole('link', { name: /^Historial/ })
    expect(historial.compareDocumentPosition(generales) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(generales.compareDocumentPosition(contexto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('muestra edad con referencia, ocupación y lugar sin exponer observaciones del detalle', () => {
    render(<ResumenFamilia familiares={[padre]} />)
    const familiar = screen.getByText(/Padre QA/).closest('li')!
    expect(within(familiar).getByText('44 años al 12 de octubre de 2026 (edad referida)')).toBeInTheDocument()
    expect(within(familiar).getByText('Conductor')).toBeInTheDocument()
    expect(within(familiar).getByText('Transporte Demo')).toBeInTheDocument()
    expect(screen.queryByText(padre.observaciones!)).not.toBeInTheDocument()
  })

  it('distingue cada dato desconocido sin inventar nombres, trabajo ni edad', () => {
    render(
      <ResumenFamilia
        familiares={[
          {
            ...padre,
            nombreCompleto: null,
            edadReferida: null,
            fechaReferencia: null,
            ocupacion: null,
            lugarTrabajoEstudio: null,
          },
        ]}
      />,
    )
    expect(screen.getByText(/Nombre desconocido/)).toBeInTheDocument()
    expect(screen.getByText('Edad no registrada')).toBeInTheDocument()
    expect(screen.getByText('Desconocida')).toBeInTheDocument()
    expect(screen.getByText('Desconocido')).toBeInTheDocument()
  })

  it('permite consultar todos los integrantes y volver al resumen sin hacer escrituras', async () => {
    const usuario = userEvent.setup()
    const familiares = Array.from({ length: 6 }, (_, i) => ({
      ...padre,
      id: `qa-${i}`,
      nombreCompleto: `Familiar QA ${i}`,
    }))
    render(<ResumenFamilia familiares={familiares} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    const boton = screen.getByRole('button', { name: 'Ver los 6 integrantes' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(boton)
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/Familiar QA 5/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver menos integrantes' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('muestra el estado registrado sin integrantes', () => {
    render(<ResumenFamilia familiares={[]} />)
    expect(screen.getByText('Registrada sin integrantes.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

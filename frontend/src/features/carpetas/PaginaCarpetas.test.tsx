import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montarApp } from '../../test/montarApp'

/** FE-39 · Listado y búsqueda de carpetas (criterios de FE-16 que tocan la interfaz). */
describe('PaginaCarpetas', () => {
  const resultados = async () => within((await screen.findAllByRole('list')).at(-1)!)
  const buscar = async (usuario: Awaited<ReturnType<typeof montarApp>>['usuario'], texto: string) => {
    const campo = screen.getByLabelText('Buscar por nombre o número de carpeta')
    await usuario.clear(campo)
    if (texto) await usuario.type(campo, texto)
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))
  }

  it('lista las carpetas paginadas de 10 en 10', async () => {
    const { usuario } = await montarApp('/carpetas')
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect((await resultados()).getAllByRole('link')).toHaveLength(10)
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
    expect((await resultados()).getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('busca por nombre, sin importar tildes ni mayúsculas', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await buscar(usuario, 'gutierrez')
    expect(await screen.findByText('2 resultados para «gutierrez»')).toBeInTheDocument()
  })

  it('buscar un número exacto localiza su carpeta', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await buscar(usuario, '9')
    expect(await screen.findByText('1 resultado para «9»')).toBeInTheDocument()
    expect((await resultados()).getByText('Paola Gutiérrez Mendoza')).toBeInTheDocument()
  })

  it('una búsqueda sin coincidencias muestra un mensaje claro', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await buscar(usuario, 'Nadie Existe')
    expect(await screen.findByText('No encontramos carpetas para «Nadie Existe»')).toBeInTheDocument()
  })

  it('una terapeuta solo ve sus carpetas asignadas', async () => {
    await montarApp('/carpetas', 'carla')
    expect(await screen.findByRole('heading', { name: 'Mis carpetas' })).toBeInTheDocument()
    expect(await screen.findByText('5 carpetas')).toBeInTheDocument()
    expect(screen.queryByText('Mariana Gutiérrez Paz')).not.toBeInTheDocument() // es de Sofía
    expect(screen.queryByRole('link', { name: 'Registrar paciente' })).not.toBeInTheDocument()
  })

  it('una terapeuta no encuentra por número una carpeta ajena', async () => {
    const { usuario } = await montarApp('/carpetas', 'carla')
    await screen.findByText('5 carpetas')
    await buscar(usuario, 'Mariana')
    expect(await screen.findByText('No encontramos carpetas para «Mariana»')).toBeInTheDocument()
  })

  it('abrir un resultado muestra el resumen de esa carpeta', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await usuario.click((await resultados()).getByRole('link', { name: /Paola Gutiérrez Mendoza/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Paola Gutiérrez Mendoza' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
  })
})

import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { llamadas, montarApp } from '../../test/montarApp'

/** FE-39 · Listado y búsqueda con GET /api/casos (criterios de FE-16 que tocan la interfaz). */
describe('PaginaCarpetas', () => {
  const resultados = async () => within((await screen.findAllByRole('list')).at(-1)!)
  const buscar = async (usuario: Awaited<ReturnType<typeof montarApp>>['usuario'], texto: string) => {
    const campo = screen.getByLabelText('Buscar por nombre del paciente')
    await usuario.clear(campo)
    if (texto) await usuario.type(campo, texto)
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))
  }

  it('lista las carpetas paginadas de 10 en 10 con limite/desplazamiento', async () => {
    const { usuario, fetchEspia } = await montarApp('/carpetas')
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
    expect((await resultados()).getAllByRole('link')).toHaveLength(10)
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
    expect((await resultados()).getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()

    const urls = llamadas(fetchEspia, 'GET', '/api/casos').map(([url]) => String(url))
    expect(urls.at(-1)).toContain('limite=10&desplazamiento=10')
  })

  it('busca por parte del nombre, sin importar mayúsculas', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await buscar(usuario, 'GUTIÉRREZ')
    expect(await screen.findByText('2 resultados para «GUTIÉRREZ»')).toBeInTheDocument()
  })

  it('filtra por tipo y estado', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'derivado')
    expect(await screen.findByText('5 carpetas')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'iniciado')
    expect(await screen.findByText('3 carpetas')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(await screen.findByText('14 carpetas')).toBeInTheDocument()
  })

  it('una búsqueda sin coincidencias muestra un mensaje claro', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await buscar(usuario, 'Nadie Existe')
    expect(await screen.findByText('No encontramos carpetas para «Nadie Existe»')).toBeInTheDocument()
  })

  it('una terapeuta ve un aviso mientras el backend no le da acceso (FE-37)', async () => {
    await montarApp('/carpetas', 'carla')
    expect(await screen.findByRole('heading', { name: 'Mis carpetas' })).toBeInTheDocument()
    expect(await screen.findByText(/Pronto verás aquí las carpetas/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar paciente' })).not.toBeInTheDocument()
  })

  it('abrir un resultado muestra el resumen de esa carpeta', async () => {
    const { usuario } = await montarApp('/carpetas')
    await screen.findByText('14 carpetas')
    await usuario.click((await resultados()).getByRole('link', { name: /Paola Gutiérrez Mendoza/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Paola Gutiérrez Mendoza' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
  })
})

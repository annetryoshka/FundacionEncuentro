import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CARPETA_DE_SOFIA, llamadas, montarApp } from '../../test/montarApp'
import * as archivos from '../../utilidades/archivos'
import { consultaSeleccion } from './investigacion'

/**
 * FE-170 · Categorización y exportación para Atlas.ti (FE-167, API FE-169). Datos simulados: COM-FAM (asignada a la
 * carpeta de Sofía), LIM y una categoría inactiva.
 */
describe('Investigación', () => {
  it('administración crea una categoría; la terapeuta ve el catálogo sin poder editarlo', async () => {
    const { usuario, fetchEspia } = await montarApp('/investigacion')
    expect(await screen.findByText('Comunicación familiar')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Nueva categoría' }))
    await usuario.type(screen.getByLabelText('Código'), 'ape-emo')
    await usuario.type(screen.getByLabelText('Nombre'), 'Apego emocional')
    await usuario.click(screen.getByRole('button', { name: 'Guardar categoría' }))
    expect(await screen.findByText('Categoría creada.')).toBeInTheDocument()
    expect(await screen.findByText('APE-EMO', { selector: 'code' })).toBeInTheDocument()
    expect(
      JSON.parse(String((llamadas(fetchEspia, 'POST', '/api/investigacion/categorias')[0][1] as RequestInit).body)),
    ).toMatchObject({
      codigo: 'APE-EMO',
      nombre: 'Apego emocional',
    })
  })

  it('una terapeuta no puede crear categorías y solo ve sus casos en la selección', async () => {
    await montarApp('/investigacion', 'sofia')
    expect(await screen.findByText('Comunicación familiar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument()
    expect(await screen.findByText(/Casos \(0 de 5 elegidos\)/)).toBeInTheDocument()
  })

  it('filtra por categoría con parámetros repetidos, prepara, revisa con huella y descarga el ZIP', async () => {
    const guardar = vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario, fetchEspia } = await montarApp('/investigacion', 'sofia')
    await screen.findByText(/Casos \(0 de 5 elegidos\)/)
    await usuario.click(screen.getByRole('checkbox', { name: 'COM-FAM' }))
    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(await screen.findByText(/Casos \(0 de 1 elegidos\)/)).toBeInTheDocument()
    const url = new URL(String(llamadas(fetchEspia, 'GET', '/api/investigacion/seleccion').at(-1)![0]), 'http://x')
    expect(url.searchParams.getAll('categorias')).toEqual(['60000000-0000-4000-8000-000000000001'])

    // Sin nombres en la selección: solo número y tipo de carpeta.
    expect(screen.queryByText(/Mariana/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preparar y revisar \(0 casos\)/ })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /Preparar y revisar/ }))
    expect(screen.getByText('Elige al menos un caso.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('checkbox', { name: /Carpeta Nº 1 \(Voluntario\)/ }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Tareas' }))
    expect(screen.getByText(/las fechas de sesión quedan solo como mes/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Preparar y revisar (1 caso)' }))

    expect(await screen.findByRole('heading', { name: 'Revisar paquete para Atlas.ti' })).toBeInTheDocument()
    const doc = within(screen.getByRole('article', { name: /INV-001/ }))
    expect(doc.getByText('Entrevista inicial ficticia con la familia.')).toBeInTheDocument()
    expect(doc.getByText(/Dificultades de comunicación/)).toBeInTheDocument()
    expect(doc.getByText(/Sesión 1 · 2026-10:/)).toBeInTheDocument()
    expect(doc.queryByText(/Mariana/)).not.toBeInTheDocument()

    const confirmar = screen.getByRole('button', { name: 'Confirmar revisión' })
    expect(confirmar).toBeDisabled()
    await usuario.click(screen.getByRole('checkbox', { name: /Leí todos los documentos/ }))
    await usuario.click(confirmar)
    expect(await screen.findByText('Revisión confirmada. Ya puedes descargar el paquete.')).toBeInTheDocument()
    const patch = fetchEspia.mock.calls.find(
      ([u, i]) => /\/revision$/.test(String(u)) && (i as RequestInit)?.method === 'PATCH',
    )!
    expect(JSON.parse(String((patch[1] as RequestInit).body)).huella).toMatch(/^[0-9a-f]{64}$/)

    await usuario.click(screen.getByRole('button', { name: 'Descargar paquete (.zip)' }))
    expect(await screen.findByText(/Paquete descargado/)).toBeInTheDocument()
    expect(guardar.mock.calls[0][0].nombre).toBe('investigacion.zip')
  })

  it('si el contenido cambió entre la lectura y la confirmación, pide volver a leer', async () => {
    const { usuario, fetchEspia } = await montarApp('/investigacion', 'sofia')
    await screen.findByText(/Casos \(0 de 5 elegidos\)/)
    await usuario.click(screen.getByRole('button', { name: 'Elegir todos' }))
    await usuario.click(screen.getByRole('button', { name: /Preparar y revisar/ }))
    await screen.findByRole('heading', { name: 'Revisar paquete para Atlas.ti' })
    const simulado = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementationOnce((u, i) =>
      (i as RequestInit)?.method === 'PATCH'
        ? Promise.resolve(
            Response.json({ message: 'El contenido cambió. Revisa la vista actualizada.' }, { status: 409 }),
          )
        : simulado(u, i),
    )
    await usuario.click(screen.getByRole('checkbox', { name: /Leí todos los documentos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar revisión' }))
    expect(await screen.findByText('El contenido cambió. Revisa la vista actualizada.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Volver a leer el contenido' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Leí todos los documentos/ })).not.toBeChecked())
  })

  /** Abre la revisión de un paquete nuevo con la respuesta de GET /revision retocada. */
  async function abrirRevisionCon(cambios: { revisadoEn: string | null; revisionVigente: boolean }) {
    const montado = await montarApp('/investigacion', 'sofia')
    const simulado = montado.fetchEspia.getMockImplementation()!
    montado.fetchEspia.mockImplementation(async (u, i) => {
      // Revisión vigente de otra visita: el backend ya permite descargar.
      if (/\/descarga$/.test(String(u)) && cambios.revisionVigente)
        return new Response('PK', {
          headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="investigacion.zip"' },
        })
      const r = await simulado(u, i)
      if (!/\/revision$/.test(String(u)) || (i as RequestInit | undefined)?.method === 'PATCH') return r
      return Response.json({ ...(await r.json()), ...cambios }, { status: r.status })
    })
    await screen.findByText(/Casos \(0 de 5 elegidos\)/)
    await montado.usuario.click(screen.getByRole('button', { name: 'Elegir todos' }))
    await montado.usuario.click(screen.getByRole('button', { name: /Preparar y revisar/ }))
    await screen.findByRole('heading', { name: 'Revisar paquete para Atlas.ti' })
    return montado
  }

  it('un paquete ya revisado en otra visita se descarga sin volver a confirmar', async () => {
    const guardar = vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    const { usuario } = await abrirRevisionCon({ revisadoEn: '2026-11-20T15:00:00.000Z', revisionVigente: true })
    expect(screen.getByText('Revisado el 20 de noviembre de 2026.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar revisión' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Descargar paquete (.zip)' }))
    expect(await screen.findByText(/Paquete descargado/)).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledOnce()
  })

  it('si el contenido cambió después de revisarlo, pide preparar un paquete nuevo', async () => {
    await abrirRevisionCon({ revisadoEn: '2026-11-20T15:00:00.000Z', revisionVigente: false })
    expect(screen.getByText(/se revisó el 20 de noviembre de 2026, pero su contenido cambió/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prepara un paquete nuevo' })).toHaveAttribute('href', '/investigacion')
    expect(screen.queryByRole('button', { name: 'Confirmar revisión' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
  })

  it('asigna una categoría al diagnóstico de un caso con fragmento y nota', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/investigacion`, 'sofia')
    expect(await screen.findByText('COM-FAM', { selector: 'code' })).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Categoría'), '60000000-0000-4000-8000-000000000002')
    expect(screen.queryByRole('option', { name: /ANT/ })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: /El diagnóstico/ }))
    await usuario.type(screen.getByLabelText('Fragmento (opcional)'), 'Dificultades de comunicación')
    await usuario.click(screen.getByRole('button', { name: 'Asignar categoría' }))
    expect(await screen.findByText('Categoría asignada.')).toBeInTheDocument()
    const cuerpo = JSON.parse(
      String(
        (llamadas(fetchEspia, 'POST', `/api/investigacion/casos/${CARPETA_DE_SOFIA}/etiquetas`)[0][1] as RequestInit)
          .body,
      ),
    )
    expect(cuerpo).toMatchObject({
      categoriaId: '60000000-0000-4000-8000-000000000002',
      fragmento: 'Dificultades de comunicación',
    })
    expect(cuerpo.fichaDiagnosticoId).toBeTruthy()
    expect(await screen.findByText('LIM', { selector: 'code' })).toBeInTheDocument()

    // Repetir la misma asignación responde 409.
    await usuario.selectOptions(screen.getByLabelText('Categoría'), '60000000-0000-4000-8000-000000000002')
    await usuario.click(screen.getByRole('radio', { name: /El diagnóstico/ }))
    await usuario.click(screen.getByRole('button', { name: 'Asignar categoría' }))
    expect(await screen.findByText('Esa categoría ya está asignada en ese mismo lugar.')).toBeInTheDocument()
  })

  it('marketing no tiene investigación', async () => {
    await montarApp('/investigacion', 'apoyo')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
  })

  it('las residencias y categorías viajan como parámetros repetidos', () => {
    expect(
      consultaSeleccion({
        desde: '2026-10-01',
        hasta: '',
        residencias: ['la_paz', 'sin_registrar'],
        categorias: ['a', 'b'],
      }),
    ).toBe('?desde=2026-10-01&residencias=la_paz&residencias=sin_registrar&categorias=a&categorias=b')
    expect(consultaSeleccion({ desde: '', hasta: '', residencias: [], categorias: [] })).toBe('')
  })
})

import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fallarUnaVez, llamadas, montarApp, montarSinSesion } from '../../test/montarApp'
import { aDatos, formularioVacio, validarArticulo } from './articulos'

/**
 * FE-187 · Artículos de investigación sin comentarios (FE-182, API FE-184), con el listado y las tarjetas de
 * Gemina (FE-186). Datos de FE-185: I1 publicado, I2 borrador, I3 retirado.
 */
const I1 = '80000000-0000-4000-8000-000000000001'
const I2 = '80000000-0000-4000-8000-000000000002'
const I3 = '80000000-0000-4000-8000-000000000003'

describe('Artículos de investigación (gestión)', () => {
  const cuerpo = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia'], metodo: string, ruta: string) =>
    JSON.parse(String((llamadas(fetchEspia, metodo, ruta).at(-1)![1] as RequestInit).body))

  it('marketing los abre desde el menú y ve los tres estados', async () => {
    const { usuario } = await montarApp('/inicio', 'apoyo')
    await usuario.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Artículos' }),
    )
    expect(await screen.findByText('3 artículos')).toBeInTheDocument()
    expect(
      within(screen.getByRole('link', { name: /Artículo ficticio retirado/ })).getByText('Retirado'),
    ).toBeInTheDocument()
  })

  it('ciclo completo: crear borrador, publicar, verlo como visitante, retirar y volver a borrador', async () => {
    const { usuario, fetchEspia } = await montarApp('/articulos/nuevo', 'apoyo')
    await usuario.type(screen.getByLabelText('Título'), 'Vínculos familiares (ficticio)')
    await usuario.type(screen.getByLabelText('Contenido'), 'Texto ficticio del artículo, sin datos de pacientes.')
    await usuario.type(screen.getByLabelText('Autor visible (opcional)'), 'Equipo QA')
    const vista = within(screen.getByRole('complementary', { name: 'Vista previa' }))
    expect(vista.getByText('Vínculos familiares (ficticio)')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText(/Artículo guardado como borrador/)).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', '/api/investigaciones/articulos')).toEqual({
      titulo: 'Vínculos familiares (ficticio)',
      resumen: null,
      contenido: 'Texto ficticio del artículo, sin datos de pacientes.',
      autorVisible: 'Equipo QA',
    })

    // Publicar sin resumen → 422: se enfoca el resumen.
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Para publicar falta: Resumen.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Resumen')).toHaveFocus())
    await usuario.type(screen.getByLabelText('Resumen'), 'Resumen ficticio.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Cambios guardados.')
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Publicado: ya se ve en «Investigaciones» del portal.')).toBeInTheDocument()
    // Ya publicado: no se ofrece eliminar.
    expect(screen.queryByRole('button', { name: 'Eliminar borrador' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Retirar del portal' }))
    expect(await screen.findByText('Retirado del portal.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Volver a borrador' }))
    expect(await screen.findByText('Volvió a borrador.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar borrador' })).not.toBeInTheDocument()
  })

  it('un borrador que nunca se publicó se elimina con confirmación', async () => {
    const { usuario, fetchEspia } = await montarApp(`/articulos/${I2}`, 'apoyo')
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar borrador' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toHaveFocus())
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByText('2 artículos')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'DELETE', `/api/investigaciones/articulos/${I2}`)).toHaveLength(1)
  })

  it('con cambios sin guardar no se cambia el estado; un fallo conserva lo escrito', async () => {
    const { usuario, fetchEspia } = await montarApp(`/articulos/${I3}`, 'apoyo')
    await usuario.type(await screen.findByLabelText('Título'), ' (editado)')
    expect(screen.getByRole('button', { name: 'Volver a borrador' })).toBeDisabled()
    fallarUnaVez(fetchEspia, 'PUT', `/api/investigaciones/articulos/${I3}`, 'red')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/No se guardó/)).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('[DEMO QA] Artículo ficticio retirado (editado)')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Cambios guardados.')
    expect(cuerpo(fetchEspia, 'PUT', `/api/investigaciones/articulos/${I3}`)).not.toHaveProperty('imagen')
  })

  it('la portada se sube como archivo, exige descripción, se ve en la vista previa y editar el artículo la conserva', async () => {
    const { usuario, fetchEspia } = await montarApp(`/articulos/${I2}`, 'apoyo')
    await screen.findByRole('heading', { name: 'Imagen de portada' })
    const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(500).fill(0)])], 'portada.jpg', {
      type: 'image/jpeg',
    })
    await usuario.upload(screen.getByLabelText('Elegir imagen'), jpg)
    await usuario.click(screen.getByRole('button', { name: 'Guardar imagen' }))
    expect(screen.getByText('Describe la imagen en una frase.')).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Describe la imagen en una frase'), 'Portada ficticia')
    await usuario.click(screen.getByRole('button', { name: 'Guardar imagen' }))
    expect(await screen.findByText('Imagen guardada. Se verá en el portal al publicar.')).toBeInTheDocument()
    const enviado = (
      llamadas(fetchEspia, 'PUT', `/api/investigaciones/articulos/${I2}/imagen`).at(-1)![1] as RequestInit
    ).body as FormData
    expect((enviado.get('archivo') as File).name).toBe('portada.jpg')
    expect(enviado.get('textoAlternativo')).toBe('Portada ficticia')
    const vista = within(screen.getByRole('complementary', { name: 'Vista previa' }))
    expect(vista.getByRole('img', { name: 'Portada ficticia' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))

    await usuario.type(screen.getByLabelText('Título'), ' (editado)')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Cambios guardados.')
    expect(screen.getByRole('button', { name: 'Editar descripción' })).toBeInTheDocument()
    expect(vista.getByRole('img', { name: 'Portada ficticia' })).toBeInTheDocument()
  })

  it('una terapeuta no tiene artículos', async () => {
    const { fetchEspia } = await montarApp('/articulos', 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/investigaciones/articulos')).toHaveLength(0)
  })

  it('reglas del formulario', () => {
    const base = { ...formularioVacio(), titulo: 'T', contenido: 'C' }
    expect(validarArticulo(base)).toEqual({})
    expect(validarArticulo({ ...base, contenido: '   ' }).contenido).toBeTruthy()
    // La imagen no viaja en el formulario: se sube aparte.
    expect(aDatos({ ...base, resumen: '  ', autorVisible: '' })).toEqual({
      titulo: 'T',
      resumen: null,
      contenido: 'C',
      autorVisible: null,
    })
  })
})

describe('Investigaciones en el portal público', () => {
  it('sin sesión lista solo lo publicado con las tarjetas de Gemina, y abre el detalle', async () => {
    const { usuario, fetchEspia } = montarSinSesion('/investigaciones')
    expect(await screen.findByRole('heading', { name: '[DEMO QA] Artículo ficticio publicado' })).toBeInTheDocument()
    expect(screen.queryByText(/en borrador/)).not.toBeInTheDocument()
    expect(screen.queryByText(/retirado/)).not.toBeInTheDocument()
    expect(screen.getByText(/Por Autor ficticio · Publicado el/)).toBeInTheDocument()
    const [, init] = llamadas(fetchEspia, 'GET', '/api/publico/investigaciones')[0]
    expect(new Headers((init as RequestInit).headers).has('Authorization')).toBe(false)

    await usuario.click(screen.getByRole('link', { name: '[DEMO QA] Artículo ficticio publicado' }))
    expect(
      await screen.findByText('Texto de ejemplo sin datos de pacientes ni conclusiones clínicas.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // sin comentarios
  })

  it('borrador, retirado o id inválido se ven como «no disponible»', async () => {
    for (const id of [I2, I3, 'x']) {
      montarSinSesion(`/investigaciones/${id}`)
      expect(await screen.findByRole('heading', { name: 'Esta investigación no está disponible' })).toBeInTheDocument()
      document.body.replaceChildren()
    }
  })

  it('el portal enlaza Investigaciones y un fallo de carga se muestra como error', async () => {
    const { usuario, fetchEspia } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { name: /Campañas, actividades y cursos/ })
    fallarUnaVez(fetchEspia, 'GET', '/api/publico/investigaciones', 500)
    await usuario.click(screen.getAllByRole('link', { name: 'Investigaciones' })[0])
    expect(await screen.findByText(/No se pudieron cargar las investigaciones/)).toBeInTheDocument()
    expect(screen.queryByText(/no hay investigaciones publicadas/)).not.toBeInTheDocument()
    expect(I1).toBeTruthy()
  })
})

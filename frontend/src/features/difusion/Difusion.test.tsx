import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  PUBLICACION_BORRADOR,
  PUBLICACION_CAMPANA,
  PUBLICACION_RETIRADA,
  PUBLICACION_SIN_RESUMEN,
  fallarUnaVez,
  llamadas,
  montarApp,
  montarSinSesion,
} from '../../test/montarApp'
import { aPublica, urlImagenDifusion, validarPublicacion, formularioVacio } from './difusion'

/**
 * FE-144 · Panel de publicaciones (API FE-143). Datos de demostración de FE-141: C1 y K1 publicadas, A1 y X1 en
 * borrador (X1 sin resumen) y R1 retirada.
 */
describe('Panel de difusión', () => {
  const cuerpo = (fetchEspia: Awaited<ReturnType<typeof montarApp>>['fetchEspia'], metodo: string, ruta: string) =>
    JSON.parse(String((llamadas(fetchEspia, metodo, ruta).at(-1)![1] as RequestInit).body))

  it('marketing entra a Difusión desde el menú y ve todas las publicaciones con su estado', async () => {
    const { usuario } = await montarApp('/inicio', 'apoyo')
    await usuario.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Difusión' }),
    )
    expect(await screen.findByText('5 publicaciones')).toBeInTheDocument()
    const fila = screen.getByRole('link', { name: /Campaña ficticia retirada/ })
    expect(within(fila).getByText('Retirada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Carpetas' })).not.toBeInTheDocument()
  })

  it('filtra por estado en la URL', async () => {
    const { usuario, fetchEspia } = await montarApp('/difusion', 'apoyo')
    await screen.findByText('5 publicaciones')
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'borrador')
    expect(await screen.findByText('2 publicaciones')).toBeInTheDocument()
    const url = new URL(String(llamadas(fetchEspia, 'GET', '/api/difusion/publicaciones').at(-1)![0]), 'http://x')
    expect(url.searchParams.get('estado')).toBe('borrador')
  })

  it('ciclo completo: crear borrador, publicar, verlo en el portal, retirarlo y volver a borrador', async () => {
    const { usuario, fetchEspia } = await montarApp('/difusion/nueva', 'apoyo')
    await usuario.click(screen.getByRole('radio', { name: 'Curso' }))
    await usuario.type(screen.getByLabelText('Título'), 'Taller ficticio de crianza')
    await usuario.type(screen.getByLabelText('Resumen'), 'Resumen ficticio del taller.')
    await usuario.type(screen.getByLabelText('Fecha de inicio'), '2026-12-10')
    // La vista previa refleja lo escrito antes de guardar.
    const vista = within(screen.getByRole('complementary', { name: 'Vista previa' }))
    expect(vista.getByText('Taller ficticio de crianza')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText(/Publicación guardada como borrador/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Taller ficticio de crianza', level: 1 })).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', '/api/difusion/publicaciones')).toEqual({
      tipo: 'curso',
      titulo: 'Taller ficticio de crianza',
      resumen: 'Resumen ficticio del taller.',
      contenido: null,
      fechaInicio: '2026-12-10',
      fechaFin: null,
      modalidad: null,
      lugar: null,
      contactoUrl: null,
    })

    await usuario.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Publicada: ya se ve en el portal.')).toBeInTheDocument()
    const enlacePortal = screen.getByRole('link', { name: 'Ver en el portal' })

    await usuario.click(screen.getByRole('button', { name: 'Retirar del portal' }))
    expect(await screen.findByText('Retirada del portal.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Volver a borrador' }))
    expect(await screen.findByText('Volvió a borrador.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
    expect(enlacePortal).not.toBeInTheDocument()
  })

  it('publicar sin resumen muestra el 422 con el campo que falta y lo enfoca', async () => {
    const { usuario } = await montarApp(`/difusion/${PUBLICACION_SIN_RESUMEN}`, 'apoyo')
    await usuario.click(await screen.findByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Para publicar falta: Resumen.')).toBeInTheDocument()
    expect(screen.getByText('Escribe un resumen para poder publicar.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Resumen')).toHaveFocus())
  })

  it('con cambios sin guardar no deja cambiar el estado; un error al guardar conserva lo escrito', async () => {
    const { usuario, fetchEspia } = await montarApp(`/difusion/${PUBLICACION_BORRADOR}`, 'apoyo')
    const titulo = await screen.findByLabelText('Título')
    await usuario.type(titulo, ' (editada)')
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
    expect(screen.getByText('Guarda los cambios antes de cambiar el estado.')).toBeInTheDocument()

    fallarUnaVez(fetchEspia, 'PUT', `/api/difusion/publicaciones/${PUBLICACION_BORRADOR}`, 'red')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/No se guardó/)).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('[DEMO QA] Actividad ficticia (editada)')

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled()
  })

  it('un 409 de transición avisa que el estado cambió y permite ver el actual', async () => {
    const { usuario, fetchEspia } = await montarApp(`/difusion/${PUBLICACION_RETIRADA}`, 'apoyo')
    fallarUnaVez(fetchEspia, 'PATCH', `/api/difusion/publicaciones/${PUBLICACION_RETIRADA}/estado`, 409)
    await usuario.click(await screen.findByRole('button', { name: 'Volver a borrador' }))
    expect(await screen.findByText('El estado de esta publicación cambió en otra sesión.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver el estado actual' }))
    expect(await screen.findByRole('button', { name: 'Volver a borrador' })).toBeInTheDocument()
  })

  it('valida fechas invertidas y enlaces que no son http(s)', () => {
    const base = { ...formularioVacio(), tipo: 'actividad' as const, titulo: 'Prueba' }
    expect(validarPublicacion({ ...base, fechaInicio: '2026-12-10', fechaFin: '2026-12-01' }).fechaFin).toMatch(
      /anterior/,
    )
    expect(validarPublicacion({ ...base, contactoUrl: 'javascript:alert(1)' }).contactoUrl).toMatch(/https/)
    expect(validarPublicacion({ ...base, contactoUrl: 'https://fundacion.test/inscripcion' })).toEqual({})
  })

  it('registra la imagen principal con su texto alternativo y la muestra en la vista previa', async () => {
    const { usuario, fetchEspia } = await montarApp(`/difusion/${PUBLICACION_CAMPANA}`, 'apoyo')
    await screen.findByRole('heading', { name: 'Imagen principal' })
    const imagen = new File([new Uint8Array(2048)], 'afiche diciembre.png', { type: 'image/png' })
    await usuario.upload(screen.getByLabelText('Imagen'), imagen)
    expect(screen.getByLabelText('Ruta en la carpeta pública')).toHaveValue('afiche-diciembre.png')
    await usuario.click(screen.getByRole('button', { name: 'Registrar imagen principal' }))
    expect(screen.getByText('Describe la imagen para quien no la ve.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Texto alternativo'), 'Afiche ficticio de la campaña')
    await usuario.click(screen.getByRole('button', { name: 'Registrar imagen principal' }))
    expect(await screen.findByText('Imagen principal registrada.')).toBeInTheDocument()
    expect(cuerpo(fetchEspia, 'POST', `/api/difusion/publicaciones/${PUBLICACION_CAMPANA}/recursos`)).toMatchObject({
      ruta: 'afiche-diciembre.png',
      tipoMime: 'image/png',
      tamanoBytes: 2048,
      textoAlternativo: 'Afiche ficticio de la campaña',
      principal: true,
    })
    const vista = within(screen.getByRole('complementary', { name: 'Vista previa' }))
    expect(vista.getByRole('img', { name: 'Afiche ficticio de la campaña' })).toHaveAttribute(
      'src',
      '/imagenes/difusion/afiche-diciembre.png',
    )
    await usuario.click(screen.getByRole('button', { name: 'Quitar imagen' }))
    expect(await screen.findByText('Imagen quitada.')).toBeInTheDocument()
  })

  it('una terapeuta no tiene Difusión y no puede abrirla', async () => {
    const { fetchEspia } = await montarApp('/difusion', 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/difusion/publicaciones')).toHaveLength(0)
  })
})

/** FE-149 · Portal público con las tarjetas de FE-148. */
describe('Portal público', () => {
  it('sin sesión muestra solo lo publicado, sin navegación clínica, y filtra por tipo', async () => {
    const { usuario, fetchEspia } = montarSinSesion('/publicaciones')
    expect(await screen.findByRole('heading', { name: '[DEMO QA] Curso ficticio' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '[DEMO QA] Campaña ficticia de sensibilización' })).toBeInTheDocument()
    expect(screen.queryByText('[DEMO QA] Actividad ficticia')).not.toBeInTheDocument()
    expect(screen.queryByText('[DEMO QA] Campaña ficticia retirada')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Carpetas' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ingreso del personal/ })).toHaveAttribute('href', '/login')
    const [, init] = llamadas(fetchEspia, 'GET', '/api/publico/publicaciones')[0]
    expect(new Headers((init as RequestInit).headers).has('Authorization')).toBe(false)

    await usuario.click(screen.getByRole('button', { name: 'Cursos' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '[DEMO QA] Campaña ficticia de sensibilización' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: '[DEMO QA] Curso ficticio' })).toBeInTheDocument()
  })

  it('el detalle muestra el contenido completo como texto', async () => {
    const { usuario } = montarSinSesion('/publicaciones')
    await usuario.click(await screen.findByRole('link', { name: '[DEMO QA] Campaña ficticia de sensibilización' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: '[DEMO QA] Campaña ficticia de sensibilización' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Contenido de ejemplo para revisar el portal. Sin datos de pacientes.')).toBeInTheDocument()
    expect(screen.getByText('1 de diciembre de 2026 al 15 de diciembre de 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Contactar o inscribirse/ })).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('un borrador, una retirada o un id inválido se ven como «no disponible», sin revelar si existen', async () => {
    for (const id of [PUBLICACION_BORRADOR, PUBLICACION_RETIRADA, 'no-es-un-id']) {
      const { unmount } = { unmount: () => document.body.replaceChildren() }
      montarSinSesion(`/publicaciones/${id}`)
      expect(await screen.findByRole('heading', { name: 'Esta publicación no está disponible' })).toBeInTheDocument()
      unmount()
    }
  })

  it('un fallo de carga se muestra como error, no como «no hay publicaciones»', async () => {
    const { usuario, fetchEspia } = montarSinSesion('/login')
    fallarUnaVez(fetchEspia, 'GET', '/api/publico/publicaciones', 500)
    await usuario.click(await screen.findByRole('link', { name: 'Ver campañas, actividades y cursos' }))
    expect(await screen.findByText(/No se pudieron cargar las publicaciones/)).toBeInTheDocument()
    expect(screen.queryByText(/no hay publicaciones/i)).not.toBeInTheDocument()
  })

  it('una ruta inexistente del portal tiene su propia página', async () => {
    montarSinSesion('/publicaciones/a/b')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })

  it('la imagen pública se resuelve desde la carpeta pública, nunca desde el almacenamiento clínico', () => {
    expect(urlImagenDifusion('campanas/x.jpg')).toBe('/imagenes/difusion/campanas/x.jpg')
    const p = aPublica({
      id: '1',
      tipo: 'curso',
      titulo: 't',
      resumen: null,
      contenido: null,
      fechaInicio: null,
      fechaFin: null,
      modalidad: null,
      lugar: null,
      contactoUrl: null,
      publicadoEn: null,
      imagen: { ruta: '/a.png', textoAlternativo: 'Afiche', ancho: null, alto: null },
    })
    expect(p.imagen).toEqual({ url: '/imagenes/difusion/a.png', textoAlternativo: 'Afiche' })
    expect(p.resumen).toBe('')
  })
})

import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARPETA_DE_SOFIA, fallarUnaVez, llamadas, montarApp } from '../../../test/montarApp'
import { validarArchivoGenograma } from './genograma'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]
const archivo = (nombre: string, bytes: number[], tipo: string) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo })

describe('FE-133 · verificación QA de la interfaz del genograma', () => {
  const ruta = `/carpetas/${CARPETA_DE_SOFIA}/genograma`
  const rutaApi = `/api/carpetas/${CARPETA_DE_SOFIA}/genograma`
  const entrada = () => screen.getByLabelText('Archivo exportado de GenoPro') as HTMLInputElement

  afterEach(() => vi.restoreAllMocks())

  it('la imagen que se muestra tiene exactamente los bytes subidos', async () => {
    const creados: Blob[] = []
    const original = URL.createObjectURL
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      creados.push(b as Blob)
      return original(b as Blob)
    })
    const { usuario } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('integridad.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })

    const mostrado = new Uint8Array(await creados.at(-1)!.arrayBuffer())
    expect([...mostrado]).toEqual(PNG)
  })

  it('el archivo se pide con el token en la cabecera, nunca en la URL', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('g.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    const imagen = await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })

    const [url, init] = llamadas(fetchEspia, 'GET', `${rutaApi}/archivo`)[0]
    expect(String(url)).not.toMatch(/token|access|bearer/i)
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toMatch(/^Bearer /)
    expect(imagen.getAttribute('src')).toMatch(/^blob:/)
    expect(imagen.getAttribute('src')).not.toContain('/api/')
  })

  it('al cerrar sesión la imagen desaparece y su URL temporal se libera', async () => {
    const liberadas = vi.spyOn(URL, 'revokeObjectURL')
    const { usuario } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('g.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    const src = (await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })).getAttribute('src')

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Genograma de/ })).not.toBeInTheDocument()
    await waitFor(() => expect(liberadas).toHaveBeenCalledWith(src))
  })

  it('administración también puede subir un JPEG', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'direccion')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('g.jpg', JPEG, 'image/jpeg'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    expect(await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', rutaApi)).toHaveLength(1)
  })

  it('marketing no llega al genograma ni descarga el archivo', async () => {
    const { fetchEspia } = await montarApp(ruta, 'apoyo')
    await waitFor(() => expect(screen.queryByText(/Cargando|Abriendo/)).not.toBeInTheDocument())
    expect(screen.queryByLabelText('Archivo exportado de GenoPro')).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', `${rutaApi}/archivo`)).toHaveLength(0)
    expect(llamadas(fetchEspia, 'PUT', rutaApi)).toHaveLength(0)
  })

  it('un corte de red al reemplazar conserva el genograma anterior', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('original.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })

    fallarUnaVez(fetchEspia, 'PUT', rutaApi, 'red')
    await usuario.upload(entrada(), archivo('nuevo.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Reemplazar genograma' }))
    await waitFor(() => expect(llamadas(fetchEspia, 'PUT', rutaApi)).toHaveLength(2))
    expect(await screen.findByRole('heading', { name: 'original.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })).toBeInTheDocument()
  })

  it('el navegador acepta PDF, PNG y JPEG y rechaza SVG, GIF y HTML antes de enviar', () => {
    expect(validarArchivoGenograma(archivo('g.pdf', [0x25, 0x50, 0x44, 0x46], 'application/pdf'))).toBeNull()
    expect(validarArchivoGenograma(archivo('g.png', PNG, 'image/png'))).toBeNull()
    expect(validarArchivoGenograma(archivo('g.jpg', JPEG, 'image/jpeg'))).toBeNull()
    for (const [nombre, tipo] of [['g.svg', 'image/svg+xml'], ['g.gif', 'image/gif'], ['g.html', 'text/html']]) {
      expect(validarArchivoGenograma(archivo(nombre, [1, 2, 3], tipo))).toMatch(/Formato no admitido/)
    }
  })
})

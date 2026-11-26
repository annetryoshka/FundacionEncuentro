import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_SIN_ASIGNAR, fallarUnaVez, llamadas, montarApp } from '../../../test/montarApp'
import { validarArchivoGenograma } from './genograma'

/** FE-132 · Visor y carga del genograma (FE-129, API FE-131). La carpeta de Sofía empieza sin genograma. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]
const PDF = [...'%PDF-1.7\n'].map((c) => c.charCodeAt(0))
const archivo = (nombre: string, bytes: number[], tipo: string) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo })

describe('Genograma', () => {
  const ruta = `/carpetas/${CARPETA_DE_SOFIA}/genograma`
  const entrada = () => screen.getByLabelText('Archivo exportado de GenoPro') as HTMLInputElement
  const elegir = (f: File) => fireEvent.change(entrada(), { target: { files: [f] } })

  it('sin genograma lo dice y ofrece subirlo', async () => {
    await montarApp(ruta, 'sofia')
    expect(await screen.findByText('Sin genograma')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir genograma' })).toBeInTheDocument()
    expect(entrada()).toHaveAttribute('accept', expect.stringContaining('.pdf'))
  })

  it('sube una imagen, la muestra tras recargar y la amplía con Esc para cerrar', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('genograma-familia.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))

    await waitFor(() => expect(screen.getByText('Genograma cargado.')).toHaveFocus())
    const [, init] = llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/genograma`)[0]
    const cuerpo = (init as RequestInit).body as FormData
    expect(cuerpo).toBeInstanceOf(FormData)
    expect((cuerpo.get('archivo') as File).name).toBe('genograma-familia.png')
    expect(new Headers((init as RequestInit).headers).has('Content-Type')).toBe(false)

    expect(screen.getByRole('heading', { name: 'genograma-familia.png' })).toBeInTheDocument()
    expect(screen.getByText(/PNG · 12 B · Cargado por Sofía Mamani \(tú\)/)).toBeInTheDocument()
    const imagen = await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })
    expect(imagen.getAttribute('src')).toMatch(/^blob:/)
    expect(llamadas(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/genograma/archivo`)).toHaveLength(1)

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Genograma de Mariana Gutiérrez Paz' })
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ampliar' })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Reemplazar genograma' })).toBeInTheDocument()
  })

  it('un PDF se muestra en un visor con título y opción de abrirlo aparte', async () => {
    const { usuario } = await montarApp(ruta)
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('genograma.pdf', PDF, 'application/pdf'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    await screen.findByText('Genograma cargado.')
    await waitFor(() =>
      expect(document.querySelector('object[type="application/pdf"]')).toHaveAttribute(
        'title',
        'Genograma de Mariana Gutiérrez Paz',
      ),
    )
    expect(screen.getByRole('link', { name: 'Abrir en pestaña nueva' })).toHaveAttribute('target', '_blank')
  })

  it('rechaza en el navegador un formato no admitido o un archivo de más de 5 MB, sin enviarlo', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    elegir(archivo('genograma.gpro', [1, 2, 3], 'application/octet-stream'))
    expect(screen.getByText('Formato no admitido. Usa PDF, PNG o JPEG.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    expect(entrada()).toHaveFocus()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/genograma`)).toHaveLength(0)

    const grande = archivo('grande.png', PNG, 'image/png')
    Object.defineProperty(grande, 'size', { value: 5 * 1024 * 1024 + 1 })
    expect(validarArchivoGenograma(grande)).toMatch(/el máximo es 5 MB/)
    expect(validarArchivoGenograma(archivo('vacio.png', [], 'image/png'))).toBe('El archivo está vacío.')
  })

  it('un reemplazo rechazado por el servidor (415, 413) conserva el genograma anterior', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('original.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })

    // Extensión .png pero el contenido no lo es: el backend lo detecta por la firma del archivo.
    await usuario.upload(entrada(), archivo('falso.png', [1, 2, 3, 4], 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Reemplazar genograma' }))
    expect(
      await screen.findByText(/no es un PDF, PNG o JPEG válido.*Se conserva el genograma anterior/),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'original.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })).toBeInTheDocument()

    fallarUnaVez(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/genograma`, 413)
    await usuario.upload(entrada(), archivo('otro.png', PNG, 'image/png'))
    await usuario.click(screen.getByRole('button', { name: 'Reemplazar genograma' }))
    expect(await screen.findByText(/supera los 5 MB/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'original.png' })).toBeInTheDocument()
  })

  it('si falla la descarga del archivo se puede reintentar sin perder los datos', async () => {
    const { usuario, fetchEspia } = await montarApp(ruta, 'sofia')
    await screen.findByText('Sin genograma')
    await usuario.upload(entrada(), archivo('original.png', PNG, 'image/png'))
    fallarUnaVez(fetchEspia, 'GET', `/api/carpetas/${CARPETA_DE_SOFIA}/genograma/archivo`, 500)
    await usuario.click(screen.getByRole('button', { name: 'Subir genograma' }))
    expect(await screen.findByText(/No se pudo abrir el archivo del genograma/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'original.png' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('img', { name: 'Genograma de Mariana Gutiérrez Paz' })).toBeInTheDocument()
  })

  it('una terapeuta sin la carpeta asignada no llega al genograma', async () => {
    const { fetchEspia } = await montarApp(`/carpetas/${CARPETA_SIN_ASIGNAR}/genograma`, 'sofia')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta carpeta' })).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', `/api/carpetas/${CARPETA_SIN_ASIGNAR}/genograma/archivo`)).toHaveLength(0)
  })
})

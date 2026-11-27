import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExportarDocumento } from './ExportarDocumento'
import * as api from './exportacion'
import * as archivos from '../../../utilidades/archivos'

describe('FE-156 · selección de genograma', () => {
  const montar = (informeVersionId?: string) => {
    const exportar = vi
      .spyOn(api, 'exportarDocumento')
      .mockResolvedValue({
        contenido: new Blob(['QA']),
        nombre: 'ficticio.docx',
        tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    vi.spyOn(archivos, 'guardarArchivo').mockImplementation(() => undefined)
    render(<ExportarDocumento carpetaId="caso-qa" numeroCarpeta={1} informeVersionId={informeVersionId} />)
    return { exportar, usuario: userEvent.setup() }
  }

  it('pide el genograma solo cuando se selecciona y lo conserva al cambiar de formato', async () => {
    const { exportar, usuario } = montar()
    expect(screen.getByRole('checkbox', { name: 'Incluir genograma familiar' })).not.toBeChecked()
    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir genograma familiar' }))
    await usuario.click(screen.getByRole('radio', { name: /Word editable/ }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar Word' }))
    await waitFor(() =>
      expect(exportar).toHaveBeenCalledWith(
        'caso-qa',
        expect.objectContaining({ formato: 'docx', incluirGenograma: true }),
      ),
    )
  })

  it('no incluye el genograma por defecto', async () => {
    const { exportar, usuario } = montar()
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(exportar).toHaveBeenCalled())
    expect(exportar.mock.calls[0][1]).not.toHaveProperty('incluirGenograma')
  })

  it('un informe revisado no permite reemplazar la selección del genograma', async () => {
    const { exportar, usuario } = montar('version-qa')
    expect(screen.queryByRole('checkbox', { name: 'Incluir genograma familiar' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() =>
      expect(exportar).toHaveBeenCalledWith('caso-qa', {
        documento: 'informe',
        formato: 'pdf',
        informeVersionId: 'version-qa',
      }),
    )
  })

  it('conserva la selección después de un fallo para reintentar', async () => {
    const { exportar, usuario } = montar()
    exportar.mockRejectedValueOnce(new Error('Fallo ficticio'))
    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir genograma familiar' }))
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(await screen.findByText(/No se exportó/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Incluir genograma familiar' })).toBeChecked()
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(await screen.findByText(/Listo: se descargó/)).toBeInTheDocument()
  })
})

import { expect, it, vi } from 'vitest';
import { ExportacionesService } from '../exportaciones.service.js';
import { generarPdf } from '../generar-pdf.js';

vi.mock('../generar-pdf.js', () => ({
  generarPdf: vi.fn(),
}));

const servicio = new ExportacionesService();
const datos = { titulo: 'Ficha ficticia', parrafos: [], filas: [] };
const errorEsperado = {
  status: 500,
  message: 'No se pudo generar el archivo de exportación. Intenta de nuevo.',
};

it('devuelve un error claro si falla el generador', async () => {
  vi.mocked(generarPdf).mockRejectedValueOnce(new Error('Fallo interno'));

  await expect(servicio.prepararDescarga('pdf', datos)).rejects.toMatchObject(
    errorEsperado,
  );
});

it('devuelve un error claro si el archivo queda vacío', async () => {
  vi.mocked(generarPdf).mockResolvedValueOnce(Buffer.alloc(0));

  await expect(servicio.prepararDescarga('pdf', datos)).rejects.toMatchObject(
    errorEsperado,
  );
});
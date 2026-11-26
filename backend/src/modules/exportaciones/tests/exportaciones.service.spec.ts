import { buffer } from 'node:stream/consumers';
import { describe, expect, it } from 'vitest';
import { ExportacionesService } from '../exportaciones.service.js';

describe('ExportacionesService', () => {
  const servicio = new ExportacionesService();
  const datos = {
    titulo: 'Ficha ficticia',
    parrafos: ['Texto de prueba'],
    filas: [{ campo: 'Caso', valor: 'Caso ficticio' }],
  };

  it.each([
    {
      formato: 'pdf',
      tipo: 'application/pdf',
      firma: Buffer.from('%PDF-'),
    },
    {
      formato: 'docx',
      tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      firma: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    },
  ] as const)('prepara la descarga en $formato', async ({ formato, tipo, firma }) => {
    const archivo = await servicio.prepararDescarga(formato, datos);
    const contenido = await buffer(archivo.getStream());

    expect(archivo.getHeaders()).toEqual({
      type: tipo,
      disposition: `attachment; filename="exportacion.${formato}"`,
      length: contenido.length,
    });
    expect(contenido.subarray(0, firma.length)).toEqual(firma);
  });
});
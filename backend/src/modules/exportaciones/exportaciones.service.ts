import { Injectable, StreamableFile } from '@nestjs/common';
import { generarDocx, type DocumentoExportable } from './generar-docx.js';
import { generarPdf } from './generar-pdf.js';

const FORMATOS = {
  pdf: {
    generar: generarPdf,
    tipo: 'application/pdf',
  },
  docx: {
    generar: generarDocx,
    tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
} as const;

export type FormatoExportacion = keyof typeof FORMATOS;

@Injectable()
export class ExportacionesService {
  async prepararDescarga(
    formato: FormatoExportacion,
    datos: DocumentoExportable,
  ): Promise<StreamableFile> {
    const { generar, tipo } = FORMATOS[formato];
    const contenido = await generar(datos);

    return new StreamableFile(contenido, {
      type: tipo,
      disposition: `attachment; filename="exportacion.${formato}"`,
      length: contenido.length,
    });
  }
}
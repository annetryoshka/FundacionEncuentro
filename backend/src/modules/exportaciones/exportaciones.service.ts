import { Injectable, StreamableFile, InternalServerErrorException } from '@nestjs/common';
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

    try {
      const contenido = await generar(datos);

      if (contenido.length === 0) {
        throw new Error('El generador devolvió un archivo vacío');
      }

      return new StreamableFile(contenido, {
        type: tipo,
        disposition: `attachment; filename="exportacion.${formato}"`,
        length: contenido.length,
      });
    } catch {
      throw new InternalServerErrorException(
        'No se pudo generar el archivo de exportación. Intenta de nuevo.',
      );
    }
  }
}
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
  async generarArchivo(
    formato: FormatoExportacion,
    datos: DocumentoExportable,
  ): Promise<Buffer> {
    try {
      const contenido = await FORMATOS[formato].generar(datos);
      if (contenido.length === 0) {
        throw new Error('El generador devolvió un archivo vacío');
      }
      return contenido;
    } catch {
      throw new InternalServerErrorException(
        'No se pudo generar el archivo de exportación. Intenta de nuevo.',
      );
    }
  }

  async prepararDescarga(
    formato: FormatoExportacion,
    datos: DocumentoExportable,
  ): Promise<StreamableFile> {
    const contenido = await this.generarArchivo(formato, datos);

    return new StreamableFile(contenido, {
      type: FORMATOS[formato].tipo,
      disposition: `attachment; filename="exportacion.${formato}"`,
      length: contenido.length,
    });
  }
}
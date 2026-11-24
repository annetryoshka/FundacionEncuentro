import PDFDocument from 'pdfkit';
import type { DocumentoExportable } from './generar-docx.js';

export function generarPdf(datos: DocumentoExportable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true});
    const fragmentos: Buffer[] = [];

    pdf.on('data', (fragmento: Buffer) => fragmentos.push(fragmento));
    pdf.once('end', () => resolve(Buffer.concat(fragmentos)));
    pdf.once('error', reject);

    pdf.font('Helvetica-Bold').fontSize(20).text(datos.titulo);
    pdf.moveDown();
    pdf.font('Helvetica').fontSize(11);

    for (const parrafo of datos.parrafos) {
      pdf.text(parrafo);
      pdf.moveDown(0.5);
    }

    for (const { campo, valor } of datos.filas) {
      pdf.text(`${campo}: ${valor}`);
      pdf.moveDown(0.25);
    }

    const { start, count } = pdf.bufferedPageRange();

    for (let i = 0; i < count; i++) {
    pdf.switchToPage(start + i);

    const { width, height, margins } = pdf.page;
    const margenInferior = margins.bottom;
    margins.bottom = 0;

    pdf
        .font('Helvetica')
        .fontSize(9)
        .text(`Página ${i + 1} de ${count}`, margins.left, height - 32, {
        width: width - margins.left - margins.right,
        align: 'right',
        });

    margins.bottom = margenInferior;
    }
    pdf.end();
  });
}
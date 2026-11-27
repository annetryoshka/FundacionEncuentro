import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { DocumentoExportable } from './generar-docx.js';
import { ESTILO_EXPORTACION } from './estilos-exportacion.js';

const fuentes = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'standard_fonts',
);

type Pdf = InstanceType<typeof PDFDocument>;

const { colores } = ESTILO_EXPORTACION;
const hex = (color: string) => `#${color}`;
const RELLENO = 6;

function anchoUtil(pdf: Pdf): number {
  return pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
}

function limiteInferior(pdf: Pdf): number {
  return pdf.page.height - pdf.page.margins.bottom;
}

/** Fondo y borde de una fila de dos celdas. */
function marco(pdf: Pdf, y: number, alto: number, anchoCampo: number, fondo?: string) {
  const x = pdf.page.margins.left;
  const total = anchoUtil(pdf);
  if (fondo) pdf.rect(x, y, total, alto).fill(hex(fondo));
  pdf.lineWidth(0.5).strokeColor(hex(colores.linea));
  pdf.rect(x, y, anchoCampo, alto).stroke();
  pdf.rect(x + anchoCampo, y, total - anchoCampo, alto).stroke();
}

function encabezadoTabla(pdf: Pdf, anchoCampo: number) {
  const x = pdf.page.margins.left;
  const y = pdf.y;
  const alto = 22;
  marco(pdf, y, alto, anchoCampo, colores.verdeOscuro);
  pdf.font('InformeNegrita').fontSize(11).fillColor(hex(colores.blanco));
  pdf.text('Campo', x + RELLENO, y + RELLENO, { width: anchoCampo - RELLENO * 2, lineBreak: false });
  pdf.text('Valor', x + anchoCampo + RELLENO, y + RELLENO, {
    width: anchoUtil(pdf) - anchoCampo - RELLENO * 2,
    lineBreak: false,
  });
  pdf.x = x;
  pdf.y = y + alto;
}

function tabla(pdf: Pdf, filas: DocumentoExportable['filas']) {
  const anchoCampo = anchoUtil(pdf) * ESTILO_EXPORTACION.anchoColumnaCampo;
  const anchoValor = anchoUtil(pdf) - anchoCampo;
  const opcionesCampo = { width: anchoCampo - RELLENO * 2 };
  const opcionesValor = { width: anchoValor - RELLENO * 2 };
  const altoDePagina = () => limiteInferior(pdf) - pdf.page.margins.top - 22;

  if (pdf.y + 48 > limiteInferior(pdf)) pdf.addPage();
  encabezadoTabla(pdf, anchoCampo);

  filas.forEach(({ campo, valor }, indice) => {
    pdf.font('InformeNegrita').fontSize(10);
    const altoCampo = pdf.heightOfString(campo, opcionesCampo);
    pdf.font('Informe').fontSize(10);
    const altoValor = pdf.heightOfString(valor, opcionesValor);
    const alto = Math.max(altoCampo, altoValor) + RELLENO * 2;
    const x = pdf.page.margins.left;

    // Un texto más largo que una página no cabe en una celda: fluye como texto con su rótulo.
    if (alto > altoDePagina()) {
      pdf.moveDown(0.5);
      pdf.font('InformeNegrita').fontSize(10).fillColor(hex(colores.verdeOscuro));
      pdf.text(campo, x, pdf.y, { width: anchoUtil(pdf) });
      pdf.font('Informe').fontSize(10).fillColor(hex(colores.texto));
      pdf.text(valor, { width: anchoUtil(pdf) });
      pdf.moveDown(0.5);
      return;
    }

    if (pdf.y + alto > limiteInferior(pdf)) {
      pdf.addPage();
      encabezadoTabla(pdf, anchoCampo);
    }

    const y = pdf.y;
    marco(pdf, y, alto, anchoCampo, indice % 2 === 1 ? colores.crema : undefined);
    pdf.font('InformeNegrita').fontSize(10).fillColor(hex(colores.texto));
    pdf.text(campo, x + RELLENO, y + RELLENO, opcionesCampo);
    pdf.font('Informe').fontSize(10);
    pdf.text(valor, x + anchoCampo + RELLENO, y + RELLENO, opcionesValor);
    pdf.x = x;
    pdf.y = y + alto;
  });
}

function paginasGenograma(pdf: Pdf, genograma: NonNullable<DocumentoExportable['genograma']>) {
  for (const [indice, pagina] of genograma.paginas.entries()) {
    pdf.addPage();
    pdf.font('InformeNegrita').fontSize(16).fillColor(hex(colores.verdeOscuro));
    pdf.text('Genograma familiar');
    pdf.font('Informe').fontSize(10).fillColor(hex(colores.texto));
    pdf.text(`${genograma.nombre} · ${indice + 1} de ${genograma.paginas.length}`);
    const y = pdf.y + 12;
    pdf.image(pagina.contenido, pdf.page.margins.left, y, {
      fit: [anchoUtil(pdf), limiteInferior(pdf) - y],
      align: 'center',
      valign: 'center',
    });
  }
}

/** Encabezado institucional y número en cada página, una vez conocido el total. */
function encabezadoYPie(pdf: Pdf) {
  const { start, count } = pdf.bufferedPageRange();

  for (let i = 0; i < count; i++) {
    pdf.switchToPage(start + i);

    const { width, height, margins } = pdf.page;
    const margenInferior = margins.bottom;
    margins.bottom = 0;
    const ancho = width - margins.left - margins.right;

    pdf.font('InformeNegrita').fontSize(11).fillColor(hex(colores.verdeOscuro));
    pdf.text(ESTILO_EXPORTACION.institucion, margins.left, 32, { lineBreak: false });
    pdf.font('Informe').fontSize(9).fillColor(hex(colores.suave));
    pdf.text(ESTILO_EXPORTACION.aviso, margins.left, 34, { width: ancho, align: 'right' });
    pdf
      .lineWidth(1.5)
      .strokeColor(hex(colores.naranja))
      .moveTo(margins.left, 52)
      .lineTo(width - margins.right, 52)
      .stroke();

    pdf
      .font('Informe')
      .fontSize(9)
      .fillColor(hex(colores.suave))
      .text(`Página ${i + 1} de ${count}`, margins.left, height - 32, {
        width: ancho,
        align: 'right',
      });

    margins.bottom = margenInferior;
  }
}

export function generarPdf(datos: DocumentoExportable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 56, left: 56, right: 56 },
      bufferPages: true,
    });
    const fragmentos: Buffer[] = [];

    pdf.on('data', (fragmento: Buffer) => fragmentos.push(fragmento));
    pdf.once('end', () => resolve(Buffer.concat(fragmentos)));
    pdf.once('error', reject);

    // Incrustar la fuente evita sustituciones y letras superpuestas al imprimir/abrir en otro equipo.
    pdf.registerFont('Informe', join(fuentes, 'LiberationSans-Regular.ttf'));
    pdf.registerFont('InformeNegrita', join(fuentes, 'LiberationSans-Bold.ttf'));

    pdf.font('InformeNegrita').fontSize(20).fillColor(hex(colores.verdeOscuro)).text(datos.titulo);
    pdf.moveDown();
    pdf.font('Informe').fontSize(11).fillColor(hex(colores.texto));

    for (const parrafo of datos.parrafos) {
      pdf.font('Informe').fontSize(11).text(parrafo, { lineGap: 2 });
      pdf.moveDown(0.5);
    }

    if (datos.filas.length > 0) tabla(pdf, datos.filas);
    if (datos.genograma) paginasGenograma(pdf, datos.genograma);

    encabezadoYPie(pdf);
    pdf.end();
  });
}

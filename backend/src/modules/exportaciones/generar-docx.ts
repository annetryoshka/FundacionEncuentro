import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { ESTILO_EXPORTACION, lineas } from './estilos-exportacion.js';

export type DocumentoExportable = {
  titulo: string;
  parrafos: readonly string[];
  filas: readonly { campo: string; valor: string }[];
  genograma?: { nombre: string; paginas: readonly PaginaGenograma[] };
};

export type PaginaGenograma = {
  contenido: Buffer;
  ancho: number;
  alto: number;
};

const { colores } = ESTILO_EXPORTACION;
// A4 con márgenes de 2 cm: ancho útil en twips.
const MARGEN = 1134;
const ANCHO_UTIL = 11906 - MARGEN * 2;
const ANCHO_CAMPO = Math.round(ANCHO_UTIL * ESTILO_EXPORTACION.anchoColumnaCampo);
const ANCHO_VALOR = ANCHO_UTIL - ANCHO_CAMPO;

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: colores.linea };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

function celda(
  texto: string,
  ancho: number,
  opciones: { fondo?: string; color?: string; negrita?: boolean } = {},
): TableCell {
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    borders: BORDES,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: opciones.fondo
      ? { fill: opciones.fondo, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    children: lineas(texto).map(
      (linea) =>
        new Paragraph({
          children: [new TextRun({ text: linea, bold: opciones.negrita, color: opciones.color })],
        }),
    ),
  });
}

function tabla(filas: DocumentoExportable['filas']): Table {
  const encabezado = { fondo: colores.verdeOscuro, color: colores.blanco, negrita: true };
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [ANCHO_CAMPO, ANCHO_VALOR],
    rows: [
      new TableRow({
        // Se repite al pasar de página.
        tableHeader: true,
        children: [celda('Campo', ANCHO_CAMPO, encabezado), celda('Valor', ANCHO_VALOR, encabezado)],
      }),
      ...filas.map(({ campo, valor }, indice) => {
        const fondo = indice % 2 === 1 ? colores.crema : undefined;
        return new TableRow({
          children: [
            celda(campo, ANCHO_CAMPO, { fondo, negrita: true }),
            celda(valor, ANCHO_VALOR, { fondo }),
          ],
        });
      }),
    ],
  });
}

function paginasGenograma(genograma: NonNullable<DocumentoExportable['genograma']>): Paragraph[] {
  return genograma.paginas.flatMap((pagina, indice) => {
    // Las dimensiones de ImageRun son píxeles a 96 ppp. Cabe dentro del área útil de A4.
    const escala = Math.min(640 / pagina.ancho, 820 / pagina.alto, 1);
    return [
      new Paragraph({
        text: 'Genograma familiar',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      new Paragraph(`${genograma.nombre} · ${indice + 1} de ${genograma.paginas.length}`),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: pagina.contenido,
            transformation: {
              width: Math.round(pagina.ancho * escala),
              height: Math.round(pagina.alto * escala),
            },
            altText: {
              title: 'Genograma familiar',
              description: `Página ${indice + 1}`,
              name: 'Genograma',
            },
          }),
        ],
      }),
    ];
  });
}

export function generarDocx(datos: DocumentoExportable): Promise<Buffer> {
  const documento = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: colores.texto } },
        title: { run: { size: 40, bold: true, color: colores.verdeOscuro } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: colores.naranja } },
                children: [
                  new TextRun({
                    text: ESTILO_EXPORTACION.institucion,
                    bold: true,
                    color: colores.verdeOscuro,
                  }),
                  new TextRun({
                    text: `  ·  ${ESTILO_EXPORTACION.aviso}`,
                    size: 18,
                    color: colores.suave,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    size: 18,
                    color: colores.suave,
                    children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: datos.titulo,
            heading: HeadingLevel.TITLE,
            spacing: { after: 240 },
          }),
          ...datos.parrafos.flatMap((texto) =>
            lineas(texto).map(
              (linea) => new Paragraph({ text: linea, spacing: { after: 120, line: 288 } }),
            ),
          ),
          ...(datos.filas.length > 0 ? [tabla(datos.filas)] : []),
          ...(datos.genograma ? paginasGenograma(datos.genograma) : []),
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}

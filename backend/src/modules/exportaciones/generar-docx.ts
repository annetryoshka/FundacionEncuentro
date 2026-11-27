import {
  Document,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
} from "docx";

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

export function generarDocx(datos: DocumentoExportable): Promise<Buffer> {
  const documento = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 960, right: 960, bottom: 960, left: 960 },
          },
        },
        children: [
          new Paragraph({ text: datos.titulo, heading: HeadingLevel.TITLE }),
          ...datos.parrafos.map((texto) => new Paragraph(texto)),
          new Table({
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ children: [new Paragraph("Campo")] }),
                  new TableCell({ children: [new Paragraph("Valor")] }),
                ],
              }),
              ...datos.filas.map(
                ({ campo, valor }) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(campo)] }),
                      new TableCell({ children: [new Paragraph(valor)] }),
                    ],
                  }),
              ),
            ],
          }),
          ...(datos.genograma?.paginas.flatMap((pagina, indice) => {
            // Las dimensiones de ImageRun son píxeles a 96 ppp. Cabe dentro de A4.
            const escala = Math.min(660 / pagina.ancho, 850 / pagina.alto, 1);
            return [
              new Paragraph({
                text: "Genograma familiar",
                heading: HeadingLevel.HEADING_1,
                pageBreakBefore: true,
              }),
              new Paragraph(
                `${datos.genograma!.nombre} · ${indice + 1} de ${datos.genograma!.paginas.length}`,
              ),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: "png",
                    data: pagina.contenido,
                    transformation: {
                      width: Math.round(pagina.ancho * escala),
                      height: Math.round(pagina.alto * escala),
                    },
                    altText: {
                      title: "Genograma familiar",
                      description: `Página ${indice + 1}`,
                      name: "Genograma",
                    },
                  }),
                ],
              }),
            ];
          }) ?? []),
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}

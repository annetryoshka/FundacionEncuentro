import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
} from 'docx';

export type DocumentoExportable = {
  titulo: string;
  parrafos: readonly string[];
  filas: readonly { campo: string; valor: string }[];
};

export function generarDocx(datos: DocumentoExportable): Promise<Buffer> {
  const documento = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: datos.titulo, heading: HeadingLevel.TITLE }),
          ...datos.parrafos.map((texto) => new Paragraph(texto)),
          new Table({
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ children: [new Paragraph('Campo')] }),
                  new TableCell({ children: [new Paragraph('Valor')] }),
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
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}
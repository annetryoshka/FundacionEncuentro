import PDFDocument from "pdfkit";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { DocumentoExportable } from "./generar-docx.js";

const fuentes = join(
  dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
  "standard_fonts",
);

export function generarPdf(datos: DocumentoExportable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const fragmentos: Buffer[] = [];

    pdf.on("data", (fragmento: Buffer) => fragmentos.push(fragmento));
    pdf.once("end", () => resolve(Buffer.concat(fragmentos)));
    pdf.once("error", reject);

    // Incrustar la fuente evita sustituciones y letras superpuestas al imprimir/abrir en otro equipo.
    pdf.registerFont("Informe", join(fuentes, "LiberationSans-Regular.ttf"));
    pdf.registerFont(
      "InformeNegrita",
      join(fuentes, "LiberationSans-Bold.ttf"),
    );
    pdf.font("InformeNegrita").fontSize(20).text(datos.titulo);
    pdf.moveDown();
    pdf.font("Informe").fontSize(11);

    for (const parrafo of datos.parrafos) {
      pdf.text(parrafo);
      pdf.moveDown(0.5);
    }

    for (const { campo, valor } of datos.filas) {
      pdf.text(`${campo}: ${valor}`);
      pdf.moveDown(0.25);
    }

    for (const [indice, pagina] of (datos.genograma?.paginas ?? []).entries()) {
      pdf.addPage();
      pdf.font("InformeNegrita").fontSize(16).text("Genograma familiar");
      pdf
        .font("Informe")
        .fontSize(10)
        .text(
          `${datos.genograma!.nombre} · ${indice + 1} de ${datos.genograma!.paginas.length}`,
        );
      const y = pdf.y + 12;
      pdf.image(pagina.contenido, pdf.page.margins.left, y, {
        fit: [pdf.page.width - 96, pdf.page.height - y - 56],
        align: "center",
        valign: "center",
      });
    }

    const { start, count } = pdf.bufferedPageRange();

    for (let i = 0; i < count; i++) {
      pdf.switchToPage(start + i);

      const { width, height, margins } = pdf.page;
      const margenInferior = margins.bottom;
      margins.bottom = 0;

      pdf
        .font("Informe")
        .fontSize(9)
        .text(`Página ${i + 1} de ${count}`, margins.left, height - 32, {
          width: width - margins.left - margins.right,
          align: "right",
        });

      margins.bottom = margenInferior;
    }
    pdf.end();
  });
}

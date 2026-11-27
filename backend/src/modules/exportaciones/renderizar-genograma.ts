import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { PaginaGenograma } from "./generar-docx.js";

const MAX_PAGINAS = 20;
const MAX_PIXELES_IMAGEN = 25_000_000;
const MAX_LADO = 3000;

/** Convierte la representación visual a PNG, manteniendo proporción y todas sus páginas. */
export async function renderizarGenograma(
  contenido: Buffer,
  tipo: string,
): Promise<PaginaGenograma[]> {
  if (tipo === "image/png" || tipo === "image/jpeg") {
    const imagen = await loadImage(contenido);
    if (
      !imagen.width ||
      !imagen.height ||
      imagen.width * imagen.height > MAX_PIXELES_IMAGEN
    ) {
      throw new Error("Dimensiones del genograma no admitidas");
    }
    const escala = Math.min(
      1,
      MAX_LADO / Math.max(imagen.width, imagen.height),
    );
    const canvas = createCanvas(
      Math.round(imagen.width * escala),
      Math.round(imagen.height * escala),
    );
    canvas
      .getContext("2d")
      .drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return [
      {
        contenido: canvas.toBuffer("image/png"),
        ancho: canvas.width,
        alto: canvas.height,
      },
    ];
  }
  if (tipo !== "application/pdf")
    throw new Error("Formato de genograma no admitido");

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const raizPdfjs = dirname(
    createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
  );
  // pdf.js exige que estas rutas terminen en "/"; en Windows join() la convierte en "\".
  const carpeta = (nombre: string) => `${join(raizPdfjs, nombre)}/`;
  const tarea = getDocument({
    data: new Uint8Array(contenido),
    useSystemFonts: false,
    standardFontDataUrl: carpeta("standard_fonts"),
    cMapUrl: carpeta("cmaps"),
    cMapPacked: true,
    wasmUrl: carpeta("wasm"),
  });
  try {
    const documento = await tarea.promise;
    if (documento.numPages > MAX_PAGINAS)
      throw new Error("El genograma supera 20 páginas");
    const paginas: PaginaGenograma[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const base = pagina.getViewport({ scale: 1 });
      const escala = Math.min(2, MAX_LADO / Math.max(base.width, base.height));
      const vista = pagina.getViewport({ scale: escala });
      if (!(vista.width > 0 && vista.height > 0))
        throw new Error("Página de genograma inválida");
      const canvas = createCanvas(
        Math.ceil(vista.width),
        Math.ceil(vista.height),
      );
      try {
        await pagina.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport: vista,
          background: "#ffffff",
        }).promise;
        paginas.push({
          contenido: canvas.toBuffer("image/png"),
          ancho: canvas.width,
          alto: canvas.height,
        });
      } finally {
        pagina.cleanup();
        canvas.width = 1;
        canvas.height = 1;
      }
    }
    return paginas;
  } finally {
    await tarea.destroy();
  }
}

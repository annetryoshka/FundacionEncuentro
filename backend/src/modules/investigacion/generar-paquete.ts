import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import JSZip from 'jszip';

export type DocumentoInvestigacion = {
  idExportacion: string;
  archivo: string;
  categorias: {
    codigo: string;
    nombre: string;
    ambito: string;
    nroSesion: number | null;
    fragmento: string | null;
    nota: string | null;
  }[];
  diagnostico?: {
    evaluacionInicial?: string | null;
    origen: string;
    diagnosticoIngreso: string | null;
    hipotesisRelacional: string | null;
    comentariosClinicos: string | null;
  } | null;
  seguimiento?: {
    nroSesion: number;
    mes: string;
    evolucion: string | null;
    tareas?: { descripcion: string; completada: boolean }[];
  }[];
};

function lineasDocumento(doc: DocumentoInvestigacion): string[] {
  const lineas = ['Categorías'];
  for (const categoria of doc.categorias) {
    const destino = categoria.nroSesion === null
      ? categoria.ambito
      : `sesión ${categoria.nroSesion}`;

    lineas.push(`${categoria.codigo} · ${categoria.nombre} (${destino})`);
    if (categoria.fragmento) lineas.push(`Fragmento: ${categoria.fragmento}`);
    if (categoria.nota) lineas.push(`Nota: ${categoria.nota}`);
  }

  if (doc.diagnostico !== undefined) {
    const diagnostico = doc.diagnostico;
    lineas.push('', 'Diagnóstico');
    lineas.push(`Origen: ${diagnostico?.origen ?? 'sin datos'}`);
    if (diagnostico?.evaluacionInicial !== undefined) {
      lineas.push(`Evaluación inicial: ${diagnostico.evaluacionInicial ?? 'Sin registro'}`);
    }
    lineas.push(`Diagnóstico de ingreso: ${diagnostico?.diagnosticoIngreso ?? 'Sin registro'}`);
    lineas.push(`Hipótesis relacional: ${diagnostico?.hipotesisRelacional ?? 'Sin registro'}`);
    lineas.push(`Comentarios clínicos: ${diagnostico?.comentariosClinicos ?? 'Sin registro'}`);
  }

  if (doc.seguimiento !== undefined) {
    lineas.push('', 'Seguimiento');
    for (const sesion of doc.seguimiento) {
      lineas.push(`Sesión ${sesion.nroSesion} · ${sesion.mes}`);
      lineas.push(sesion.evolucion ?? 'Sin evolución registrada');
      for (const tarea of sesion.tareas ?? []) {
        lineas.push(`Tarea: ${tarea.descripcion} (${tarea.completada ? 'completada' : 'pendiente'})`);
      }
    }
  }

  return lineas;
}

export async function generarPaqueteInvestigacion(
  manifiesto: Record<string, unknown>,
  documentos: DocumentoInvestigacion[],
): Promise<Buffer> {
  const formato = manifiesto.formato;
  if (formato !== 'txt' && formato !== 'docx') {
    throw new Error('Formato de paquete no válido');
  }

  const zip = new JSZip();
  zip.file('manifiesto.json', JSON.stringify(manifiesto, null, 2));

  for (const doc of documentos) {
    if (!/^INV-\d{3,}$/.test(doc.idExportacion) ||
        doc.archivo !== `${doc.idExportacion}.${formato}`) {
      throw new Error('Nombre de documento no válido');
    }

    const lineas = lineasDocumento(doc);
    if (formato === 'txt') {
      zip.file(doc.archivo, [doc.idExportacion, '', ...lineas].join('\n'));
    } else {
      const word = new Document({
        sections: [{
          children: [
            new Paragraph({ text: doc.idExportacion, heading: HeadingLevel.TITLE }),
            ...lineas.flatMap((linea) =>
              linea.split(/\r?\n/).map((texto) => new Paragraph(texto)),
            ),
          ],
        }],
      });

      zip.file(doc.archivo, await Packer.toBuffer(word));
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
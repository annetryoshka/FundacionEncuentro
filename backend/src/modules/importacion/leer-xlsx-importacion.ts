import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

const COLUMNAS_FECHA = new Set([
  'fechaNacimiento', 'fechaIngreso', 'fechaDerivacion',
]);
const COLUMNAS_NUMERO = new Set(['edadAlIngreso', 'numeroCorrelativo']);

export async function leerXlsxImportacion(
  archivo: Buffer,
  columnas: readonly string[],
) {
  const libro = new ExcelJS.Workbook();

  try {
    await libro.xlsx.load(new Uint8Array(archivo).buffer);
  } catch {
    throw new BadRequestException('No se pudo leer el archivo XLSX');
  }

  const hoja = libro.getWorksheet('Importacion');
  if (!hoja) {
    throw new BadRequestException('El XLSX debe contener una hoja llamada Importacion');
  }

  const encabezado = hoja.getRow(1);
  if (
    encabezado.actualCellCount !== columnas.length ||
    columnas.some((columna, i) => encabezado.getCell(i + 1).value !== columna)
  ) {
    throw new BadRequestException(
      'Los encabezados del XLSX deben coincidir con la plantilla de importación',
    );
  }

  const filas: { numeroFila: number; datos: Record<string, string> }[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;

    fila.eachCell((_celda, numeroColumna) => {
      if (numeroColumna > columnas.length) {
        throw new BadRequestException(`La fila ${numeroFila} tiene columnas adicionales`);
      }
    });

    const datos = Object.fromEntries(columnas.map((columna, i) => {
      const { value } = fila.getCell(i + 1);

      if (value == null || typeof value === 'string') {
        return [columna, value ?? ''];
      }
      if (value instanceof Date && COLUMNAS_FECHA.has(columna)) {
        return [columna, value.toISOString().slice(0, 10)];
      }
      if (typeof value === 'number' && COLUMNAS_NUMERO.has(columna)) {
        return [columna, String(value)];
      }

      throw new BadRequestException(
        `Valor no admitido en la fila ${numeroFila}, columna ${columna}. Usa texto y evita fórmulas.`,
      );
    }));

    filas.push({ numeroFila, datos });
  });

  if (filas.length === 0) {
    throw new BadRequestException('El XLSX no contiene filas para importar');
  }

  return filas;
}
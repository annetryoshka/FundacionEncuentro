import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { posicionesEncabezado } from './encabezado-importacion.js';

const COLUMNAS_FECHA = new Set([
  'fechaNacimiento', 'fechaIngreso', 'fechaDerivacion',
]);

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

  const filaEncabezado = hoja.getRow(1);
  const encabezado = Array.from(
    { length: filaEncabezado.cellCount },
    (_, i) => filaEncabezado.getCell(i + 1).value,
  );
  const { posiciones, ancho: anchoEncabezado } = posicionesEncabezado(encabezado, columnas, 'XLSX');

  const filas: { numeroFila: number; datos: Record<string, string> }[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;

    fila.eachCell((_celda, numeroColumna) => {
      if (numeroColumna > anchoEncabezado) {
        throw new BadRequestException(`La fila ${numeroFila} tiene columnas adicionales`);
      }
    });

    const datos = Object.fromEntries(columnas.map((columna, i) => {
      if (posiciones[i] < 0) return [columna, ''];
      const { value } = fila.getCell(posiciones[i] + 1);

      if (value == null || typeof value === 'string') {
        return [columna, value ?? ''];
      }
      if (value instanceof Date && COLUMNAS_FECHA.has(columna)) {
        return [columna, value.toISOString().slice(0, 10)];
      }
      // Excel guarda teléfonos, números de carpeta y edades como número.
      if (typeof value === 'number' && Number.isFinite(value) && !COLUMNAS_FECHA.has(columna)) {
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

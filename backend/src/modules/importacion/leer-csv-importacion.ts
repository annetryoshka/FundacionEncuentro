import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { posicionesEncabezado } from './encabezado-importacion.js';

export function leerCsvImportacion(
  archivo: Buffer,
  columnas: readonly string[],
) {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(archivo);
  } catch {
    throw new BadRequestException('El CSV debe estar codificado en UTF-8');
  }

  // Excel en español guarda el CSV con punto y coma.
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  const delimitador = primeraLinea.includes(';') && !primeraLinea.includes(',') ? ';' : ',';

  let registros: string[][];
  try {
    registros = parse(texto, {
      delimiter: delimitador,
      skip_empty_lines: true,
    });
  } catch {
    throw new BadRequestException(
      'El CSV tiene comillas inválidas o filas con distinta cantidad de columnas',
    );
  }

  const [encabezado, ...filas] = registros;
  const { posiciones, ancho } = posicionesEncabezado(encabezado ?? [], columnas, 'CSV');

  if (filas.length === 0) {
    throw new BadRequestException('El CSV no contiene filas para importar');
  }

  filas.forEach((fila, i) => {
    if (fila.slice(ancho).some((valor) => valor.trim() !== '')) {
      throw new BadRequestException(`La fila ${i + 2} tiene columnas adicionales`);
    }
  });

  return filas.map((fila, i) => ({
    numeroFila: i + 2,
    datos: Object.fromEntries(
      columnas.map((columna, j) => [columna, posiciones[j] < 0 ? '' : fila[posiciones[j]]]),
    ),
  }));
}

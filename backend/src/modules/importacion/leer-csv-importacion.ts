import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

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

  let registros: string[][];
  try {
    registros = parse(texto, {
      delimiter: ',',
      skip_empty_lines: true,
    });
  } catch {
    throw new BadRequestException(
      'El CSV tiene comillas inválidas o filas con distinta cantidad de columnas',
    );
  }

  const [encabezado, ...filas] = registros;

  if (
    !encabezado ||
    encabezado.length !== columnas.length ||
    columnas.some((columna, i) => columna !== encabezado[i])
  ) {
    throw new BadRequestException(
      'Los encabezados del CSV deben coincidir con la plantilla de importación',
    );
  }

  if (filas.length === 0) {
    throw new BadRequestException('El CSV no contiene filas para importar');
  }

  return filas.map((fila, i) => ({
    numeroFila: i + 2,
    datos: Object.fromEntries(columnas.map((columna, j) => [columna, fila[j]])),
  }));
}
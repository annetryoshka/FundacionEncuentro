import { BadRequestException } from '@nestjs/common';

/**
 * Valida el encabezado: columnas de la plantilla, en cualquier orden y sin repetir.
 * Admite un subconjunto (p. ej. el formato de FE-162); las columnas ausentes quedan vacías.
 * Ignora celdas vacías al final del encabezado (Excel suele dejarlas).
 * Devuelve la posición de cada columna de la plantilla en el archivo (-1 si no está) y el ancho usado.
 */
export function posicionesEncabezado(
  encabezado: readonly unknown[],
  columnas: readonly string[],
  formato: 'CSV' | 'XLSX',
): { posiciones: number[]; ancho: number } {
  const nombres = encabezado.map((valor) => (typeof valor === 'string' ? valor.trim() : ''));
  while (nombres.length > 0 && nombres[nombres.length - 1] === '') nombres.pop();
  const vistas = new Set<string>();

  for (const nombre of nombres) {
    if (!columnas.includes(nombre)) {
      throw new BadRequestException(
        `El encabezado del ${formato} tiene una columna que no es de la plantilla: "${nombre}"`,
      );
    }
    if (vistas.has(nombre)) {
      throw new BadRequestException(`El encabezado del ${formato} repite la columna "${nombre}"`);
    }
    vistas.add(nombre);
  }

  if (nombres.length === 0) {
    throw new BadRequestException(`El ${formato} no tiene encabezado`);
  }

  return { posiciones: columnas.map((columna) => nombres.indexOf(columna)), ancho: nombres.length };
}

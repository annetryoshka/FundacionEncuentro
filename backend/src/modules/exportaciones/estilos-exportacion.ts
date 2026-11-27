/**
 * Estilo institucional de los documentos exportados (FE-157). Los mismos colores que la interfaz
 * (frontend/src/index.css). Solo afecta la presentación: no agrega ni cambia datos del caso.
 */
export const ESTILO_EXPORTACION = {
  institucion: 'Fundación Encuentro',
  aviso: 'Documento confidencial',
  colores: {
    verdeOscuro: '00561C',
    naranja: 'E85A1E',
    texto: '2B2B2B',
    suave: '5C5C5C',
    linea: 'E3D9D3',
    crema: 'FDF6F2',
    blanco: 'FFFFFF',
  },
  /** Proporción de la tabla que ocupa la columna «Campo». */
  anchoColumnaCampo: 0.34,
} as const;

/** Respeta los saltos de línea que escribió la persona (evolución, observaciones). */
export function lineas(texto: string): string[] {
  return texto.split(/\r?\n/);
}

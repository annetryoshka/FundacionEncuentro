const FORMATO_BOB = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "Bs 75,50". El backend envía montos como texto decimal con punto ("75.50"). */
export const bolivianos = (monto: string | number) => `Bs ${FORMATO_BOB.format(Number(monto))}`

/**
 * Convierte lo escrito ("75,50", "75.5", "120") al formato del backend ("75.50", "75.5", "120"):
 * hasta 8 enteros y 2 decimales, con coma o punto. Devuelve null si no es un monto válido.
 */
export function normalizarMonto(texto: string): string | null {
  const limpio = texto.trim()
  return /^(?:0|[1-9]\d{0,7})(?:[.,]\d{1,2})?$/.test(limpio) ? limpio.replace(',', '.') : null
}

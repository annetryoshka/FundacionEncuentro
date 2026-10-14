/**
 * Fechas sin hora (AAAA-MM-DD) se tratan como fecha local, nunca con new Date('2026-10-11'):
 * eso las interpreta en UTC y en La Paz (UTC-4) mostraría el día anterior.
 */

const FORMATO_LARGO = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
const FORMATO_CORTO = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })

function aFechaLocal(iso: string): Date | null {
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!partes) return null
  const [, a, m, d] = partes.map(Number)
  const fecha = new Date(a, m - 1, d)
  // Rechaza fechas imposibles como 2026-02-31.
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d ? fecha : null
}

export const esFechaValida = (iso: string) => aFechaLocal(iso) !== null

export function hoyIso(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

/** "11 de octubre de 2026" para AAAA-MM-DD, o fecha y hora local para un timestamp ISO. */
export function fechaLarga(valor: string): string {
  const fecha = aFechaLocal(valor) ?? new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : FORMATO_LARGO.format(fecha)
}

export function fechaCorta(valor: string): string {
  const fecha = aFechaLocal(valor) ?? new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : FORMATO_CORTO.format(fecha)
}

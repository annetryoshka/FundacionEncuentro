/**
 * FE-175 · Gastos de funcionamiento del mes (contrato FE-172, API FE-174). Solo administración.
 * Montos como texto decimal con punto ("120.00"): no se redondea ni se usa número de punto flotante.
 */
import { peticion } from '../../api/cliente'
import { esFechaValida, hoyIso } from '../../utilidades/fechas'
import { normalizarMonto } from '../expediente/moneda'

export const CATEGORIAS_GASTO = ['internet', 'electricidad', 'alquiler', 'otros'] as const
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]

export const NOMBRE_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  internet: 'Internet / Wi-Fi',
  electricidad: 'Electricidad',
  alquiler: 'Alquiler',
  otros: 'Otros gastos',
}

export interface Gasto {
  id: string
  fecha: string
  categoria: CategoriaGasto
  descripcion: string | null
  monto: string
  anulado: boolean
  anuladoEn: string | null
  anuladoPor: string | null
  motivoAnulacion: string | null
  registradoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
}

export interface GastosDelMes {
  mes: string
  gastos: Gasto[]
  totalMes: string
  cantidadVigentes: number
  cantidadAnulados: number
  totalesPorCategoria: { categoria: CategoriaGasto; cantidad: number; total: string }[]
}

export interface DatosGasto {
  categoria: CategoriaGasto
  fecha: string
  monto: string
  descripcion: string | null
}

export const consultarGastos = (mes: string) => peticion<GastosDelMes>('/gastos', { consulta: { mes } })
export const registrarGasto = (datos: DatosGasto) => peticion<Gasto>('/gastos', { metodo: 'POST', cuerpo: datos })
/** Formulario completo; 409 si el gasto está anulado. */
export const corregirGasto = (id: string, datos: DatosGasto) =>
  peticion<Gasto>(`/gastos/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos })
/** Repetir la anulación devuelve el mismo gasto sin volver a restar. */
export const anularGasto = (id: string, motivo: string | null) =>
  peticion<Gasto>(`/gastos/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: { motivo } })

// ---- Meses -------------------------------------------------------------------------

export const MES = /^20\d{2}-(0[1-9]|1[0-2])$/
export const mesActual = () => hoyIso().slice(0, 7)

export function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const FORMATO_MES = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' })
/** «noviembre de 2026». */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return FORMATO_MES.format(new Date(a, m - 1, 1))
}

// ---- Formulario ----------------------------------------------------------------------

export interface FormularioGasto {
  categoria: CategoriaGasto | ''
  fecha: string
  monto: string
  descripcion: string
}

export type ErroresGasto = Partial<Record<keyof FormularioGasto, string>>

/** Fecha sugerida: hoy si se mira el mes actual; si no, el primer día del mes elegido. */
export const formularioVacio = (mes: string): FormularioGasto => ({
  categoria: '',
  fecha: mes === mesActual() ? hoyIso() : `${mes}-01`,
  monto: '',
  descripcion: '',
})

export const aFormulario = (g: Gasto): FormularioGasto => ({
  categoria: g.categoria,
  fecha: g.fecha,
  monto: g.monto.replace('.', ','),
  descripcion: g.descripcion ?? '',
})

/** Mismas reglas que GuardarGastoDto, para no enviar lo que el servidor va a rechazar. */
export function validarGasto(f: FormularioGasto): ErroresGasto {
  const e: ErroresGasto = {}
  if (!f.categoria) e.categoria = 'Elige el tipo de gasto.'
  if (!f.fecha || !esFechaValida(f.fecha)) e.fecha = 'Escribe una fecha válida.'
  else if (f.fecha > hoyIso()) e.fecha = 'La fecha no puede ser futura.'
  else if (f.fecha < '2000-01-01') e.fecha = 'La fecha debe ser desde el año 2000.'
  const monto = normalizarMonto(f.monto)
  if (!f.monto.trim()) e.monto = 'Escribe el monto en bolivianos.'
  else if (!monto) e.monto = 'Usa hasta 8 cifras y 2 decimales, por ejemplo 120,50.'
  else if (Number(monto) <= 0) e.monto = 'El monto debe ser mayor que cero.'
  if (f.descripcion.trim().length > 200) e.descripcion = 'La descripción admite hasta 200 caracteres.'
  else if (f.categoria === 'otros' && !f.descripcion.trim())
    e.descripcion = 'Describe el gasto: es obligatorio en «Otros gastos».'
  return e
}

export const aDatos = (f: FormularioGasto): DatosGasto => ({
  categoria: f.categoria as CategoriaGasto,
  fecha: f.fecha,
  monto: normalizarMonto(f.monto)!,
  descripcion: f.descripcion.trim() || null,
})

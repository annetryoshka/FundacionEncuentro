import { esFechaValida, hoyIso } from '../../utilidades/fechas'
import type { NuevaCarpeta } from './tipos'

export type ErroresCarpeta = Partial<Record<keyof NuevaCarpeta, string>>

const FECHA_MINIMA = '1990-01-01'

export function validarNuevaCarpeta(datos: { [K in keyof NuevaCarpeta]: string }): ErroresCarpeta {
  const errores: ErroresCarpeta = {}
  const nombre = datos.nombreCompleto.trim()

  if (!nombre) errores.nombreCompleto = 'Escribe el nombre completo del paciente.'
  else if (nombre.length < 3) errores.nombreCompleto = 'El nombre es demasiado corto.'
  else if (!/\p{L}/u.test(nombre)) errores.nombreCompleto = 'El nombre debe tener letras.'

  if (!datos.fechaIngreso) errores.fechaIngreso = 'Indica la fecha de ingreso.'
  else if (!esFechaValida(datos.fechaIngreso)) errores.fechaIngreso = 'La fecha no es válida.'
  else if (datos.fechaIngreso > hoyIso()) errores.fechaIngreso = 'La fecha de ingreso no puede ser futura.'
  else if (datos.fechaIngreso < FECHA_MINIMA) errores.fechaIngreso = 'Revisa el año: la fecha es demasiado antigua.'

  if (!datos.tipo) errores.tipo = 'Elige cómo llegó el paciente.'

  return errores
}

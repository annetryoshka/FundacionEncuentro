import { esFechaValida, hoyIso } from '../../utilidades/fechas'
import type { NuevaCarpeta, TipoCaso } from './tipos'

/** Campos del formulario de registro (todo como texto, tal como lo escribe la persona). */
export interface FormularioCarpeta {
  nombreCompleto: string
  fechaNacimiento: string
  telefono: string
  fechaIngreso: string
  tipo: string
  diagnosticoIngreso: string
  juzgado: string
  nroExpediente: string
  fechaDerivacion: string
  observaciones: string
}

export type ErroresCarpeta = Partial<Record<keyof FormularioCarpeta, string>>

export const FORMULARIO_VACIO: Omit<FormularioCarpeta, 'fechaIngreso'> = {
  nombreCompleto: '',
  fechaNacimiento: '',
  telefono: '',
  tipo: '',
  diagnosticoIngreso: '',
  juzgado: '',
  nroExpediente: '',
  fechaDerivacion: '',
  observaciones: '',
}

const FECHA_MINIMA_INGRESO = '1990-01-01'
const FECHA_MINIMA_NACIMIENTO = '1900-01-01'

/** Mismas reglas que RegistrarCasoDto y CasosService.registrar, para avisar antes de enviar. */
export function validarNuevaCarpeta(datos: FormularioCarpeta): ErroresCarpeta {
  const errores: ErroresCarpeta = {}
  const nombre = datos.nombreCompleto.trim()
  const hoy = hoyIso()

  if (!nombre) errores.nombreCompleto = 'Escribe el nombre completo del paciente.'
  else if (nombre.length < 3) errores.nombreCompleto = 'El nombre es demasiado corto.'
  else if (nombre.length > 150) errores.nombreCompleto = 'El nombre no puede pasar de 150 caracteres.'
  else if (!/\p{L}/u.test(nombre)) errores.nombreCompleto = 'El nombre debe tener letras.'

  if (!datos.fechaIngreso) errores.fechaIngreso = 'Indica la fecha de ingreso.'
  else if (!esFechaValida(datos.fechaIngreso)) errores.fechaIngreso = 'La fecha no es válida.'
  else if (datos.fechaIngreso > hoy) errores.fechaIngreso = 'La fecha de ingreso no puede ser futura.'
  else if (datos.fechaIngreso < FECHA_MINIMA_INGRESO)
    errores.fechaIngreso = 'Revisa el año: la fecha es demasiado antigua.'

  if (datos.fechaNacimiento) {
    if (!esFechaValida(datos.fechaNacimiento)) errores.fechaNacimiento = 'La fecha no es válida.'
    else if (datos.fechaNacimiento < FECHA_MINIMA_NACIMIENTO) errores.fechaNacimiento = 'Revisa el año.'
    else if (datos.fechaNacimiento > (datos.fechaIngreso || hoy))
      errores.fechaNacimiento = 'No puede ser posterior a la fecha de ingreso.'
  }

  if (datos.telefono.trim().length > 30) errores.telefono = 'El teléfono no puede pasar de 30 caracteres.'
  else if (datos.telefono.trim() && !/^[\d\s()+-]*\d[\d\s()+-]*$/.test(datos.telefono.trim()))
    errores.telefono = 'Usa solo números, espacios, guiones, paréntesis o el signo +.'

  if (!datos.tipo) errores.tipo = 'Elige cómo llegó el paciente.'

  if (datos.tipo === 'derivado' && datos.fechaDerivacion) {
    if (!esFechaValida(datos.fechaDerivacion)) errores.fechaDerivacion = 'La fecha no es válida.'
    else if (datos.fechaDerivacion > hoy) errores.fechaDerivacion = 'La fecha de derivación no puede ser futura.'
  }

  return errores
}

const texto = (valor: string) => valor.trim() || undefined

/** Arma el cuerpo de POST /api/casos sin campos vacíos. */
export function aNuevaCarpeta(datos: FormularioCarpeta): NuevaCarpeta {
  const tipo = datos.tipo as TipoCaso
  const cuerpo: NuevaCarpeta = {
    paciente: {
      nombreCompleto: datos.nombreCompleto.trim().replace(/\s+/g, ' '),
      fechaNacimiento: texto(datos.fechaNacimiento),
      telefono: texto(datos.telefono),
    },
    caso: {
      tipo,
      fechaIngreso: datos.fechaIngreso,
      diagnosticoIngreso: texto(datos.diagnosticoIngreso),
    },
  }
  if (tipo === 'derivado') {
    const judicial = {
      juzgado: texto(datos.juzgado),
      nroExpediente: texto(datos.nroExpediente),
      fechaDerivacion: texto(datos.fechaDerivacion),
      observaciones: texto(datos.observaciones),
    }
    if (Object.values(judicial).some(Boolean)) cuerpo.contextoJudicial = judicial
  }
  return cuerpo
}

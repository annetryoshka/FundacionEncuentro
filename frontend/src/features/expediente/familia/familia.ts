/**
 * FE-127 · Composición familiar del caso (análisis FE-123, API FE-126).
 * Cada familiar se identifica por su relación RESPECTO DEL PACIENTE, no de quien llena el formulario.
 * No se crea una carpeta por familiar ni se enlazan personas entre expedientes.
 */
import { peticion } from '../../../api/cliente'
import { esFechaValida, hoyIso } from '../../../utilidades/fechas'

export const PARENTESCOS = [
  'madre',
  'padre',
  'hermano',
  'hermana',
  'hijo',
  'hija',
  'abuelo_materno',
  'abuela_materna',
  'abuelo_paterno',
  'abuela_paterna',
  'tio',
  'tia',
  'pareja',
  'tutor',
  'tutora',
  'otro',
] as const

export type Parentesco = (typeof PARENTESCOS)[number]

export const NOMBRE_PARENTESCO: Record<Parentesco, string> = {
  madre: 'Madre',
  padre: 'Padre',
  hermano: 'Hermano',
  hermana: 'Hermana',
  hijo: 'Hijo',
  hija: 'Hija',
  abuelo_materno: 'Abuelo materno',
  abuela_materna: 'Abuela materna',
  abuelo_paterno: 'Abuelo paterno',
  abuela_paterna: 'Abuela paterna',
  tio: 'Tío',
  tia: 'Tía',
  pareja: 'Pareja',
  tutor: 'Tutor',
  tutora: 'Tutora',
  otro: 'Otro parentesco',
}

/** Integrante tal como lo devuelve GET /api/carpetas/:id/familia. */
export interface Familiar {
  id: string
  parentesco: Parentesco
  parentescoDetalle: string | null
  nombreCompleto: string | null
  fechaNacimiento: string | null
  edadReferida: number | null
  fechaReferencia: string | null
  ocupacion: string | null
  lugarTrabajoEstudio: string | null
  conviveConPaciente: boolean | null
  observaciones: string | null
  creadoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
}

/** `registrada: false` = nunca se guardó la ficha familiar; `true` con lista vacía = se registró sin integrantes. */
export interface FichaFamiliar {
  casoId: string
  pacienteId: string
  registrada: boolean
  /** Control de concurrencia: null hasta el primer guardado. */
  version: number | null
  familiares: Familiar[]
}

/** Lo que se envía por integrante: sin `id` se crea, con `id` se actualiza; `null` limpia el campo. */
export type FamiliarEntrada = Omit<Familiar, 'id' | 'creadoPor' | 'creadoEn' | 'actualizadoPor' | 'actualizadoEn'> & {
  id?: string
}

const ruta = (carpetaId: string) => `/carpetas/${encodeURIComponent(carpetaId)}/familia`

export const obtenerFamilia = (carpetaId: string) => peticion<FichaFamiliar>(ruta(carpetaId))

/**
 * PUT transaccional: si algo es inválido no se guarda nada (400). `version` vieja → 409.
 * Un integrante omitido NO se borra: hay que pedirlo en `eliminarIds`.
 */
export const guardarFamilia = (
  carpetaId: string,
  cuerpo: { version: number | null; familiares: FamiliarEntrada[]; eliminarIds: string[] },
) => peticion<FichaFamiliar>(ruta(carpetaId), { metodo: 'PUT', cuerpo })

// ---- Formulario ---------------------------------------------------------------

export type ModoEdad = 'nacimiento' | 'referida' | 'desconocida'
export type Convivencia = 'si' | 'no' | ''

/** Fila editable. `clave` es local (React); `id` es el del servidor o null si es nueva. */
export interface FilaFamiliar {
  clave: string
  id: string | null
  parentesco: Parentesco | ''
  parentescoDetalle: string
  nombreCompleto: string
  modoEdad: ModoEdad
  fechaNacimiento: string
  edadReferida: string
  fechaReferencia: string
  ocupacion: string
  lugarTrabajoEstudio: string
  convive: Convivencia
  observaciones: string
}

export type ErroresFila = Partial<Record<keyof FilaFamiliar, string>>

export const LIMITES = { nombre: 150, detalle: 100, ocupacion: 200, lugar: 150, observaciones: 2000 } as const
const FECHA_MINIMA = '1900-01-01'

let contador = 0
const nuevaClave = () => `fila-${++contador}`

export function filaVacia(): FilaFamiliar {
  return {
    clave: nuevaClave(),
    id: null,
    parentesco: '',
    parentescoDetalle: '',
    nombreCompleto: '',
    modoEdad: 'desconocida',
    fechaNacimiento: '',
    edadReferida: '',
    fechaReferencia: hoyIso(),
    ocupacion: '',
    lugarTrabajoEstudio: '',
    convive: '',
    observaciones: '',
  }
}

export function aFila(f: Familiar): FilaFamiliar {
  return {
    clave: nuevaClave(),
    id: f.id,
    parentesco: f.parentesco,
    parentescoDetalle: f.parentescoDetalle ?? '',
    nombreCompleto: f.nombreCompleto ?? '',
    modoEdad: f.fechaNacimiento ? 'nacimiento' : f.edadReferida !== null ? 'referida' : 'desconocida',
    fechaNacimiento: f.fechaNacimiento ?? '',
    edadReferida: f.edadReferida === null ? '' : String(f.edadReferida),
    fechaReferencia: f.fechaReferencia ?? hoyIso(),
    ocupacion: f.ocupacion ?? '',
    lugarTrabajoEstudio: f.lugarTrabajoEstudio ?? '',
    convive: f.conviveConPaciente === null ? '' : f.conviveConPaciente ? 'si' : 'no',
    observaciones: f.observaciones ?? '',
  }
}

const texto = (valor: string) => valor.trim().replace(/\s+/g, ' ') || null

/** Fila → cuerpo del PUT. Se envían todos los campos: así borrar un dato en el formulario lo limpia (null). */
export function aEntrada(fila: FilaFamiliar): FamiliarEntrada {
  const entrada: FamiliarEntrada = {
    parentesco: fila.parentesco as Parentesco,
    parentescoDetalle: fila.parentesco === 'otro' ? texto(fila.parentescoDetalle) : null,
    nombreCompleto: texto(fila.nombreCompleto),
    fechaNacimiento: fila.modoEdad === 'nacimiento' ? fila.fechaNacimiento : null,
    edadReferida: fila.modoEdad === 'referida' ? Number(fila.edadReferida) : null,
    fechaReferencia: fila.modoEdad === 'referida' ? fila.fechaReferencia : null,
    ocupacion: texto(fila.ocupacion),
    lugarTrabajoEstudio: texto(fila.lugarTrabajoEstudio),
    conviveConPaciente: fila.convive === '' ? null : fila.convive === 'si',
    // Las observaciones conservan los saltos de línea.
    observaciones: fila.observaciones.trim() || null,
  }
  return fila.id ? { id: fila.id, ...entrada } : entrada
}

function validarFecha(valor: string, nombre: string): string | undefined {
  if (!valor) return `Indica la ${nombre}.`
  if (!esFechaValida(valor)) return 'La fecha no es válida.'
  if (valor > hoyIso()) return 'La fecha no puede ser futura.'
  if (valor < FECHA_MINIMA) return 'Revisa el año: la fecha es demasiado antigua.'
  return undefined
}

/** Mismas reglas que la base (migración 015) para que el servidor no tenga que rechazar el lote. */
export function validarFila(fila: FilaFamiliar): ErroresFila {
  const e: ErroresFila = {}
  if (!fila.parentesco) e.parentesco = 'Elige el parentesco respecto del paciente.'
  if (fila.parentesco === 'otro') {
    if (!fila.parentescoDetalle.trim()) e.parentescoDetalle = 'Describe el parentesco.'
    else if (fila.parentescoDetalle.trim().length > LIMITES.detalle)
      e.parentescoDetalle = `Máximo ${LIMITES.detalle} caracteres.`
  }
  if (fila.nombreCompleto.trim().length > LIMITES.nombre) e.nombreCompleto = `Máximo ${LIMITES.nombre} caracteres.`
  if (fila.modoEdad === 'nacimiento') e.fechaNacimiento = validarFecha(fila.fechaNacimiento, 'fecha de nacimiento')
  if (fila.modoEdad === 'referida') {
    const edad = fila.edadReferida.trim()
    if (!/^\d{1,3}$/.test(edad) || Number(edad) > 130) e.edadReferida = 'Escribe una edad entre 0 y 130 años.'
    e.fechaReferencia = validarFecha(fila.fechaReferencia, 'fecha en que se informó la edad')
  }
  if (fila.ocupacion.trim().length > LIMITES.ocupacion) e.ocupacion = `Máximo ${LIMITES.ocupacion} caracteres.`
  if (fila.lugarTrabajoEstudio.trim().length > LIMITES.lugar)
    e.lugarTrabajoEstudio = `Máximo ${LIMITES.lugar} caracteres.`
  if (fila.observaciones.trim().length > LIMITES.observaciones) {
    e.observaciones = `Máximo ${LIMITES.observaciones} caracteres.`
  }
  for (const clave of Object.keys(e) as (keyof FilaFamiliar)[]) if (!e[clave]) delete e[clave]
  return e
}

/**
 * Solo se envían los integrantes nuevos o cambiados: así guardar uno no toca la autoría de los demás.
 */
export function cambios(originales: Familiar[], filas: FilaFamiliar[]) {
  const porId = new Map(originales.map((f) => [f.id, f]))
  const familiares = filas
    .map(aEntrada)
    .filter((e) => !e.id || JSON.stringify(aEntrada(aFila(porId.get(e.id)!))) !== JSON.stringify(e))
  const presentes = new Set(filas.map((f) => f.id).filter(Boolean))
  const eliminarIds = originales.filter((f) => !presentes.has(f.id)).map((f) => f.id)
  return { familiares, eliminarIds }
}

// ---- Presentación ---------------------------------------------------------------

export function nombreParentesco(f: Pick<Familiar, 'parentesco' | 'parentescoDetalle'>): string {
  return f.parentesco === 'otro' && f.parentescoDetalle ? f.parentescoDetalle : NOMBRE_PARENTESCO[f.parentesco]
}

/** Años cumplidos a `hoy` desde una fecha AAAA-MM-DD. */
export function edadCumplida(nacimiento: string, hoy = hoyIso()): number {
  const [a, m, d] = nacimiento.split('-').map(Number)
  const [ha, hm, hd] = hoy.split('-').map(Number)
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
}

/**
 * La edad referida NO se actualiza sola: se muestra junto a la fecha en que se informó (FE-123 §2).
 */
export function textoEdad(
  f: Pick<Familiar, 'fechaNacimiento' | 'edadReferida' | 'fechaReferencia'>,
  fechaLarga: (v: string) => string,
) {
  if (f.fechaNacimiento) {
    const edad = edadCumplida(f.fechaNacimiento)
    return `${edad} ${edad === 1 ? 'año' : 'años'} (nació el ${fechaLarga(f.fechaNacimiento)})`
  }
  if (f.edadReferida !== null) {
    const fecha = f.fechaReferencia ? ` al ${fechaLarga(f.fechaReferencia)}` : ''
    return `${f.edadReferida} ${f.edadReferida === 1 ? 'año' : 'años'}${fecha} (edad referida)`
  }
  return 'Edad no registrada'
}

export function textoConvivencia(valor: boolean | null) {
  return valor === null ? 'Sin dato' : valor ? 'Sí' : 'No'
}

import type { DatosResidencia, FiltroResidencia } from './residencia'

/** Valores de casos.tipo y casos.estado en db/migrations/001_esquema_base.sql. */
export type TipoCaso = 'voluntario' | 'derivado'
export type EstadoCaso = 'iniciado' | 'en_proceso' | 'concluido'
/** casos.clasificacion (migración 004). Es independiente del tipo: una carpeta nueva nace sin clasificar (null). */
export type Clasificacion = 'social' | 'privado'

export interface PersonaBreve {
  id: string
  nombreCompleto: string
}

/** Paciente del listado y del detalle: incluye su ciudad de residencia (FE-136/FE-138). */
export interface PacienteCarpeta extends PersonaBreve, DatosResidencia {}

/** Fila del listado de GET /api/carpetas. */
export interface CarpetaResumen {
  id: string
  numero: number
  tipo: TipoCaso
  estado: EstadoCaso
  /** null = todavía sin clasificar. */
  clasificacion: Clasificacion | null
  /** Fecha sin hora, formato AAAA-MM-DD. */
  fechaIngreso: string
  paciente: PacienteCarpeta
  terapeuta: PersonaBreve | null
}

/** Parámetros de GET /api/carpetas (FE-47). Un filtro vacío significa «Todos» y no se envía. */
export interface FiltrosCarpetas {
  busqueda: string
  clasificacion: Clasificacion | ''
  estado: EstadoCaso | ''
  /** FE-138: «Todas» ('') no se envía; «Sin registrar» viaja como `sin_registrar`. */
  residencia: FiltroResidencia
  pagina: number
}

/** Respuesta de PATCH /api/carpetas/:id/clasificacion. `actualizadoPor` es el UUID del perfil. */
export interface ClasificacionGuardada {
  id: string
  clasificacion: Clasificacion
  actualizadoPor: string
  actualizadoEn: string
}

/** Respuesta de PATCH /api/casos/:id/estado. `actualizadoPor` es el UUID del perfil. */
export interface EstadoGuardado {
  id: string
  estado: EstadoCaso
  actualizadoPor: string
  actualizadoEn: string
}

/** GET /api/carpetas/:id */
export interface CarpetaDetalle extends CarpetaResumen {
  creadoPor: PersonaBreve | null
  creadoEn: string
  asignadoPor: PersonaBreve | null
  asignadoEn: string | null
  actualizadoPor: PersonaBreve | null
  actualizadoEn: string | null
}

/** Respuesta paginada de GET /api/carpetas. */
export interface PaginaCarpetas {
  carpetas: CarpetaResumen[]
  total: number
  pagina: number
  tamano: number
}

/** Cuerpo de POST /api/carpetas. */
export interface NuevaCarpeta {
  nombreCompleto: string
  fechaIngreso: string
  tipo: TipoCaso
}

/** Alta con la residencia del paciente (opcional: sin dato queda «Sin registrar»). */
export interface AltaConResidencia extends NuevaCarpeta, DatosResidencia {}

/** Cuerpo de PATCH /api/carpetas/:id. El backend exige nombre y fecha juntos; la residencia se envía siempre. */
export interface DatosEditablesPaciente extends DatosResidencia {
  nombreCompleto: string
  fechaIngreso: string
}

/** POST /api/casos: el detalle autorizado se consulta después con GET /api/carpetas/:id. */
export interface AltaCarpeta {
  id: string
  numeroCorrelativo: number
  posiblesDuplicados: { pacienteId: string; nombreCompleto: string; similitud: number }[]
}

/** Lo que trae un 409 de POST /api/carpetas en `posiblesDuplicados`. */
export interface PosibleDuplicado {
  id: string
  numero: number
  tipo: TipoCaso
  nombreCompleto: string
}

export const NOMBRE_TIPO: Record<TipoCaso, string> = {
  voluntario: 'Voluntario',
  derivado: 'Derivado',
}

// El SRS dice "en conclusión"; la base guarda "concluido".
export const NOMBRE_ESTADO: Record<EstadoCaso, string> = {
  iniciado: 'Iniciado',
  en_proceso: 'En proceso',
  concluido: 'En conclusión',
}

export const NOMBRE_CLASIFICACION: Record<Clasificacion, string> = {
  social: 'Social',
  privado: 'Privado',
}

export const SIN_CLASIFICAR = 'Sin clasificar'

export const esClasificacion = (valor: string | null): valor is Clasificacion =>
  valor !== null && valor in NOMBRE_CLASIFICACION
export const esEstado = (valor: string | null): valor is EstadoCaso => valor !== null && valor in NOMBRE_ESTADO

/** Número de carpeta visible. Hay una secuencia por tipo, por eso se muestra junto al tipo. */
export const numeroCarpeta = (numero: number) => `Nº ${numero}`

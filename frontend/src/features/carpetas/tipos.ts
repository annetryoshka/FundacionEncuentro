/** Valores de casos.tipo y casos.estado en db/migrations/001_esquema_base.sql. */
export type TipoCaso = 'voluntario' | 'derivado'
export type EstadoCaso = 'iniciado' | 'en_proceso' | 'concluido'

export interface PersonaBreve {
  id: string
  nombreCompleto: string
}

/** Fila del listado de GET /api/carpetas. */
export interface CarpetaResumen {
  id: string
  numero: number
  tipo: TipoCaso
  estado: EstadoCaso
  /** Fecha sin hora, formato AAAA-MM-DD. */
  fechaIngreso: string
  paciente: PersonaBreve
  terapeuta: PersonaBreve | null
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

/** Número de carpeta visible. Hay una secuencia por tipo, por eso se muestra junto al tipo. */
export const numeroCarpeta = (numero: number) => `Nº ${numero}`

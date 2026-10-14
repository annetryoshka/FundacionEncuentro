/** Valores de casos.tipo y casos.estado (db/migrations/001 y backend/src/modules/casos). */
export type TipoCaso = 'voluntario' | 'derivado'
export type EstadoCaso = 'iniciado' | 'en_proceso' | 'concluido'

export interface PersonaBreve {
  id: string
  nombreCompleto: string
}

/** Fila de GET /api/casos (campo `datos`). */
export interface CarpetaResumen {
  id: string
  tipo: TipoCaso
  numeroCorrelativo: number
  estado: EstadoCaso
  /** Fecha sin hora, AAAA-MM-DD. */
  fechaIngreso: string
  paciente: PersonaBreve
}

export interface ContextoJudicial {
  juzgado: string | null
  nroExpediente: string | null
  fechaDerivacion: string | null
  observaciones: string | null
}

/** GET /api/casos/:id */
export interface CarpetaDetalle extends Omit<CarpetaResumen, 'paciente'> {
  diagnosticoIngreso: string | null
  hipotesisRelacional: string | null
  comentariosClinicos: string | null
  creadoEn: string
  paciente: PersonaBreve & {
    fechaNacimiento: string | null
    edadAlIngreso: number | null
    telefono: string | null
  }
  contextoJudicial: ContextoJudicial | null
  /**
   * Asignación de terapeuta: el backend todavía no la devuelve (llega con FE-37).
   * Mientras no exista, el frontend muestra "Sin terapeuta asignada".
   */
  terapeuta?: PersonaBreve | null
  asignadoPor?: PersonaBreve | null
  asignadoEn?: string | null
}

/** Respuesta de GET /api/casos?q=&tipo=&estado=&limite=&desplazamiento= */
export interface ListadoCarpetas {
  datos: CarpetaResumen[]
  total: number
  limite: number
  desplazamiento: number
}

export interface FiltrosCarpetas {
  q?: string
  tipo?: TipoCaso | ''
  estado?: EstadoCaso | ''
  pagina: number
}

/** Cuerpo de POST /api/casos (RegistrarCasoDto). Los campos vacíos no se envían. */
export interface NuevaCarpeta {
  paciente: {
    nombreCompleto: string
    fechaNacimiento?: string
    telefono?: string
  }
  caso: {
    tipo: TipoCaso
    fechaIngreso?: string
    diagnosticoIngreso?: string
  }
  /** Solo para casos derivados. */
  contextoJudicial?: {
    juzgado?: string
    nroExpediente?: string
    fechaDerivacion?: string
    observaciones?: string
  }
}

/** Aviso que acompaña al 201 de POST /api/casos: no bloquea el registro. */
export interface PosibleDuplicado {
  pacienteId: string
  nombreCompleto: string
  /** 0 a 1 (similitud de pg_trgm). */
  similitud: number
}

export type CarpetaRegistrada = CarpetaDetalle & { posiblesDuplicados: PosibleDuplicado[] }

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

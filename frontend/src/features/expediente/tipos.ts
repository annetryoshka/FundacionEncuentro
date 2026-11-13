/**
 * Sprint 2 · Expediente clínico de la carpeta: sesiones (FE-72), tareas (FE-77), diagnóstico (FE-67),
 * origen y consentimiento (FE-62), pagos (FE-87), historial (FE-82) e indicadores (FE-92).
 * Los tipos siguen las respuestas reales del backend (PR #26–#33). Fechas sin hora: AAAA-MM-DD.
 */
import type { Clasificacion, EstadoCaso, TipoCaso } from '../carpetas/tipos'

export interface Persona {
  id: string
  nombreCompleto: string
}

// ---- FE-72 · Sesiones -------------------------------------------------------

/** GET /carpetas/:id/sesiones no incluye la evolución; el detalle sí. */
export interface SesionResumen {
  id: string
  casoId: string
  numero: number
  fecha: string
  responsable: Persona
  /** UUID de la cuenta que la registró. */
  creadoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
}

export interface Sesion extends SesionResumen {
  evolucion: string
}

// ---- FE-77 · Tareas ---------------------------------------------------------

export type EstadoTarea = 'pendiente' | 'realizada'

export interface Tarea {
  id: string
  casoId: string
  sesionId: string
  /** El historial no lo incluye; el listado de tareas sí. */
  numeroSesion?: number
  descripcion: string
  estado: EstadoTarea
  fecha: string
  creadoPor: string | null
  creadoEn: string
  cumplimientoActualizadoPor: string | null
  cumplimientoActualizadoEn: string | null
}

export const NOMBRE_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  realizada: 'Realizada',
}

// ---- FE-67 · Diagnóstico ----------------------------------------------------

export interface Diagnostico {
  id: string
  casoId: string
  fecha: string
  diagnosticoIngreso: string | null
  hipotesisRelacional: string | null
  comentariosClinicos: string | null
  creadoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
}

export interface DiagnosticoAGuardar {
  fecha: string
  diagnosticoIngreso: string
  hipotesisRelacional: string | null
  comentariosClinicos: string | null
}

// ---- FE-62 · Origen y consentimiento ----------------------------------------

export type EstadoConstancia = 'pendiente' | 'registrado' | 'no_aplica'

export const NOMBRE_ESTADO_CONSTANCIA: Record<EstadoConstancia, string> = {
  pendiente: 'Pendiente',
  registrado: 'Registrada',
  no_aplica: 'No aplica',
}

export interface Constancia {
  id: string
  casoId: string
  procedencia: string | null
  origenJudicial: boolean
  estado: EstadoConstancia
  fechaConsentimiento: string | null
  referenciaEvidencia: string | null
  explicacion: string | null
  /** Solo cuando origenJudicial es true (corrección de FE-63, commit 8c77aa3). */
  contextoJudicial: ContextoJudicial | null
  creadoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
}

export interface ConstanciaAGuardar {
  procedencia: string | null
  origenJudicial: boolean
  estado: EstadoConstancia
  fechaConsentimiento: string | null
  referenciaEvidencia: string | null
  explicacion: string | null
  /** Obligatorio (con juzgado) si origenJudicial es true; null si es false. */
  contextoJudicial: ContextoJudicialAGuardar | null
}

/** Contexto judicial del caso (tabla contexto_judicial). También llega en el historial como `contexto`. */
export interface ContextoJudicial {
  juzgado: string | null
  nroExpediente: string | null
  fechaDerivacion: string | null
  observaciones: string | null
}

export interface ContextoJudicialAGuardar {
  juzgado: string
  nroExpediente: string | null
  fechaDerivacion: string | null
  observaciones: string | null
}

// ---- FE-87 · Pagos ----------------------------------------------------------

export type MetodoPago = 'qr' | 'transferencia'

export const NOMBRE_METODO_PAGO: Record<MetodoPago, string> = {
  qr: 'QR',
  transferencia: 'Transferencia',
}

export interface Pago {
  id: string
  casoId: string
  sesionId: string
  /** Texto decimal con punto, p. ej. "75.50". */
  monto: string
  moneda: 'BOB'
  fecha: string
  metodo: MetodoPago
  referencia: string | null
  registradoPor: string
  creadoEn: string
}

export interface PagoAGuardar {
  sesionId: string
  monto: string
  fecha: string
  metodo: MetodoPago
  referencia: string | null
}

/** POST /pagos es idempotente: si la sesión ya tenía ese mismo pago, devuelve el existente. */
export interface PagoRegistrado {
  pago: Pago
  reutilizado: boolean
}

// ---- FE-82 · Historial ------------------------------------------------------

export interface SesionHistorial extends Sesion {
  tareas: Tarea[]
}

export interface Historial {
  carpeta: {
    id: string
    numero: number
    tipo: TipoCaso
    clasificacion: Clasificacion | null
    estado: EstadoCaso
    fechaIngreso: string
    paciente: Persona
    terapeuta: Persona | null
    creadoPor: string | null
    creadoEn: string
    actualizadoEn: string
  }
  contexto: ContextoJudicial | null
  constancia: Constancia | null
  diagnostico: Diagnostico | null
  sesiones: SesionHistorial[]
}

// ---- FE-92 · Indicadores ----------------------------------------------------

export interface Indicadores {
  periodo: { desde: string; hasta: string }
  casosActuales: number
  casosPorEstado: Record<EstadoCaso, number>
  sesiones: number
  pagosRecibidos: { monto: string; moneda: 'BOB' }
}

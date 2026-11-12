import { peticion } from '../../api/cliente'
import type {
  Constancia,
  ConstanciaAGuardar,
  Diagnostico,
  DiagnosticoAGuardar,
  EstadoTarea,
  Historial,
  Indicadores,
  Pago,
  PagoAGuardar,
  PagoRegistrado,
  Sesion,
  SesionResumen,
  Tarea,
} from './tipos'

/** Rutas de la carpeta: el backend comprueba en cada una que la cuenta tenga acceso al caso. */
const carpeta = (id: string) => `/carpetas/${encodeURIComponent(id)}`

// FE-72 · Sesiones
export const listarSesiones = (casoId: string) =>
  peticion<{ sesiones: SesionResumen[] }>(`${carpeta(casoId)}/sesiones`).then((r) => r.sesiones)

export const obtenerSesion = (casoId: string, sesionId: string) =>
  peticion<{ sesion: Sesion }>(`${carpeta(casoId)}/sesiones/${encodeURIComponent(sesionId)}`).then((r) => r.sesion)

export const registrarSesion = (casoId: string, datos: { fecha: string; evolucion: string }) =>
  peticion<{ sesion: Sesion }>(`${carpeta(casoId)}/sesiones`, { metodo: 'POST', cuerpo: datos }).then((r) => r.sesion)

// FE-77 · Tareas
export const listarTareas = (casoId: string) =>
  peticion<{ tareas: Tarea[] }>(`${carpeta(casoId)}/tareas`).then((r) => r.tareas)

export const crearTarea = (casoId: string, datos: { sesionId: string; descripcion: string }) =>
  peticion<{ tarea: Tarea }>(`${carpeta(casoId)}/tareas`, { metodo: 'POST', cuerpo: datos }).then((r) => r.tarea)

export const cambiarCumplimiento = (casoId: string, tareaId: string, estado: EstadoTarea) =>
  peticion<{ tarea: Tarea }>(`${carpeta(casoId)}/tareas/${encodeURIComponent(tareaId)}/cumplimiento`, {
    metodo: 'PATCH',
    cuerpo: { estado },
  }).then((r) => r.tarea)

// FE-67 · Diagnóstico (null = todavía no tiene ficha)
export const obtenerDiagnostico = (casoId: string) =>
  peticion<{ diagnostico: Diagnostico | null }>(`${carpeta(casoId)}/diagnostico`).then((r) => r.diagnostico)

export const guardarDiagnostico = (casoId: string, datos: DiagnosticoAGuardar) =>
  peticion<{ diagnostico: Diagnostico }>(`${carpeta(casoId)}/diagnostico`, { metodo: 'PUT', cuerpo: datos }).then(
    (r) => r.diagnostico,
  )

// FE-62 · Origen y consentimiento (null = todavía no se registró)
export const obtenerConstancia = (casoId: string) =>
  peticion<{ constancia: Constancia | null }>(`${carpeta(casoId)}/constancia`).then((r) =>
    r.constancia ? { ...r.constancia, fechaConsentimiento: soloFecha(r.constancia.fechaConsentimiento) } : null,
  )

export const guardarConstancia = (casoId: string, datos: ConstanciaAGuardar) =>
  peticion<{ constancia: Constancia }>(`${carpeta(casoId)}/constancia`, { metodo: 'PUT', cuerpo: datos }).then((r) => ({
    ...r.constancia,
    fechaConsentimiento: soloFecha(r.constancia.fechaConsentimiento),
  }))

// FE-87 · Pagos (solo administración)
export const listarPagos = (casoId: string) =>
  peticion<{ pagos: Pago[] }>(`${carpeta(casoId)}/pagos`).then((r) => r.pagos)

export const registrarPago = (casoId: string, datos: PagoAGuardar) =>
  peticion<PagoRegistrado>(`${carpeta(casoId)}/pagos`, { metodo: 'POST', cuerpo: datos })

// FE-82 · Historial
export const obtenerHistorial = (casoId: string) => peticion<Historial>(`${carpeta(casoId)}/historial`)

// FE-92 · Indicadores (solo administración)
export const consultarIndicadores = (desde: string, hasta: string) =>
  peticion<Indicadores>('/indicadores', { consulta: { desde, hasta } })

/**
 * GET /constancia devuelve la fecha como timestamp (p. ej. "2026-11-10T04:00:00.000Z") porque lee la columna
 * date sin formatear; PUT la devuelve como "2026-11-10". El timestamp es la medianoche del servidor, así que su
 * fecha UTC es la fecha guardada si el servidor está en UTC o en Bolivia (no se convierte a la hora local).
 */
function soloFecha(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : valor
}

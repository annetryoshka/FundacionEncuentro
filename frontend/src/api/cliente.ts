/**
 * Cliente HTTP de la API de Fundación Encuentro (backend NestJS en /api).
 * Todas las peticiones pasan por aquí: añade el token, lo renueva una vez si el
 * backend responde 401 y trata los errores de una sola forma.
 */

const URL_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const TIEMPO_MAXIMO_MS = 15_000
const usarSimulacion = import.meta.env.DEV && import.meta.env.VITE_API_SIMULADA === 'true'

/** Error de la API. `estado` 0 = no hubo respuesta (sin conexión o tiempo agotado). */
export class ErrorApi extends Error {
  readonly estado: number
  /** Cuerpo JSON completo de la respuesta de error (p. ej. posiblesDuplicados en un 409). */
  readonly datos: Record<string, unknown>

  constructor(estado: number, mensaje: string, datos: Record<string, unknown> = {}) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.datos = datos
  }
}

// ---- Sesión ---------------------------------------------------------------

interface ManejoSesion {
  /** Token de acceso vigente, o null si no hay sesión. */
  token: () => string | null
  /** Pide un token nuevo con el refresh token. Devuelve null si no se pudo. */
  renovar: () => Promise<string | null>
  /** La sesión ya no sirve: ProveedorSesion la cierra y vuelve al login. */
  invalidar: () => void
}

let sesion: ManejoSesion | null = null

/** Lo llama ProveedorSesion al montar. */
export function configurarSesionApi(manejo: ManejoSesion | null) {
  sesion = manejo
}

// ---- Peticiones -----------------------------------------------------------

type Consulta = Record<string, string | number | boolean | null | undefined>

interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  cuerpo?: unknown
  consulta?: Consulta
  /** true para login y refresh: no mandan token ni tratan el 401 como sesión vencida. */
  publica?: boolean
}

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  let respuesta = await enviar(ruta, opciones, opciones.publica ? null : (sesion?.token() ?? null))

  // Token vencido: se renueva una sola vez y se repite la petición.
  if (respuesta.status === 401 && !opciones.publica && sesion) {
    const nuevo = await sesion.renovar()
    if (nuevo) respuesta = await enviar(ruta, opciones, nuevo)
    if (respuesta.status === 401) sesion.invalidar()
  }
  return procesar<T>(respuesta)
}

async function enviar(ruta: string, opciones: OpcionesPeticion, token: string | null): Promise<Response> {
  const { metodo = 'GET', cuerpo, consulta } = opciones
  const url = `${URL_BASE}${ruta}${aQueryString(consulta)}`
  const cabeceras: Record<string, string> = { Accept: 'application/json' }
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
  if (token) cabeceras.Authorization = `Bearer ${token}`
  const init: RequestInit = {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }

  try {
    if (usarSimulacion) {
      const { atenderSimulado } = await import('./simulado/servidor')
      return await atenderSimulado(url, init)
    }
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) })
  } catch {
    // fetch solo lanza si no hubo respuesta: red caída, CORS o tiempo agotado.
    throw new ErrorApi(0, 'Sin respuesta del servidor')
  }
}

async function procesar<T>(respuesta: Response): Promise<T> {
  if (!respuesta.ok) {
    const datos = await leerJson(respuesta)
    throw new ErrorApi(respuesta.status, extraerMensaje(datos, respuesta), datos)
  }
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

function aQueryString(consulta?: Consulta): string {
  if (!consulta) return ''
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(consulta)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  try {
    const datos: unknown = await respuesta.json()
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** NestJS responde { statusCode, message, error }; message puede ser texto o lista. */
function extraerMensaje(datos: Record<string, unknown>, respuesta: Response): string {
  const { message } = datos
  if (Array.isArray(message)) return message.join('. ')
  if (typeof message === 'string') return message
  return respuesta.statusText || `Error ${respuesta.status}`
}

/**
 * true si el backend todavía no tiene esa ruta. NestJS responde
 * 404 "Cannot GET /api/carpetas" cuando el endpoint no existe.
 */
export function esEndpointPendiente(error: unknown): boolean {
  return error instanceof ErrorApi && error.estado === 404 && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(error.message)
}

/** Mensaje para la persona usuaria ante errores que no tienen un trato especial en la pantalla. */
export function mensajeErrorGeneral(error: unknown): string {
  if (esEndpointPendiente(error)) {
    return 'Esta función todavía no está disponible en el servidor. El equipo la está terminando.'
  }
  if (error instanceof ErrorApi) {
    if (error.estado === 0) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    if (error.estado === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.'
    if (error.estado === 403) return 'Tu cuenta no tiene permiso para esta acción.'
    if (error.estado === 404) return 'No encontramos lo que buscas o no tienes acceso.'
    if (error.estado === 429) return 'Hubo demasiadas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.'
    if (error.estado >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
  }
  return 'No se pudo completar la acción. Inténtalo de nuevo.'
}

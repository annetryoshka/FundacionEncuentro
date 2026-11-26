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
let generacion = 0

/** Descarta las respuestas privadas pertenecientes a la sesión anterior. */
export function descartarPeticionesPrivadas() {
  generacion++
}

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
  /** Sprint 3: `archivo` devuelve el cuerpo como Blob (genograma, PDF/Word, ZIP) en vez de JSON. */
  respuesta?: 'json' | 'archivo'
}

/** Archivo recibido de la API. `nombre` sale de Content-Disposition cuando el backend lo envía. */
export interface ArchivoRecibido {
  contenido: Blob
  nombre: string | null
  tipo: string
}

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const actual = generacion
  const manejo = sesion
  const comprobar = () => {
    if (!opciones.publica && (actual !== generacion || !manejo?.token())) {
      throw new ErrorApi(401, 'Tu sesión terminó. Vuelve a iniciar sesión.')
    }
  }
  comprobar()
  let respuesta = await enviar(ruta, opciones, opciones.publica ? null : (sesion?.token() ?? null))
  comprobar()

  // Token vencido: se renueva una sola vez y se repite la petición.
  if (respuesta.status === 401 && !opciones.publica && sesion) {
    const nuevo = await manejo!.renovar()
    comprobar()
    if (nuevo) respuesta = await enviar(ruta, opciones, nuevo)
    comprobar()
    if (respuesta.status === 401) manejo!.invalidar()
  }
  const datos =
    opciones.respuesta === 'archivo' ? ((await procesarArchivo(respuesta)) as T) : await procesar<T>(respuesta)
  comprobar()
  return datos
}

/** GET de un archivo privado con el mismo token, renovación y manejo de errores que el resto. */
export function descargarArchivo(ruta: string): Promise<ArchivoRecibido> {
  return peticion<ArchivoRecibido>(ruta, { respuesta: 'archivo' })
}

/** Única petición que conserva el token capturado al iniciar la salida; no renueva. */
export async function revocarSesion(token: string): Promise<void> {
  await procesar<void>(await enviar('/auth/logout', { metodo: 'POST' }, token))
}

async function enviar(ruta: string, opciones: OpcionesPeticion, token: string | null): Promise<Response> {
  const { metodo = 'GET', cuerpo, consulta } = opciones
  const url = `${URL_BASE}${ruta}${aQueryString(consulta)}`
  const multipart = cuerpo instanceof FormData
  const cabeceras: Record<string, string> = { Accept: opciones.respuesta === 'archivo' ? '*/*' : 'application/json' }
  // Con FormData el navegador pone Content-Type con el boundary: no se fija a mano.
  if (cuerpo !== undefined && !multipart) cabeceras['Content-Type'] = 'application/json'
  if (token) cabeceras.Authorization = `Bearer ${token}`
  const init: RequestInit = {
    cache: 'no-store',
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : multipart ? cuerpo : JSON.stringify(cuerpo),
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

async function procesarArchivo(respuesta: Response): Promise<ArchivoRecibido> {
  if (!respuesta.ok) return procesar<never>(respuesta)
  const contenido = await respuesta.blob()
  return {
    contenido,
    nombre: nombreDeDisposicion(respuesta.headers.get('Content-Disposition')),
    tipo: respuesta.headers.get('Content-Type') ?? contenido.type,
  }
}

/** `attachment; filename="x.pdf"` o `filename*=UTF-8''x.pdf` → nombre del archivo. */
export function nombreDeDisposicion(cabecera: string | null): string | null {
  if (!cabecera) return null
  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera)
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* se usa el nombre simple */
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera)
  return simple ? simple[1].trim() : null
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

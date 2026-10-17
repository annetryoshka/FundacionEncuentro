import { ErrorApi, peticion, revocarSesion } from '../../api/cliente'
import type { CredencialesLogin, RespuestaSesion, UsuarioSesion } from './tipos'

/** POST /api/auth/login (FE-22). */
export function iniciarSesion(credenciales: CredencialesLogin): Promise<RespuestaSesion> {
  return peticion<RespuestaSesion>('/auth/login', { metodo: 'POST', cuerpo: credenciales, publica: true })
}

/** POST /api/auth/refresh: renueva la sesión con el refresh token. */
export function renovarSesion(refreshToken: string): Promise<RespuestaSesion> {
  return peticion<RespuestaSesion>('/auth/refresh', { metodo: 'POST', cuerpo: { refreshToken }, publica: true })
}

/** POST /api/auth/logout (FE-26): el backend invalida el token en Supabase. Responde 204. */
export function cerrarSesionEnServidor(token: string): Promise<void> {
  return revocarSesion(token)
}

/** GET /api/auth/me: datos del usuario con sesión iniciada. */
export function obtenerUsuarioActual(): Promise<UsuarioSesion> {
  return peticion<UsuarioSesion>('/auth/me')
}

/**
 * Traduce cualquier error del login a un mensaje para la persona usuaria.
 * Credenciales incorrectas (401) y cuenta inactiva o sin perfil (403) dan EL MISMO
 * mensaje (criterio de FE-20): así nadie puede averiguar qué cuentas existen.
 */
export function mensajeErrorLogin(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.estado === 0) {
      return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    }
    if (error.estado === 400 || error.estado === 401 || error.estado === 403) {
      return 'El correo o la contraseña no son correctos, o la cuenta no está habilitada.'
    }
    if (error.estado === 429) {
      return 'Hubo demasiados intentos seguidos. Espera un minuto antes de volver a intentar.'
    }
    if (error.estado === 503) {
      return 'El servicio de inicio de sesión no responde. Inténtalo de nuevo en unos minutos.'
    }
    if (error.estado >= 500) {
      return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
    }
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

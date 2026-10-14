/** Roles definidos en la tabla perfiles (db/migrations/001_esquema_base.sql). */
export type Rol = 'administrador' | 'terapeuta' | 'marketing'

/** Igual que `Usuario` en backend/src/common/types/usuario.ts. */
export interface UsuarioSesion {
  id: string
  nombreCompleto: string
  rol: Rol
}

/** Cuerpo de POST /api/auth/login (backend/src/modules/auth/dto/login.dto.ts). */
export interface CredencialesLogin {
  email: string
  password: string
}

/** Respuesta de POST /api/auth/login y /api/auth/refresh (RespuestaSesion en auth.service.ts). */
export interface RespuestaSesion {
  accessToken: string
  refreshToken: string
  /** Segundos hasta que vence el accessToken. */
  expiresIn: number
  usuario: UsuarioSesion
}

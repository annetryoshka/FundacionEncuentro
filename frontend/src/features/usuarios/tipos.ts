import type { Rol } from '../auth/tipos'

/** Cuenta del personal tal como la devuelve GET /api/usuarios. Nunca incluye contraseñas. */
export interface Usuario {
  id: string
  nombreCompleto: string
  email: string
  rol: Rol
  activo: boolean
  creadoEn: string
}

/** Cuerpo de POST /api/usuarios (mismos nombres que el login del backend: email, password). */
export interface NuevoUsuario {
  nombreCompleto: string
  email: string
  rol: Rol
  password: string
}

export const ROLES: { valor: Rol; nombre: string; descripcion: string }[] = [
  { valor: 'administrador', nombre: 'Dirección', descripcion: 'Ve todas las carpetas y gestiona cuentas.' },
  { valor: 'terapeuta', nombre: 'Terapeuta', descripcion: 'Ve solo las carpetas que tiene asignadas.' },
  { valor: 'marketing', nombre: 'Apoyo / marketing', descripcion: 'Sin acceso a información clínica.' },
]

export const nombreRol = (rol: Rol) => ROLES.find((r) => r.valor === rol)?.nombre ?? rol

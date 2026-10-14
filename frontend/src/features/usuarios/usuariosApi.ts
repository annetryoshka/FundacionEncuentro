import { peticion } from '../../api/cliente'
import type { Rol } from '../auth/tipos'
import type { NuevoUsuario, Usuario } from './tipos'

export async function listarUsuarios(filtros: { rol?: Rol; activo?: boolean } = {}): Promise<Usuario[]> {
  const { usuarios } = await peticion<{ usuarios: Usuario[] }>('/usuarios', { consulta: filtros })
  return usuarios
}

export const listarTerapeutasActivas = () => listarUsuarios({ rol: 'terapeuta', activo: true })

export function crearUsuario(datos: NuevoUsuario): Promise<Usuario> {
  return peticion<Usuario>('/usuarios', { metodo: 'POST', cuerpo: datos })
}

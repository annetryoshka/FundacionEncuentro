import { peticion } from '../../api/cliente'
import type { ActualizacionUsuario, NuevoUsuario, Usuario } from './tipos'

/** Endpoints de backend/src/modules/usuarios (FE-29). Solo administración. */

const porNombre = (a: Usuario, b: Usuario) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')

/** GET /api/usuarios devuelve la lista completa (sin filtros ni paginación). */
export async function listarUsuarios(): Promise<Usuario[]> {
  const usuarios = await peticion<Usuario[]>('/usuarios')
  return [...usuarios].sort(porNombre)
}

/** Para la asignación de casos: el backend no filtra, así que se filtra aquí. */
export async function listarTerapeutasActivas(): Promise<Usuario[]> {
  return (await listarUsuarios()).filter((u) => u.rol === 'terapeuta' && u.activo)
}

export function crearUsuario(datos: NuevoUsuario): Promise<Usuario> {
  return peticion<Usuario>('/usuarios', { metodo: 'POST', cuerpo: datos })
}

/** PATCH /api/usuarios/:id — nombre, rol o activo. */
export function actualizarUsuario(id: string, cambios: ActualizacionUsuario): Promise<Usuario> {
  return peticion<Usuario>(`/usuarios/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: cambios })
}

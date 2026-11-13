import type { CarpetaDetalle } from '../carpetas/tipos'
import type { Persona } from './tipos'

/**
 * Las respuestas de sesiones, tareas, diagnóstico, constancia y pagos traen solo el UUID de quien registró o
 * actualizó. Se muestra el nombre cuando la pantalla ya lo conoce (la propia cuenta, la terapeuta asignada o
 * las personas que aparecen en la carpeta); si no, una descripción neutra en vez de un UUID.
 */
export function crearNombrador(carpeta: CarpetaDetalle | undefined, yo: Persona | null, extra: Persona[] = []) {
  const conocidas = new Map<string, string>()
  for (const p of [carpeta?.creadoPor, carpeta?.asignadoPor, carpeta?.actualizadoPor, carpeta?.terapeuta, ...extra]) {
    if (p) conocidas.set(p.id, p.nombreCompleto)
  }
  if (yo) conocidas.set(yo.id, `${yo.nombreCompleto} (tú)`)

  return (id: string | null | undefined) => (id ? (conocidas.get(id) ?? 'otra cuenta del personal') : 'Sin dato')
}

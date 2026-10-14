import { peticion } from '../../api/cliente'
import type { CarpetaDetalle, CarpetaRegistrada, FiltrosCarpetas, ListadoCarpetas, NuevaCarpeta } from './tipos'

/** Endpoints de backend/src/modules/casos (FE-32). En la interfaz se llaman "carpetas". */

export const TAMANO_PAGINA = 10

export function buscarCarpetas({ q, tipo, estado, pagina }: FiltrosCarpetas): Promise<ListadoCarpetas> {
  return peticion<ListadoCarpetas>('/casos', {
    consulta: {
      q: q?.trim(),
      tipo,
      estado,
      limite: TAMANO_PAGINA,
      desplazamiento: (Math.max(1, pagina) - 1) * TAMANO_PAGINA,
    },
  })
}

export function obtenerCarpeta(id: string): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/casos/${encodeURIComponent(id)}`)
}

/** Registro integral: paciente + carpeta (+ contexto judicial si es derivado) en una sola transacción. */
export function registrarCarpeta(datos: NuevaCarpeta): Promise<CarpetaRegistrada> {
  return peticion<CarpetaRegistrada>('/casos', { metodo: 'POST', cuerpo: datos })
}

/**
 * Reemplaza a la terapeuta responsable (una por caso).
 * PENDIENTE en el backend (FE-37): hoy responde 404 "Cannot PUT" y la pantalla lo avisa.
 */
export function asignarTerapeuta(carpetaId: string, perfilId: string): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/casos/${encodeURIComponent(carpetaId)}/terapeuta`, {
    metodo: 'PUT',
    cuerpo: { perfilId },
  })
}

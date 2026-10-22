import { peticion } from '../../api/cliente'
import type { AltaCarpeta, CarpetaDetalle, NuevaCarpeta, PaginaCarpetas } from './tipos'

export const TAMANO_PAGINA = 10

export function buscarCarpetas(busqueda: string, pagina: number): Promise<PaginaCarpetas> {
  return peticion<PaginaCarpetas>('/carpetas', {
    consulta: { busqueda: busqueda.trim(), pagina, tamano: TAMANO_PAGINA },
  })
}

export function obtenerCarpeta(id: string): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/carpetas/${encodeURIComponent(id)}`)
}

export function registrarCarpeta(datos: NuevaCarpeta): Promise<AltaCarpeta> {
  return peticion<AltaCarpeta>('/casos', {
    metodo: 'POST',
    cuerpo: {
      paciente: { nombreCompleto: datos.nombreCompleto },
      caso: { fechaIngreso: datos.fechaIngreso, tipo: datos.tipo },
    },
  })
}

/** Reemplaza a la terapeuta responsable (una por caso). La anterior pierde el acceso. */
export function asignarTerapeuta(carpetaId: string, perfilId: string): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/carpetas/${encodeURIComponent(carpetaId)}/terapeuta`, {
    metodo: 'PUT',
    cuerpo: { perfilId },
  })
}

/**
 * FE-52: Actualizar los datos básicos del paciente.
 */
export function actualizarDatosPaciente(
  carpetaId: string,
  datos: {
    nombreCompleto: string
    fechaIngreso: string
  },
): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(
    `/carpetas/${encodeURIComponent(carpetaId)}`,
    {
      metodo: 'PATCH',
      cuerpo: datos,
    },
  )
}

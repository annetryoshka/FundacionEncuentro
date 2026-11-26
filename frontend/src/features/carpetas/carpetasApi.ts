import { peticion } from '../../api/cliente'
import type {
  AltaCarpeta,
  AltaConResidencia,
  CarpetaDetalle,
  Clasificacion,
  ClasificacionGuardada,
  DatosEditablesPaciente,
  EstadoCaso,
  EstadoGuardado,
  FiltrosCarpetas,
  PaginaCarpetas,
} from './tipos'

export const TAMANO_PAGINA = 10

/**
 * Listado autorizado con búsqueda y filtros combinados (FE-39, FE-47).
 * El cliente HTTP omite los parámetros vacíos: así «Todos» incluye las carpetas sin clasificar.
 */
export function buscarCarpetas({
  busqueda,
  clasificacion,
  estado,
  residencia,
  pagina,
}: FiltrosCarpetas): Promise<PaginaCarpetas> {
  return peticion<PaginaCarpetas>('/carpetas', {
    consulta: { busqueda: busqueda.trim(), clasificacion, estado, residencia, pagina, tamano: TAMANO_PAGINA },
  })
}

export function obtenerCarpeta(id: string): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/carpetas/${encodeURIComponent(id)}`)
}

/** FE-138: la residencia viaja dentro de `paciente`; sin dato se omite y queda «Sin registrar». */
export function registrarCarpeta(datos: AltaConResidencia): Promise<AltaCarpeta> {
  const residencia = datos.ciudadResidencia
    ? { ciudadResidencia: datos.ciudadResidencia, otraLocalidad: datos.otraLocalidad }
    : {}
  return peticion<AltaCarpeta>('/casos', {
    metodo: 'POST',
    cuerpo: {
      paciente: { nombreCompleto: datos.nombreCompleto, ...residencia },
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
 * FE-52 / FE-138: corrige nombre, fecha de ingreso y residencia del paciente (solo administración).
 * El backend exige nombre y fecha en cada PATCH. La residencia se envía siempre: `null` la deja «Sin registrar».
 * No cambia número, tipo, historial ni asignación.
 */
export function actualizarDatosPaciente(carpetaId: string, datos: DatosEditablesPaciente): Promise<CarpetaDetalle> {
  return peticion<CarpetaDetalle>(`/carpetas/${encodeURIComponent(carpetaId)}`, { metodo: 'PATCH', cuerpo: datos })
}

/** FE-47: guarda la clasificación social/privado. Administración o la terapeuta asignada. */
export function actualizarClasificacion(
  carpetaId: string,
  clasificacion: Clasificacion,
): Promise<ClasificacionGuardada> {
  return peticion<ClasificacionGuardada>(`/carpetas/${encodeURIComponent(carpetaId)}/clasificacion`, {
    metodo: 'PATCH',
    cuerpo: { clasificacion },
  })
}

/** FE-47: guarda el estado del caso. Administración o la terapeuta asignada. */
export function actualizarEstado(carpetaId: string, estado: EstadoCaso): Promise<EstadoGuardado> {
  return peticion<EstadoGuardado>(`/casos/${encodeURIComponent(carpetaId)}/estado`, {
    metodo: 'PATCH',
    cuerpo: { estado },
  })
}

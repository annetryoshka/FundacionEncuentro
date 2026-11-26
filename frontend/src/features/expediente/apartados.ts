import type { NombreIcono } from '../../componentes/iconos'
import type { Rol } from '../auth/tipos'

interface Apartado {
  ruta: string
  nombre: string
  descripcion: string
  icono: NombreIcono
  soloAdministracion?: boolean
  /** FE-153: los informes los genera y revisa solo la terapeuta asignada (la API responde 403 a otros roles). */
  soloTerapeuta?: boolean
}

/**
 * Apartados del expediente, en el orden de la ficha (FE-123 §1): primero el contexto del paciente (familia,
 * genograma y diagnóstico) y después el historial, las sesiones y lo demás.
 * Pagos es solo de administración (FE-81: la terapeuta no ve montos).
 */
export const APARTADOS: Apartado[] = [
  { ruta: 'familia', nombre: 'Familia', descripcion: 'Composición familiar del paciente.', icono: 'personas' },
  { ruta: 'genograma', nombre: 'Genograma', descripcion: 'Genograma exportado de GenoPro.', icono: 'genograma' },
  { ruta: 'diagnostico', nombre: 'Diagnóstico', descripcion: 'Ficha de diagnóstico de ingreso.', icono: 'ficha' },
  { ruta: 'historial', nombre: 'Historial', descripcion: 'Todo el caso en una sola vista.', icono: 'historial' },
  {
    ruta: 'sesiones',
    nombre: 'Sesiones y tareas',
    descripcion: 'Seguimiento de cada sesión y sus tareas.',
    icono: 'calendario',
  },
  {
    ruta: 'constancia',
    nombre: 'Origen y consentimiento',
    descripcion: 'Procedencia y constancia firmada.',
    icono: 'documento',
  },
  {
    ruta: 'informes',
    nombre: 'Informes',
    descripcion: 'Informes sistémicos y judiciales.',
    icono: 'informe',
    soloTerapeuta: true,
  },
  {
    ruta: 'investigacion',
    nombre: 'Investigación',
    descripcion: 'Categorías para el análisis en Atlas.ti.',
    icono: 'etiqueta',
  },
  { ruta: 'pagos', nombre: 'Pagos', descripcion: 'Pagos por sesión.', icono: 'pago', soloAdministracion: true },
]

/** Apartados que ve la cuenta. El backend vuelve a comprobar el rol y la asignación en cada ruta. */
export function apartadosVisibles(tieneRol: (...roles: Rol[]) => boolean) {
  return APARTADOS.filter(
    (a) => (!a.soloAdministracion || tieneRol('administrador')) && (!a.soloTerapeuta || tieneRol('terapeuta')),
  )
}

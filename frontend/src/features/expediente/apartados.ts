import type { NombreIcono } from '../../componentes/iconos'

interface Apartado {
  ruta: string
  nombre: string
  descripcion: string
  icono: NombreIcono
  soloAdministracion?: boolean
}

/** Apartados del expediente. Pagos es solo de administración (FE-81: la terapeuta no ve montos). */
export const APARTADOS: Apartado[] = [
  { ruta: 'historial', nombre: 'Historial', descripcion: 'Todo el caso en una sola vista.', icono: 'historial' },
  {
    ruta: 'constancia',
    nombre: 'Origen y consentimiento',
    descripcion: 'Procedencia y constancia firmada.',
    icono: 'documento',
  },
  { ruta: 'diagnostico', nombre: 'Diagnóstico', descripcion: 'Ficha de diagnóstico de ingreso.', icono: 'ficha' },
  {
    ruta: 'sesiones',
    nombre: 'Sesiones y tareas',
    descripcion: 'Seguimiento de cada sesión y sus tareas.',
    icono: 'calendario',
  },
  { ruta: 'pagos', nombre: 'Pagos', descripcion: 'Pagos por sesión.', icono: 'pago', soloAdministracion: true },
]

interface Apartado {
  ruta: string
  nombre: string
  descripcion: string
  soloAdministracion?: boolean
}

/** Apartados del expediente. Pagos es solo de administración (FE-81: la terapeuta no ve montos). */
export const APARTADOS: Apartado[] = [
  { ruta: 'historial', nombre: 'Historial', descripcion: 'Todo el caso en una sola vista.' },
  { ruta: 'constancia', nombre: 'Origen y consentimiento', descripcion: 'Procedencia y constancia firmada.' },
  { ruta: 'diagnostico', nombre: 'Diagnóstico', descripcion: 'Ficha de diagnóstico de ingreso.' },
  { ruta: 'sesiones', nombre: 'Sesiones y tareas', descripcion: 'Seguimiento de cada sesión y sus tareas.' },
  { ruta: 'pagos', nombre: 'Pagos', descripcion: 'Pagos por sesión.', soloAdministracion: true },
]

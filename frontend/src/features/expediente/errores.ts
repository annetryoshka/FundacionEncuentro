import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'

/** Mensaje tras un guardado fallido. El formulario se conserva para que la persona corrija y reintente. */
export function mensajeNoGuardado(error: unknown): string {
  if (error instanceof ErrorApi) {
    // Una reasignación pudo quitarle el caso a la terapeuta mientras tenía la pantalla abierta.
    if (error.estado === 404) return 'No se guardó: esta carpeta o registro ya no está disponible para tu cuenta.'
    if (error.estado === 400 || error.estado === 409) return `No se guardó: ${error.message}`
  }
  return `No se guardó. ${mensajeErrorGeneral(error)}`
}

/** Texto con contenido real (no solo espacios). */
export const tieneTexto = (valor: string) => valor.trim().length > 0

export const LIMITE_TEXTO_LARGO = 10_000

/** Lleva el foco al primer campo con error del formulario (en un grupo de opciones, a su primera opción). */
export function enfocarPrimerError(formulario: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    const invalido = formulario?.querySelector<HTMLElement>('[aria-invalid="true"]')
    const destino = invalido?.matches('input, select, textarea') ? invalido : invalido?.querySelector('input')
    destino?.focus()
  })
}

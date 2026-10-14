/** Campos del formulario (en la API se envían como email y password). */
export interface FormularioLogin {
  correo: string
  contrasena: string
}

export type ErroresLogin = Partial<Record<keyof FormularioLogin, string>>

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validación del lado del cliente: solo evita peticiones vacías o mal formadas.
 * La contraseña no se valida por longitud ni formato: en el login eso
 * revelaría la política de contraseñas y no aporta nada.
 */
export function validarLogin({ correo, contrasena }: FormularioLogin): ErroresLogin {
  const errores: ErroresLogin = {}
  const correoLimpio = correo.trim()

  if (!correoLimpio) {
    errores.correo = 'Escribe tu correo electrónico.'
  } else if (!FORMATO_CORREO.test(correoLimpio)) {
    errores.correo = 'Revisa el correo: debe tener la forma nombre@dominio.com.'
  }

  if (!contrasena) {
    errores.contrasena = 'Escribe tu contraseña.'
  }

  return errores
}

export const hayErrores = (errores: ErroresLogin) => Object.keys(errores).length > 0

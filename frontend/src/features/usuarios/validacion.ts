/** Campos del formulario de nueva cuenta (en la API van como email y password). */
export interface FormularioUsuario {
  nombreCompleto: string
  correo: string
  rol: string
  contrasenaInicial: string
}

export type ErroresUsuario = Partial<Record<keyof FormularioUsuario, string>>

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const LARGO_MINIMO_CONTRASENA = 8

export function validarNuevoUsuario(datos: FormularioUsuario): ErroresUsuario {
  const errores: ErroresUsuario = {}
  const nombre = datos.nombreCompleto.trim()
  const correo = datos.correo.trim()
  const contrasena = datos.contrasenaInicial

  if (!nombre) errores.nombreCompleto = 'Escribe el nombre completo.'
  else if (nombre.length < 3) errores.nombreCompleto = 'El nombre es demasiado corto.'

  if (!correo) errores.correo = 'Escribe el correo electrónico.'
  else if (!FORMATO_CORREO.test(correo)) errores.correo = 'Revisa el correo: debe tener la forma nombre@dominio.com.'

  if (!datos.rol) errores.rol = 'Elige el rol de la cuenta.'

  if (!contrasena) {
    errores.contrasenaInicial = 'Escribe o genera una contraseña inicial.'
  } else if (contrasena.length < LARGO_MINIMO_CONTRASENA || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    errores.contrasenaInicial = `Usa al menos ${LARGO_MINIMO_CONTRASENA} caracteres, con letras y números.`
  }

  return errores
}

/** Contraseña inicial aleatoria y legible (sin 0/O ni 1/l para dictarla sin confusiones). */
export function generarContrasena(largo = 12): string {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  const todos = letras + numeros
  const azar = crypto.getRandomValues(new Uint32Array(largo))
  const caracteres = Array.from(azar, (n) => todos[n % todos.length])
  // Garantiza al menos una letra y un número.
  caracteres[0] = letras[azar[0] % letras.length]
  caracteres[largo - 1] = numeros[azar[largo - 1] % numeros.length]
  return caracteres.join('')
}

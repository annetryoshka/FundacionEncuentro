import { describe, expect, it } from 'vitest'
import { hayErrores, validarLogin } from './validacion'

describe('validarLogin', () => {
  it('acepta un correo y una contraseña válidos', () => {
    expect(validarLogin({ correo: 'kathia@fundacion.org', contrasena: 'x' })).toEqual({})
  })

  it('exige correo y contraseña', () => {
    const errores = validarLogin({ correo: '   ', contrasena: '' })
    expect(errores.correo).toBe('Escribe tu correo electrónico.')
    expect(errores.contrasena).toBe('Escribe tu contraseña.')
    expect(hayErrores(errores)).toBe(true)
  })

  it.each(['kathia', 'kathia@', 'kathia@fundacion', '@fundacion.org', 'ka thia@fundacion.org'])(
    'rechaza el correo mal formado "%s"',
    (correo) => {
      expect(validarLogin({ correo, contrasena: 'x' }).correo).toMatch(/nombre@dominio/)
    },
  )

  it('ignora espacios al inicio y al final del correo', () => {
    expect(validarLogin({ correo: '  kathia@fundacion.org ', contrasena: 'x' })).toEqual({})
  })

  it('no impone reglas de longitud a la contraseña en el login', () => {
    expect(validarLogin({ correo: 'a@b.co', contrasena: '1' }).contrasena).toBeUndefined()
  })
})

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configurarSesionApi, descartarPeticionesPrivadas } from '../../api/cliente'
import { cerrarSesionEnServidor, renovarSesion } from './authApi'
import { ContextoSesion, type EstadoSesion } from './sesion'
import type { RespuestaSesion, Rol, UsuarioSesion } from './tipos'

/** Propuesta de FE-20, pendiente de confirmar con la fundación. */
export const MINUTOS_INACTIVIDAD = 30
const AVISO_VENCIDA = 'Tu sesión terminó. Vuelve a iniciar sesión.'
const AVISO_INACTIVIDAD = `Cerramos tu sesión tras ${MINUTOS_INACTIVIDAD} minutos sin actividad, para proteger la información.`
/** El refresh token vive solo en esta pestaña: se borra al cerrarla. */
const CLAVE_REFRESH = 'fundacion-encuentro:refresh'
/** Se renueva el token un minuto antes de que venza. */
const MARGEN_RENOVACION_MS = 60_000

const leerRefresh = () => {
  try {
    return sessionStorage.getItem(CLAVE_REFRESH)
  } catch {
    return null
  }
}
const guardarRefresh = (valor: string | null) => {
  try {
    if (valor) sessionStorage.setItem(CLAVE_REFRESH, valor)
    else sessionStorage.removeItem(CLAVE_REFRESH)
  } catch {
    // Almacenamiento bloqueado: la sesión dura solo mientras la página esté abierta.
  }
}

/**
 * Sesión contra el backend real (módulo auth de NestJS + Supabase Auth):
 * - El accessToken vive solo en memoria; el refreshToken en sessionStorage de la pestaña.
 * - Al recargar, recupera la sesión con POST /auth/refresh.
 * - Si el token vence, lo renueva (antes de que venza, o al recibir un 401).
 * - Cierra la sesión tras MINUTOS_INACTIVIDAD sin actividad (FE-20).
 * - Cerrar sesión llama a POST /auth/logout (FE-26) y borra todo el estado privado (FE-24).
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [recuperando, setRecuperando] = useState(() => leerRefresh() !== null)
  const [avisoSalida, setAvisoSalida] = useState<string | null>(null)
  const [venceEn, setVenceEn] = useState<number | null>(null)

  const accessToken = useRef<string | null>(null)
  const renovacionEnCurso = useRef<Promise<string | null> | null>(null)
  const generacion = useRef(0)

  const limpiar = useCallback((aviso: string | null) => {
    generacion.current++
    renovacionEnCurso.current = null
    descartarPeticionesPrivadas()
    setRecuperando(false)
    accessToken.current = null
    guardarRefresh(null)
    setUsuario(null)
    setVenceEn(null)
    setAvisoSalida(aviso)
  }, [])

  const guardarSesion = useCallback((respuesta: RespuestaSesion) => {
    accessToken.current = respuesta.accessToken
    guardarRefresh(respuesta.refreshToken)
    setUsuario(respuesta.usuario)
    setVenceEn(Date.now() + respuesta.expiresIn * 1000)
    setAvisoSalida(null)
  }, [])

  /** Una sola renovación a la vez, aunque varias peticiones reciban 401 juntas. */
  const renovar = useCallback((): Promise<string | null> => {
    if (renovacionEnCurso.current) return renovacionEnCurso.current
    const refresh = leerRefresh()
    if (!refresh) return Promise.resolve(null)
    const actual = generacion.current
    const pendiente = renovarSesion(refresh)
      .then((respuesta) => {
        if (actual !== generacion.current) return null
        guardarSesion(respuesta)
        return respuesta.accessToken
      })
      .catch(() => null)
      .finally(() => {
        if (renovacionEnCurso.current === pendiente) renovacionEnCurso.current = null
      })
    renovacionEnCurso.current = pendiente
    return pendiente
  }, [guardarSesion])

  const salir = useCallback(async (aviso: string | null) => {
    const token = accessToken.current
    limpiar(aviso ?? 'Sesión cerrada en este dispositivo. Revocación en el servidor pendiente de confirmar.')
    const actual = generacion.current
    try {
      if (!token) throw new Error('Sin token para confirmar la revocación')
      await cerrarSesionEnServidor(token)
      if (actual === generacion.current && !accessToken.current) setAvisoSalida(aviso)
    } catch {
      if (actual === generacion.current && !accessToken.current) {
        setAvisoSalida(`${aviso ? aviso + ' ' : ''}Sesión cerrada en este dispositivo. No se pudo confirmar la revocación en el servidor.`)
      }
    }
  }, [limpiar])
  const cerrarSesion = useCallback(() => salir(null), [salir])

  // El cliente HTTP usa este token, lo renueva ante un 401 y nos avisa si ya no sirve.
  useEffect(() => {
    configurarSesionApi({
      token: () => accessToken.current,
      renovar,
      invalidar: () => limpiar(AVISO_VENCIDA),
    })
    return () => configurarSesionApi(null)
  }, [renovar, limpiar])

  // Al abrir o recargar: recuperar la sesión de esta pestaña, si la hay.
  useEffect(() => {
    if (!recuperando) return
    const actual = generacion.current
    renovar().then((token) => {
      if (actual !== generacion.current) return
      if (!token && leerRefresh()) limpiar(null)
      setRecuperando(false)
    })
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Renovar un minuto antes de que venza el token.
  useEffect(() => {
    if (!venceEn) return
    const espera = Math.max(0, venceEn - Date.now() - MARGEN_RENOVACION_MS)
    const temporizador = setTimeout(() => {
      const actual = generacion.current
      renovar().then((token) => {
        if (actual !== generacion.current) return
        if (!token && leerRefresh()) limpiar(AVISO_VENCIDA)
      })
    }, espera)
    return () => clearTimeout(temporizador)
  }, [venceEn, renovar, limpiar])

  // Cierre por inactividad.
  useEffect(() => {
    if (!usuario) return
    let ultimaActividad = Date.now()
    const registrar = () => {
      ultimaActividad = Date.now()
    }
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach((e) => window.addEventListener(e, registrar, { passive: true }))
    const revisar = setInterval(() => {
      if (Date.now() - ultimaActividad >= MINUTOS_INACTIVIDAD * 60_000) {
        clearInterval(revisar) // un solo cierre, aunque el logout tarde en responder
        void salir(AVISO_INACTIVIDAD)
      }
    }, 30_000)
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, registrar))
      clearInterval(revisar)
    }
  }, [usuario, salir])

  const tieneRol = useCallback((...roles: Rol[]) => !!usuario && roles.includes(usuario.rol), [usuario])

  const valor = useMemo<EstadoSesion>(
    () => ({ usuario, recuperando, avisoSalida, guardarSesion, cerrarSesion, tieneRol }),
    [usuario, recuperando, avisoSalida, guardarSesion, cerrarSesion, tieneRol],
  )

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}

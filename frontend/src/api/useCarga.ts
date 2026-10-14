import { useCallback, useEffect, useState, type DependencyList } from 'react'

interface EstadoCarga<T> {
  datos: T | undefined
  error: unknown
  cargando: boolean
}

/**
 * Carga datos al montar y cada vez que cambian `deps`. Ignora respuestas que llegan
 * tarde (p. ej. si la persona cambió de búsqueda antes de que respondiera la anterior).
 */
export function useCarga<T>(cargar: () => Promise<T>, deps: DependencyList) {
  const [estado, setEstado] = useState<EstadoCarga<T>>({ datos: undefined, error: undefined, cargando: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    setEstado((previo) => ({ ...previo, cargando: true, error: undefined }))
    cargar().then(
      (datos) => vigente && setEstado({ datos, error: undefined, cargando: false }),
      (error: unknown) => vigente && setEstado((previo) => ({ ...previo, error, cargando: false })),
    )
    return () => {
      vigente = false
    }
    // `cargar` cambia en cada render; las dependencias reales las declara quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { ...estado, recargar }
}

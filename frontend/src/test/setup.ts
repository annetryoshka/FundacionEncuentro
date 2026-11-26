import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  // La sesión (refresh token) vive en sessionStorage: cada prueba empieza sin sesión.
  sessionStorage.clear()
  localStorage.clear()
})

// jsdom no implementa URL.createObjectURL (visor del genograma, descargas): se usa una URL ficticia.
if (!URL.createObjectURL) {
  let n = 0
  URL.createObjectURL = () => `blob:prueba/${++n}`
  URL.revokeObjectURL = () => undefined
}

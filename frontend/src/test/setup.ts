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

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    // npm run dev:simulado → API simulada en el navegador, sin backend (ver src/api/simulado/).
    define:
      mode === 'simulado' ? { 'import.meta.env.VITE_API_SIMULADA': JSON.stringify('true') } : undefined,
    server: {
      port: 5173,
      // En desarrollo, /api se reenvía al backend NestJS: así no hay problemas de CORS.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: [...configDefaults.exclude],
      css: false,
    },
  }
})

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_SIMULADA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

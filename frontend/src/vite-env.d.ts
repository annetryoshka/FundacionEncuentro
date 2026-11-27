/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_SIMULADA?: string
  /** FE-149: carpeta pública de las imágenes de difusión (por defecto /imagenes/difusion/). */
  readonly VITE_DIFUSION_IMAGENES_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

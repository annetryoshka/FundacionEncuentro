import { useState } from 'react'
import type { ImagenPublicacion } from './publicaciones'

/**
 * Imagen de una tarjeta pública. Si no carga, el texto de la tarjeta se conserva y se avisa
 * con claridad en lugar de dejar un hueco o un ícono roto (contrato FE-140, criterio 5).
 */
export function ImagenPublica({ imagen }: { imagen: ImagenPublicacion }) {
  // Se recuerda qué URL falló: en la vista previa del editor la imagen cambia y debe volver a intentarse.
  const [fallida, setFallida] = useState<string | null>(null)
  if (fallida === imagen.url) {
    return (
      <p className="flex h-40 items-center justify-center bg-crema px-4 text-center text-sm text-suave">
        La imagen no está disponible por ahora.
      </p>
    )
  }
  return (
    <img
      src={imagen.url}
      alt={imagen.textoAlternativo}
      loading="lazy"
      onError={() => setFallida(imagen.url)}
      className="h-40 w-full object-cover"
    />
  )
}

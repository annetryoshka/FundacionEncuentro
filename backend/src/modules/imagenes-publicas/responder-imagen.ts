import { StreamableFile } from '@nestjs/common';
import type { ArchivoImagen } from './imagenes-publicas.service.js';

export interface PeticionImagen {
  headers: Record<string, string | string[] | undefined>;
}
export interface RespuestaImagen {
  setHeader(nombre: string, valor: string): unknown;
  status(codigo: number): unknown;
}

/**
 * El navegador la guarda, pero pregunta cada vez con el ETag (304 si no cambió): una imagen quitada,
 * reemplazada o de algo retirado deja de verse enseguida, por ejemplo si se subió una foto por error.
 */
export const CACHE_PUBLICA = 'public, no-cache';
export const CACHE_PRIVADA = 'private, no-store';

/**
 * Envía la imagen con su tipo real y un ETag (sha256); si el navegador ya la tiene, responde 304.
 * Cross-Origin-Resource-Policy: cross-origin deja mostrarla aunque el portal esté en otro dominio que la API
 * (helmet pone same-origin por defecto).
 */
export function responderImagen(
  peticion: PeticionImagen,
  respuesta: RespuestaImagen,
  imagen: ArchivoImagen,
  cache: string,
): StreamableFile | undefined {
  const etiqueta = `"${imagen.sha256}"`;
  respuesta.setHeader('Cache-Control', cache);
  respuesta.setHeader('ETag', etiqueta);
  respuesta.setHeader('X-Content-Type-Options', 'nosniff');
  respuesta.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (cache === CACHE_PUBLICA && peticion.headers['if-none-match'] === etiqueta) {
    respuesta.status(304);
    return undefined;
  }
  return new StreamableFile(imagen.contenido, {
    type: imagen.tipoMime,
    length: imagen.contenido.length,
    disposition: 'inline',
  });
}

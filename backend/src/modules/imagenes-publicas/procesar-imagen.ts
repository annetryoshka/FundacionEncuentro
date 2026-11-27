import {
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';

/** Lo que se acepta al subir: una foto de celular puede pesar varios MB. */
export const MAX_BYTES_ENTRADA = 15 * 1024 * 1024;
/** Lado mayor de la imagen guardada. */
export const LADO_MAXIMO = 1600;
export const LADO_MINIMO = 200;
/** Más píxeles que esto no se decodifica (protege la memoria del servidor). */
const MAX_PIXELES = 50_000_000;
/** Igual que el check de imagenes_publicas (024). */
const MAX_BYTES_GUARDADOS = 3 * 1024 * 1024;

export type FormatoEntrada = 'jpeg' | 'png' | 'webp';

export interface ImagenProcesada {
  contenido: Buffer;
  tipoMime: 'image/webp';
  ancho: number;
  alto: number;
}

const FORMATOS_ACEPTADOS = 'JPEG, PNG o WebP';

/** Reconoce el formato por sus primeros bytes, no por el nombre ni por lo que declara el navegador. */
export function detectarFormato(datos: Buffer): FormatoEntrada | 'heic' | null {
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'jpeg';
  if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (datos.length >= 16 && datos.toString('latin1', 0, 4) === 'RIFF' && datos.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (datos.length >= 12 && datos.toString('latin1', 4, 8) === 'ftyp') {
    const marca = datos.toString('latin1', 8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(marca)) return 'heic';
  }
  return null;
}

/** Ancho y alto declarados en la cabecera, antes de decodificar. null si la cabecera no se entiende. */
export function leerDimensiones(datos: Buffer, formato: FormatoEntrada): { ancho: number; alto: number } | null {
  try {
    if (formato === 'png') {
      if (datos.toString('latin1', 12, 16) !== 'IHDR') return null;
      return { ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) };
    }
    if (formato === 'webp') {
      const fragmento = datos.toString('latin1', 12, 16);
      if (fragmento === 'VP8X') return { ancho: 1 + datos.readUIntLE(24, 3), alto: 1 + datos.readUIntLE(27, 3) };
      if (fragmento === 'VP8 ') return { ancho: datos.readUInt16LE(26) & 0x3fff, alto: datos.readUInt16LE(28) & 0x3fff };
      if (fragmento === 'VP8L') {
        const [b0, b1, b2, b3] = datos.subarray(21, 25);
        return { ancho: 1 + (((b1 & 0x3f) << 8) | b0), alto: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      return null;
    }
    // JPEG: se recorren los segmentos hasta el marcador SOF, que trae las medidas.
    let i = 2;
    while (i + 9 < datos.length) {
      if (datos[i] !== 0xff) return null;
      const marcador = datos[i + 1];
      if (marcador === 0xff) {
        i += 1;
        continue;
      }
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { alto: datos.readUInt16BE(i + 5), ancho: datos.readUInt16BE(i + 7) };
      }
      if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + datos.readUInt16BE(i + 2);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Valida la imagen subida y la deja lista para el portal: respeta la orientación de la foto,
 * la reduce a LADO_MAXIMO, la convierte a WebP y descarta los metadatos (EXIF, ubicación GPS).
 */
export async function procesarImagenPublica(datos: Buffer | undefined): Promise<ImagenProcesada> {
  if (!datos?.length) throw new BadRequestException('Elige una imagen para subir');
  if (datos.length > MAX_BYTES_ENTRADA) {
    throw new PayloadTooLargeException('La imagen pesa más de 15 MB. Elige una más liviana.');
  }

  const formato = detectarFormato(datos);
  if (formato === 'heic') {
    throw new UnsupportedMediaTypeException(
      `Las fotos HEIC del iPhone no se pueden usar. Guárdala como JPEG o elige una imagen ${FORMATOS_ACEPTADOS}.`,
    );
  }
  if (!formato) throw new UnsupportedMediaTypeException(`El archivo no es una imagen ${FORMATOS_ACEPTADOS}`);

  const declaradas = leerDimensiones(datos, formato);
  if (!declaradas || !declaradas.ancho || !declaradas.alto) {
    throw new UnprocessableEntityException('No pudimos leer esta imagen. Prueba con otra.');
  }
  if (declaradas.ancho * declaradas.alto > MAX_PIXELES) {
    throw new UnprocessableEntityException('La imagen es demasiado grande en píxeles. Prueba con una más pequeña.');
  }

  let imagen: Awaited<ReturnType<typeof loadImage>>;
  try {
    imagen = await loadImage(datos);
  } catch {
    throw new UnprocessableEntityException('No pudimos leer esta imagen. Prueba con otra.');
  }

  // width/height ya vienen girados según la orientación EXIF de la foto.
  const { width, height } = imagen;
  if (Math.min(width, height) < LADO_MINIMO) {
    throw new UnprocessableEntityException(
      `La imagen es muy pequeña (${width}×${height} píxeles). Usa una de al menos ${LADO_MINIMO} píxeles por lado.`,
    );
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(width, height));
  const ancho = Math.max(1, Math.round(width * escala));
  const alto = Math.max(1, Math.round(height * escala));
  const lienzo = createCanvas(ancho, alto);
  const contexto = lienzo.getContext('2d');
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  let contenido = await lienzo.encode('webp', 82);
  if (contenido.length > MAX_BYTES_GUARDADOS) contenido = await lienzo.encode('webp', 60);
  if (contenido.length > MAX_BYTES_GUARDADOS) {
    throw new UnprocessableEntityException('No pudimos reducir esta imagen lo suficiente. Prueba con otra.');
  }

  return { contenido, tipoMime: 'image/webp', ancho, alto };
}

import {
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import {
  LADO_MAXIMO,
  MAX_BYTES_ENTRADA,
  detectarFormato,
  leerDimensiones,
  procesarImagenPublica,
} from '../procesar-imagen.js';

/** Mitad izquierda roja y derecha azul: permite ver si la foto se giró. */
function dibujar(ancho: number, alto: number) {
  const lienzo = createCanvas(ancho, alto);
  const c = lienzo.getContext('2d');
  c.fillStyle = '#ff0000';
  c.fillRect(0, 0, ancho / 2, alto);
  c.fillStyle = '#0000ff';
  c.fillRect(ancho / 2, 0, ancho / 2, alto);
  return lienzo;
}

/** Segmento APP1 EXIF con orientación y una descripción que simula datos privados (p. ej. GPS). */
function exif(orientacion: number, descripcion: string) {
  const texto = Buffer.from(`${descripcion}\0`, 'latin1');
  const ifd = Buffer.alloc(2 + 2 * 12 + 4);
  ifd.writeUInt16BE(2, 0);
  ifd.writeUInt16BE(0x010e, 2);
  ifd.writeUInt16BE(2, 4);
  ifd.writeUInt32BE(texto.length, 6);
  ifd.writeUInt32BE(8 + ifd.length, 10);
  ifd.writeUInt16BE(0x0112, 14);
  ifd.writeUInt16BE(3, 16);
  ifd.writeUInt32BE(1, 18);
  ifd.writeUInt16BE(orientacion, 22);
  const tiff = Buffer.concat([Buffer.from('MM\0*', 'latin1'), Buffer.from([0, 0, 0, 8]), ifd, texto]);
  const cuerpo = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const cabecera = Buffer.alloc(4);
  cabecera.writeUInt16BE(0xffe1, 0);
  cabecera.writeUInt16BE(cuerpo.length + 2, 2);
  return Buffer.concat([cabecera, cuerpo]);
}

const conExif = (jpeg: Buffer, orientacion: number, descripcion: string) =>
  Buffer.concat([jpeg.subarray(0, 2), exif(orientacion, descripcion), jpeg.subarray(2)]);

async function pixel(webp: Buffer, x: number, y: number) {
  const imagen = await loadImage(webp);
  const lienzo = createCanvas(imagen.width, imagen.height);
  const c = lienzo.getContext('2d');
  c.drawImage(imagen, 0, 0);
  return [...c.getImageData(x, y, 1, 1).data];
}

describe('imágenes del portal: procesar la imagen subida', () => {
  it('reconoce el formato por sus bytes', () => {
    expect(detectarFormato(dibujar(10, 10).encodeSync('jpeg', 90))).toBe('jpeg');
    expect(detectarFormato(dibujar(10, 10).encodeSync('png'))).toBe('png');
    expect(detectarFormato(dibujar(10, 10).encodeSync('webp', 80))).toBe('webp');
    expect(detectarFormato(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0', 'latin1'))).toBe('heic');
    expect(detectarFormato(Buffer.from('GIF89a......', 'latin1'))).toBeNull();
    expect(detectarFormato(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it.each([
    ['jpeg', () => dibujar(321, 207).encodeSync('jpeg', 90)],
    ['png', () => dibujar(321, 207).encodeSync('png')],
    ['webp con pérdida', () => dibujar(321, 207).encodeSync('webp', 80)],
    ['webp sin pérdida', () => dibujar(321, 207).encodeSync('webp', 100)],
  ] as const)('lee las medidas de la cabecera: %s', (formato, crear) => {
    const datos = crear();
    expect(leerDimensiones(datos, detectarFormato(datos) as 'jpeg')).toEqual({ ancho: 321, alto: 207 });
  });

  it('gira la foto según su EXIF, la guarda como WebP y descarta los metadatos', async () => {
    const original = conExif(dibujar(400, 200).encodeSync('jpeg', 90), 6, 'GPS -16.5000 -68.1500');
    expect(original.includes('GPS -16.5000')).toBe(true);

    const r = await procesarImagenPublica(original);

    expect(r.tipoMime).toBe('image/webp');
    expect(detectarFormato(r.contenido)).toBe('webp');
    expect({ ancho: r.ancho, alto: r.alto }).toEqual({ ancho: 200, alto: 400 });
    expect(r.contenido.includes('GPS -16.5000')).toBe(false);
    expect(r.contenido.includes('Exif')).toBe(false);
    expect(r.contenido.includes('EXIF')).toBe(false);
    // Orientación 6 = 90° a la derecha: la mitad izquierda (roja) queda arriba.
    const arriba = await pixel(r.contenido, 100, 20);
    const abajo = await pixel(r.contenido, 100, 380);
    expect(arriba[0]).toBeGreaterThan(200);
    expect(abajo[2]).toBeGreaterThan(200);
  });

  it(`reduce la imagen grande a ${LADO_MAXIMO} px en su lado mayor`, async () => {
    const r = await procesarImagenPublica(dibujar(3200, 1600).encodeSync('png'));
    expect({ ancho: r.ancho, alto: r.alto }).toEqual({ ancho: LADO_MAXIMO, alto: 800 });
    expect(await loadImage(r.contenido)).toMatchObject({ width: LADO_MAXIMO, height: 800 });
  });

  it('una imagen pequeña que cumple el mínimo no se agranda', async () => {
    const r = await procesarImagenPublica(dibujar(300, 200).encodeSync('webp', 90));
    expect({ ancho: r.ancho, alto: r.alto }).toEqual({ ancho: 300, alto: 200 });
  });

  it.each([
    ['sin archivo', undefined, BadRequestException],
    ['vacío', Buffer.alloc(0), BadRequestException],
    ['más de 15 MB', Buffer.alloc(MAX_BYTES_ENTRADA + 1, 0xff), PayloadTooLargeException],
    ['HEIC', Buffer.from('\0\0\0\x18ftypheic\0\0\0\0', 'latin1'), UnsupportedMediaTypeException],
    ['GIF', Buffer.from('GIF89a\x01\0\x01\0', 'latin1'), UnsupportedMediaTypeException],
    ['un PDF con nombre .jpg', Buffer.from('%PDF-1.7\n'), UnsupportedMediaTypeException],
    ['JPEG cortado', dibujar(400, 300).encodeSync('jpeg', 90).subarray(0, 40), UnprocessableEntityException],
  ])('rechaza %s', async (_n, datos, clase) => {
    await expect(procesarImagenPublica(datos as Buffer | undefined)).rejects.toBeInstanceOf(clase);
  });

  it('HEIC explica qué hacer', async () => {
    await expect(procesarImagenPublica(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0', 'latin1'))).rejects.toThrow(/iPhone/);
  });

  it('rechaza una imagen muy pequeña con sus medidas en el mensaje', async () => {
    await expect(procesarImagenPublica(dibujar(150, 300).encodeSync('png'))).rejects.toThrow(/150×300/);
  });

  it('no decodifica una imagen que declara demasiados píxeles', async () => {
    const png = dibujar(300, 300).encodeSync('png');
    png.writeUInt32BE(20_000, 16);
    png.writeUInt32BE(20_000, 20);
    await expect(procesarImagenPublica(png)).rejects.toThrow(/demasiado grande en píxeles/);
  });
});

import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

const FORMATOS = [
  { tipo: 'application/pdf', firma: Buffer.from('%PDF-', 'ascii') },
  { tipo: 'image/png', firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { tipo: 'image/jpeg', firma: Buffer.from([0xff, 0xd8, 0xff]) },
];

export function validarArchivoGenograma(
  contenido: Buffer | undefined,
  tipoDeclarado: string,
  maxBytes: number,
): { tipo: string; tamanio: number } {
  if (!contenido?.length) {
    throw new BadRequestException('Adjunta un archivo de genograma');
  }

  if (contenido.length > maxBytes) {
    throw new PayloadTooLargeException('El archivo supera el tamaño permitido');
  }

  const formato = FORMATOS.find(({ firma }) =>
    contenido.subarray(0, firma.length).equals(firma),
  );

  if (!formato || formato.tipo !== tipoDeclarado) {
    throw new UnsupportedMediaTypeException('El archivo debe ser PDF, PNG o JPEG');
  }

  return { tipo: formato.tipo, tamanio: contenido.length };
}
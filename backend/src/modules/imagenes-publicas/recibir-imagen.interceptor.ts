import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_BYTES_ENTRADA } from './procesar-imagen.js';

/** El archivo tal como llega de multer. */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

const Base = FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_ENTRADA, files: 1, fields: 5 } });

/** Recibe el campo `archivo` y traduce los errores de multer, que llegan en inglés. */
@Injectable()
export class RecibirImagenInterceptor extends Base {
  async intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    try {
      return await super.intercept(contexto, siguiente);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException('La imagen pesa más de 15 MB. Elige una más liviana.');
      }
      if (error instanceof BadRequestException) {
        throw new BadRequestException('Envía una sola imagen en el campo «archivo»');
      }
      throw error;
    }
  }
}

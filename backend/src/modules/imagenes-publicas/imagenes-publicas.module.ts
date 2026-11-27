import { Module } from '@nestjs/common';
import { ImagenesPublicasController } from './imagenes-publicas.controller.js';
import { ImagenesPublicasService } from './imagenes-publicas.service.js';

/** Imágenes del portal (024). Las suben difusión y artículos; el público las lee desde aquí. */
@Module({
  controllers: [ImagenesPublicasController],
  providers: [ImagenesPublicasService],
  exports: [ImagenesPublicasService],
})
export class ImagenesPublicasModule {}

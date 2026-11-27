import { Module } from '@nestjs/common';
import { ImagenesPublicasModule } from '../imagenes-publicas/imagenes-publicas.module.js';
import { ArticulosAdminController, ArticulosPublicosController } from './articulos.controller.js';
import { ArticulosService } from './articulos.service.js';

@Module({
  imports: [ImagenesPublicasModule],
  controllers: [ArticulosAdminController, ArticulosPublicosController],
  providers: [ArticulosService],
})
export class ArticulosModule {}

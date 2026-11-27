import { Module } from '@nestjs/common';
import { ArticulosAdminController, ArticulosPublicosController } from './articulos.controller.js';
import { ArticulosService } from './articulos.service.js';

@Module({
  controllers: [ArticulosAdminController, ArticulosPublicosController],
  providers: [ArticulosService],
})
export class ArticulosModule {}

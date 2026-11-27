import { Module } from '@nestjs/common';
import { ImagenesPublicasModule } from '../imagenes-publicas/imagenes-publicas.module.js';
import { DifusionAdminController } from './difusion-admin.controller.js';
import { DifusionPublicaController } from './difusion-publica.controller.js';
import { DifusionService } from './difusion.service.js';

@Module({
  imports: [ImagenesPublicasModule],
  controllers: [DifusionPublicaController, DifusionAdminController],
  providers: [DifusionService],
})
export class DifusionModule {}

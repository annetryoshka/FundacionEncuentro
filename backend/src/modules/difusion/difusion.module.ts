import { Module } from '@nestjs/common';
import { DifusionAdminController } from './difusion-admin.controller.js';
import { DifusionPublicaController } from './difusion-publica.controller.js';
import { DifusionService } from './difusion.service.js';

@Module({
  controllers: [DifusionPublicaController, DifusionAdminController],
  providers: [DifusionService],
})
export class DifusionModule {}
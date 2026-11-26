import { Module } from '@nestjs/common';
import { CasosModule } from '../casos/casos.module.js';
import { InformesController } from './informes.controller.js';
import { InformesService } from './informes.service.js';

@Module({
  imports: [CasosModule],
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
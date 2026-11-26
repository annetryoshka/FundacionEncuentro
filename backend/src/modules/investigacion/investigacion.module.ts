import { Module } from '@nestjs/common';
import { InvestigacionController } from './investigacion.controller.js';
import { InvestigacionService } from './investigacion.service.js';

@Module({
  controllers: [InvestigacionController],
  providers: [InvestigacionService],
})
export class InvestigacionModule {}
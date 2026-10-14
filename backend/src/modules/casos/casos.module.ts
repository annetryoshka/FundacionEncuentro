import { Module } from '@nestjs/common';
import { CasosController } from './casos.controller.js';
import { CasosService } from './casos.service.js';

@Module({
  controllers: [CasosController],
  providers: [CasosService],
})
export class CasosModule {}

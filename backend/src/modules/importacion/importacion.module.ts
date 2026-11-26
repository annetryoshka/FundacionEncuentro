import { Module } from '@nestjs/common';
import { ImportacionController } from './importacion.controller.js';
import { ImportacionService } from './importacion.service.js';

@Module({
  controllers: [ImportacionController],
  providers: [ImportacionService],
})
export class ImportacionModule {}
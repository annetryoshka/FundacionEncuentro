import { Module } from '@nestjs/common';
import { ExportacionesAlmacenService } from './exportaciones-almacen.service.js';
import { ExportacionesRegistroService } from './exportaciones-registro.service.js';
import { ExportacionesController } from './exportaciones.controller.js';
import { ExportacionesService } from './exportaciones.service.js';
import { GenerarExportacionService } from './generar-exportacion.service.js';

@Module({
  controllers: [ExportacionesController],
  providers: [
    ExportacionesService,
    ExportacionesRegistroService,
    ExportacionesAlmacenService,
    GenerarExportacionService,
  ],
})
export class ExportacionesModule {}
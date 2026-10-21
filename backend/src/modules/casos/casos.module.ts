import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller.js';
import { AsignacionesService } from './asignaciones.service.js';
import { CasosController } from './casos.controller.js';
import { CasosService } from './casos.service.js';
import { EditarPacienteController } from './editar-paciente.controller.js';

@Module({
  controllers: [CasosController, EditarPacienteController, AsignacionesController],
  providers: [CasosService, AsignacionesService],
})
export class CasosModule {}

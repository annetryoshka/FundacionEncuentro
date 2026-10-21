import { Module } from '@nestjs/common';
import { CasosController } from './casos.controller.js';
import { CasosService } from './casos.service.js';
import { EditarPacienteController } from './editar-paciente.controller.js';

@Module({
  controllers: [CasosController, EditarPacienteController],
  providers: [CasosService],
})
export class CasosModule {}

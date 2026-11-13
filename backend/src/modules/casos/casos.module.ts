import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller.js';
import { AsignacionesService } from './asignaciones.service.js';
import { CasosController } from './casos.controller.js';
import { CasosService } from './casos.service.js';
import { EditarPacienteController } from './editar-paciente.controller.js';
import { CarpetasController } from './carpetas.controller.js';
import { DiagnosticoController } from './diagnostico.controller.js';
import { DiagnosticoService } from './diagnostico.service.js';

@Module({
  controllers: [
    CasosController,
    EditarPacienteController,
    AsignacionesController,
    CarpetasController,
    DiagnosticoController,
  ],
  providers: [
    CasosService,
    AsignacionesService,
    DiagnosticoService,
  ],
})
export class CasosModule {}
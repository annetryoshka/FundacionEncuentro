import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller.js';
import { AsignacionesService } from './asignaciones.service.js';
import { CasosController } from './casos.controller.js';
import { CasosService } from './casos.service.js';
import { EditarPacienteController } from './editar-paciente.controller.js';
import { CarpetasController } from './carpetas.controller.js';
import { DiagnosticoController } from './diagnostico.controller.js';
import { DiagnosticoService } from './diagnostico.service.js';
import { SesionesController } from './sesiones.controller.js';
import { SesionesService } from './sesiones.service.js';
import { TareasController } from './tareas.controller.js';
import { TareasService } from './tareas.service.js';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';

@Module({
  controllers: [
    CasosController,
    EditarPacienteController,
    AsignacionesController,
    CarpetasController,
    DiagnosticoController,
    SesionesController,
    TareasController,
    PagosController,
  ],
  providers: [
    CasosService,
    AsignacionesService,
    DiagnosticoService,
    SesionesService,
    TareasService,
    PagosService,
  ],
})
export class CasosModule {}

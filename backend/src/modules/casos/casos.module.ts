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
import { HistorialController } from './historial.controller.js';
import { HistorialService } from './historial.service.js';
import { FamiliaController } from './familia.controller.js';
import { FamiliaService } from './familia.service.js';
import { GenogramaController } from './genograma/genograma.controller.js';
import { GenogramaAccesoService } from './genograma/genograma-acceso.service.js';
import { GenogramaAlmacenPostgres } from './genograma/genograma-almacen-postgres.js';
import {
  GENOGRAMA_ARCHIVOS,
  GenogramaDescargaService,
} from './genograma/genograma-descarga.service.js';
import {
  GENOGRAMA_ESCRITURA,
  GenogramaReemplazoService,
} from './genograma/genograma-reemplazo.service.js';

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
    HistorialController,
    FamiliaController,
    GenogramaController,
  ],
  providers: [
    CasosService,
    AsignacionesService,
    DiagnosticoService,
    SesionesService,
    TareasService,
    FamiliaService,
    PagosService,
    HistorialService,
    GenogramaAccesoService,
    GenogramaDescargaService,
    GenogramaReemplazoService,
    GenogramaAlmacenPostgres,
    { provide: GENOGRAMA_ARCHIVOS, useExisting: GenogramaAlmacenPostgres },
    { provide: GENOGRAMA_ESCRITURA, useExisting: GenogramaAlmacenPostgres },
  ],
  exports: [
    CasosService
  ],
})
export class CasosModule {}

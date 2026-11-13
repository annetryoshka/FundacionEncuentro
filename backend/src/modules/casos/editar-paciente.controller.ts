
import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CarpetaAutorizadaRespuestaDto } from './dto/carpeta-autorizada-respuesta.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';

/**
 * FE-52: Edición de datos del paciente.
 * PATCH /api/carpetas/:id
 *
 * Acceso exclusivo para administradores.
 */
@ApiTags('Carpetas')
@ApiBearerAuth()
@Controller('carpetas')
@Roles('administrador')
export class EditarPacienteController {
  constructor(private readonly casos: CasosService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar datos del paciente',
    description: 'Actualiza los datos del paciente de una carpeta. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'Identificador UUID de la carpeta', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Carpeta actualizada.', type: CarpetaAutorizadaRespuestaDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({ status: 404, description: 'Carpeta inexistente.' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.casos.actualizarDatosPaciente(id, dto, admin.id);

    return this.casos.obtenerCarpetaAutorizada(id, admin);
  }
}

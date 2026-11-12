import {
  Body, Controller, Get, Param, ParseUUIDPipe, Put,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { GuardarDiagnosticoDto } from './dto/guardar-diagnostico.dto.js';
import { DiagnosticoService } from './diagnostico.service.js';

@ApiTags('Diagnóstico')
@ApiBearerAuth()
@Controller('carpetas/:id/diagnostico')
@Roles('administrador', 'terapeuta')
export class DiagnosticoController {
  constructor(private readonly diagnostico: DiagnosticoService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar diagnóstico del caso autorizado' })
  @ApiResponse({ status: 200, description: 'Ficha actual o diagnostico: null.' })
  @ApiResponse({ status: 400, description: 'UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.diagnostico.obtener(id, usuario);
  }

  @Put()
  @ApiOperation({
    summary: 'Crear o reemplazar la ficha de diagnóstico',
    description: 'Conserva creadora y fecha de creación al actualizar.',
  })
  @ApiResponse({ status: 200, description: 'Ficha guardada.' })
  @ApiResponse({ status: 400, description: 'Datos o UUID inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  guardar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarDiagnosticoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.diagnostico.guardar(id, dto, usuario);
  }
}
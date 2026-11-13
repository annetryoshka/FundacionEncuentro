import {
  Controller, Get, Param, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { HistorialService } from './historial.service.js';

@ApiTags('Historial clínico')
@ApiBearerAuth()
@Controller('carpetas/:id/historial')
@Roles('administrador', 'terapeuta')
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar historial clínico del caso autorizado',
    description:
      'Incluye carpeta, contexto, constancia, diagnóstico y sesiones con tareas. Los pagos se consultan por separado con permiso administrativo.',
  })
  @ApiResponse({ status: 200, description: 'Historial clínico del caso.' })
  @ApiResponse({ status: 400, description: 'UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.historial.obtener(id, usuario);
  }
}
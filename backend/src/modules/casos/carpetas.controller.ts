import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe, Put,
} from '@nestjs/common';
import { CarpetaAutorizadaRespuestaDto } from './dto/carpeta-autorizada-respuesta.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';

import { CasosService } from './casos.service.js';
import { AsignacionesService } from './asignaciones.service.js';
import { AsignarTerapeutaDto } from './dto/asignar-terapeuta.dto.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('carpetas')
@ApiTags('Carpetas')
@ApiBearerAuth()
@Controller('carpetas')
export class CarpetasController {
  constructor(
    private readonly casos: CasosService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  @Get(':id')
  @Roles('administrador', 'terapeuta')
  @ApiOperation({
    summary: 'Consultar carpeta autorizada',
    description:
      'Permite consultar una carpeta a administradores y terapeutas asignados al caso.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la carpeta',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Carpeta obtenida correctamente.',
    type: CarpetaAutorizadaRespuestaDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Identificador UUID inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'El usuario no tiene el rol permitido.',
  })
  @ApiResponse({
    status: 404,
    description: 'Carpeta inexistente o no accesible para el usuario.',
  })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.casos.obtenerCarpetaAutorizada(id, usuario);
  }

  @Put(':id/terapeuta')
  @Roles('administrador')
  @ApiOperation({
    summary: 'Asignar o reasignar terapeuta',
    description:
      'Asigna un terapeuta a una carpeta. Si ya tiene uno asignado, permite reemplazarlo. Solo administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID de la carpeta',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Terapeuta asignado correctamente. Devuelve la carpeta actualizada.',
    type: CarpetaAutorizadaRespuestaDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de administrador.',
  })
  @ApiResponse({
    status: 404,
    description: 'Carpeta o terapeuta no encontrado.',
  })
  async asignarTerapeuta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarTerapeutaDto,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.asignaciones.asignar(id, dto.perfilId, admin.id);

    return this.casos.obtenerCarpetaAutorizada(id, admin);
  }
}
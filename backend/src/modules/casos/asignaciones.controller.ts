import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AsignacionRespuestaDto } from './dto/asignacion-respuesta.dto.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AsignacionesService } from './asignaciones.service.js';
import { AsignarTerapeutaDto } from './dto/asignar-terapeuta.dto.js';

/** Qué terapeutas atienden cada caso. Solo el administrador las gestiona. */
@ApiTags('Asignaciones')
@ApiBearerAuth()
@Controller('casos/:casoId/asignaciones')
@Roles('administrador')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar terapeutas asignados a un caso',
    description: 'Consulta las asignaciones de terapeutas de un caso. Solo administradores.',
  })
  @ApiParam({
    name: 'casoId',
    description: 'Identificador UUID del caso',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Asignaciones obtenidas correctamente.',
    type: AsignacionRespuestaDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({
  status: 404,
  description: 'Caso no encontrado.',
})
  listar(@Param('casoId', ParseUUIDPipe) casoId: string) {
    return this.asignaciones.listar(casoId);
  }

  @Post()
  @ApiOperation({
    summary: 'Asignar terapeuta a un caso',
    description: 'Asigna un terapeuta activo al caso. Si existe otro terapeuta asignado, lo reemplaza. Solo administradores.',
  })
  @ApiParam({
    name: 'casoId',
    description: 'Identificador UUID del caso',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Asignación registrada correctamente.',
    type: AsignacionRespuestaDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({
  status: 404,
  description: 'Caso o usuario no encontrado.',
})
@ApiResponse({
  status: 409,
  description: 'Ese terapeuta ya está asignado al caso.',
})
  asignar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Body() dto: AsignarTerapeutaDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.asignaciones.asignar(casoId, dto.perfilId, admin.id);
  }

  @Delete(':perfilId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Quitar terapeuta de un caso',
    description: 'Elimina la asignación de un terapeuta a un caso. Solo administradores.',
  })
  @ApiParam({
    name: 'casoId',
    description: 'Identificador UUID del caso',
    format: 'uuid',
  })
  @ApiParam({
    name: 'perfilId',
    description: 'Identificador UUID del terapeuta',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Asignación eliminada correctamente, sin contenido de respuesta.',
  })
  @ApiResponse({ status: 400, description: 'UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })

  @ApiResponse({
  status: 404,
  description: 'Caso no encontrado o terapeuta no asignado al caso.',
})
  async quitar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Param('perfilId', ParseUUIDPipe) perfilId: string,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.asignaciones.quitar(casoId, perfilId, admin.id);
  }
}
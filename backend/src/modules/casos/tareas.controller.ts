import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CrearTareaDto } from './dto/crear-tarea.dto.js';
import { ActualizarCumplimientoDto } from './dto/actualizar-cumplimiento.dto.js';
import { TareasService } from './tareas.service.js';

@ApiTags('Tareas terapéuticas')
@ApiBearerAuth()
@Controller('carpetas/:id/tareas')
@Roles('administrador', 'terapeuta')
@ApiResponse({ status: 400, description: 'Datos o identificadores inválidos.' })
@ApiResponse({ status: 401, description: 'No autenticado.' })
@ApiResponse({ status: 403, description: 'Rol no permitido.' })
@ApiResponse({ status: 404, description: 'Caso o tarea inexistente o no accesible.' })
export class TareasController {
  constructor(private readonly tareas: TareasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear tarea pendiente vinculada a una sesión del caso' })
  @ApiResponse({ status: 201, description: 'Tarea creada.' })
  crear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearTareaDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.tareas.crear(id, dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tareas del caso autorizado' })
  @ApiResponse({ status: 200, description: 'Tareas del caso; lista vacía si no existen.' })
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.tareas.listar(id, usuario);
  }

  @Patch(':tareaId/cumplimiento')
  @ApiOperation({ summary: 'Cambiar cumplimiento entre pendiente y realizada' })
  @ApiResponse({ status: 200, description: 'Tarea con su estado actual.' })
  actualizarCumplimiento(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tareaId', ParseUUIDPipe) tareaId: string,
    @Body() dto: ActualizarCumplimientoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.tareas.actualizarCumplimiento(id, tareaId, dto, usuario);
  }
}
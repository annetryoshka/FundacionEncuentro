import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { RegistrarSesionDto } from './dto/registrar-sesion.dto.js';
import { SesionesService } from './sesiones.service.js';

@ApiTags('Sesiones')
@ApiBearerAuth()
@Controller('carpetas/:id/sesiones')
@Roles('administrador', 'terapeuta')
export class SesionesController {
  constructor(private readonly sesiones: SesionesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar sesión y seguimiento' })
  @ApiResponse({ status: 201, description: 'Sesión creada con identificador estable.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o sin terapeuta activa asignada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  registrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarSesionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.sesiones.registrar(id, dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sesiones por fecha y número ascendentes' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones; vacía cuando no hay registros.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.sesiones.listar(id, usuario);
  }

  @Get(':sesionId')
  @ApiOperation({ summary: 'Consultar una sesión del caso autorizado' })
  @ApiResponse({ status: 200, description: 'Detalle de la sesión.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso o sesión inexistente o no accesible.' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sesionId', ParseUUIDPipe) sesionId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.sesiones.obtener(id, sesionId, usuario);
  }
}
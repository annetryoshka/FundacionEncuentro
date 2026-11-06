import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import {
  RegistrarCasoRespuestaDto, CarpetaRespuestaDto,
} from './dto/carpeta-respuesta.dto.js';
import { ListarCasosRespuestaDto } from './dto/listar-casos-respuesta.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';
import { ActualizarEstadoCasoDto } from './dto/actualizar-estado-caso.dto.js';
import { ListarCasosQuery } from './dto/listar-casos.query.js';
import { RegistrarCasoDto } from './dto/registrar-caso.dto.js';

@ApiTags('Casos')
@ApiBearerAuth()
@Controller('casos')
@Roles('administrador')
export class CasosController {
  constructor(private readonly casos: CasosService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar caso',
    description: 'Registra un nuevo caso en el sistema. Solo administradores.',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una carpeta con ese número para el tipo de caso indicado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Caso registrado correctamente.',
    type: RegistrarCasoRespuestaDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  registrar(
    @Body() dto: RegistrarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.casos.registrar(dto, admin.id);
  }

  @Get()
  @Roles('administrador', 'terapeuta')
  @ApiOperation({
    summary: 'Listar casos autorizados',
    description:
      'Administración consulta todos los casos. Cada terapeuta consulta solo los asignados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Casos obtenidos correctamente.',
    type: ListarCasosRespuestaDto,
  })
  @ApiResponse({ status: 400, description: 'Filtros inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no autorizado.' })
  listar(
    @Query() filtros: ListarCasosQuery,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.casos.listar(filtros, usuario);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener caso por ID',
    description: 'Consulta la información de un caso. Solo administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID del caso',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Caso encontrado.',
    type: CarpetaRespuestaDto,
  })
  @ApiResponse({ status: 400, description: 'Identificador UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.casos.obtener(id);
  }

  // FE-52: edición de datos del paciente, exclusiva de administración.
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar datos del paciente',
    description:
      'Modifica los datos básicos del paciente asociado al caso. Solo administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID del caso',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del paciente actualizados correctamente.',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado.' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.casos.actualizarDatosPaciente(id, dto, admin.id);
    return this.casos.obtener(id);
  }

  @Patch(':id/estado')
  @Roles('administrador', 'terapeuta')
  @ApiOperation({
    summary: 'Actualizar estado de un caso autorizado',
    description:
      'Permite actualizar el estado a administración o a la terapeuta asignada.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID del caso',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 400, description: 'Estado, identificador o campos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Rol no permitido.' })
  @ApiResponse({ status: 404, description: 'Caso inexistente o no accesible.' })
  actualizarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEstadoCasoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.casos.actualizarEstado(id, dto, usuario);
  }
}
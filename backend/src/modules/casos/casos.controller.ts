
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RegistrarCasoRespuestaDto } from './dto/carpeta-respuesta.dto.js';
import { ListarCasosRespuestaDto } from './dto/listar-casos-respuesta.dto.js';
import { CarpetaRespuestaDto } from './dto/carpeta-respuesta.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js'; 
import { ListarCasosQuery } from './dto/listar-casos.query.js';
import { RegistrarCasoDto } from './dto/registrar-caso.dto.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';


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
@ApiResponse({ status: 201, description: 'Caso registrado correctamente.', type: RegistrarCasoRespuestaDto })
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
  @ApiOperation({
  summary: 'Listar casos',
  description: 'Obtiene los casos registrados, aplicando los filtros disponibles.',
})
@ApiResponse({ status: 200, description: 'Casos obtenidos correctamente.', type: ListarCasosRespuestaDto })
@ApiResponse({ status: 400, description: 'Filtros de búsqueda inválidos.' })
@ApiResponse({ status: 401, description: 'No autenticado.' })
@ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  listar(@Query() filtros: ListarCasosQuery) {
    return this.casos.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({
  summary: 'Obtener caso por ID',
  description: 'Consulta la información de un caso registrado.',
})
@ApiParam({
  name: 'id',
  description: 'Identificador UUID del caso',
  type: String,
  format: 'uuid',
})
@ApiResponse({ status: 200, description: 'Caso encontrado.', type: CarpetaRespuestaDto })
@ApiResponse({ status: 400, description: 'Identificador UUID inválido.' })
@ApiResponse({ status: 401, description: 'No autenticado.' })
@ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
@ApiResponse({ status: 404, description: 'Caso no encontrado.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.casos.obtener(id);
  }

  /**
   * FE-52: Editar datos básicos del paciente.
   * Disponible únicamente para administración.
   */
  @Patch(':id')
  @ApiOperation({
  summary: 'Actualizar datos del paciente',
  description: 'Modifica los datos básicos del paciente asociado al caso. Solo administradores.',
})
@ApiParam({
  name: 'id',
  description: 'Identificador UUID del caso',
  type: String,
  format: 'uuid',
})
@ApiResponse({ status: 200, description: 'Datos del paciente actualizados correctamente.' })
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
}

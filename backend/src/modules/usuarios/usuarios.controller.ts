import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';
import { BadRequestException } from '@nestjs/common';
import type { Rol } from '../../common/types/usuario.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  UsuarioDetalleDto,
  ListaUsuariosRespuestaDto,
} from './dto/usuario-respuesta.dto.js';

/** Gestión de usuarios: SOLO el administrador. */
@ApiBearerAuth()
@Controller('usuarios')
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Post()
  @ApiOperation({
  summary: 'Crear usuario',
  description: 'Registra un usuario con uno de los roles permitidos. Solo administradores.',
})
  @ApiResponse({
  status: 201,
  description: 'Usuario creado correctamente.',
  type: UsuarioDetalleDto,
})
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() admin: Usuario) {
    return this.usuarios.crear(dto, admin.id);
  }

    @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar usuarios',
    description: 'Obtiene los usuarios registrados. Permite filtrar por rol y estado activo.',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    enum: ['administrador', 'terapeuta', 'marketing'],
    description: 'Filtrar usuarios por rol',
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar usuarios por estado activo',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida correctamente.',
    type: ListaUsuariosRespuestaDto,
  })
  @ApiResponse({
    status: 400,
    description: 'El rol o el estado activo proporcionado no es válido.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'El usuario no tiene permisos de administrador.',
  })
async listar(
  @Query('rol') rol?: string,
  @Query('activo') activo?: string,
) {
  if (rol !== undefined && !['administrador', 'terapeuta', 'marketing'].includes(rol)) {
    throw new BadRequestException('Rol no válido');
  }

  if (activo !== undefined && activo !== 'true' && activo !== 'false') {
    throw new BadRequestException('El filtro activo debe ser true o false');
  }

  const usuarios = await this.usuarios.listar({
    rol: rol as Rol | undefined,
    activo: activo === undefined ? undefined : activo === 'true',
  });

  return { usuarios };
}

  @Get(':id')
  @ApiOperation({
  summary: 'Obtener usuario por ID',
  description: 'Consulta la información de un usuario registrado.',
})
@ApiParam({
  name: 'id',
  description: 'Identificador UUID del usuario',
  type: String,
  format: 'uuid',
})
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado.',
    type: UsuarioDetalleDto,
  })
  @ApiResponse({ status: 400, description: 'Identificador UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({
  summary: 'Actualizar usuario',
  description: 'Modifica el nombre, rol o estado activo de un usuario.',
})
@ApiParam({
  name: 'id',
  description: 'Identificador UUID del usuario',
  type: String,
  format: 'uuid',
})
  @ApiResponse({ status: 200, description: 'Usuario actualizado correctamente.', type: UsuarioDetalleDto, })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos de administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.usuarios.actualizar(id, dto, admin.id);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';
import { BadRequestException } from '@nestjs/common';
import type { Rol } from '../../common/types/usuario.js';

/** Gestión de usuarios: SOLO el administrador. */
@Controller('usuarios')
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Post()
  crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() admin: Usuario) {
    return this.usuarios.crear(dto, admin.id);
  }

  @Get()
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
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.obtener(id);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.usuarios.actualizar(id, dto, admin.id);
  }
}

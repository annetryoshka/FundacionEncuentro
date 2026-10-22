import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe, Put,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';

import { CasosService } from './casos.service.js';
import { AsignacionesService } from './asignaciones.service.js';
import { AsignarTerapeutaDto } from './dto/asignar-terapeuta.dto.js';

@Controller('carpetas')
export class CarpetasController {
  constructor(
    private readonly casos: CasosService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  //consultar una carpeta con autorización por caso
  @Get(':id')
  @Roles('administrador', 'terapeuta')
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.casos.obtenerCarpetaAutorizada(id, usuario);
  }

  @Put(':id/terapeuta')
  @Roles('administrador')
  async asignarTerapeuta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarTerapeutaDto,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.asignaciones.asignar(id, dto.perfilId, admin.id);

    return this.casos.obtenerCarpetaAutorizada(id, admin);
  }
}
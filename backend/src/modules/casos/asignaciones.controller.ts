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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AsignacionesService } from './asignaciones.service.js';
import { AsignarTerapeutaDto } from './dto/asignar-terapeuta.dto.js';

/** Qué terapeutas atienden cada caso. Solo el administrador las gestiona. */
@Controller('casos/:casoId/asignaciones')
@Roles('administrador')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get()
  listar(@Param('casoId', ParseUUIDPipe) casoId: string) {
    return this.asignaciones.listar(casoId);
  }

  @Post()
  asignar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Body() dto: AsignarTerapeutaDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.asignaciones.asignar(casoId, dto.perfilId, admin.id);
  }

  @Delete(':perfilId')
  @HttpCode(204)
  async quitar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Param('perfilId', ParseUUIDPipe) perfilId: string,
    @UsuarioActual() admin: Usuario,
  ) {
    await this.asignaciones.quitar(casoId, perfilId, admin.id);
  }
}

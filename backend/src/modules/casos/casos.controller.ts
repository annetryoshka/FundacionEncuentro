
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

import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';
import { ListarCasosQuery } from './dto/listar-casos.query.js';
import { RegistrarCasoDto } from './dto/registrar-caso.dto.js';

@Controller('casos')
@Roles('administrador')
export class CasosController {
  constructor(private readonly casos: CasosService) {}

  @Post()
  registrar(
    @Body() dto: RegistrarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.casos.registrar(dto, admin.id);
  }

  @Get()
  listar(@Query() filtros: ListarCasosQuery) {
    return this.casos.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.casos.obtener(id);
  }

  /**
   * FE-52: Editar datos básicos del paciente.
   * Disponible únicamente para administración.
   */
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.casos.actualizarDatosPaciente(
      id,
      dto,
      admin.id,
    );
  }
}

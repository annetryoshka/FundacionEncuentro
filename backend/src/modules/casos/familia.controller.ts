import { Controller, Get, Header, Param, ParseUUIDPipe, Put, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { FamiliaService } from './familia.service.js';
import { GuardarFamiliaDto } from './dto/guardar-familia.dto.js';

@ApiTags('Familia')
@ApiBearerAuth()
@Controller('carpetas/:id/familia')
@Roles('administrador', 'terapeuta')
export class FamiliaController {
  constructor(private readonly familia: FamiliaService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.familia.obtener(id, usuario);
  }

  @Put()
  @Header('Cache-Control', 'private, no-store')
  guardar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
    @Body() dto: GuardarFamiliaDto,
  ) {
    return this.familia.guardar(id, usuario, dto);
  }
}
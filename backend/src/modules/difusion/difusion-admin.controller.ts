import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { DifusionService } from './difusion.service.js';
import { CrearRecursoDifusionDto } from './dto/crear-recurso-difusion.dto.js';
import { GuardarPublicacionDto } from './dto/guardar-publicacion.dto.js';
import {
  CambiarEstadoPublicacionDto,
  ListarPublicacionesAdminQuery,
} from './dto/listar-publicaciones.query.js';

@ApiTags('Administración de difusión')
@ApiBearerAuth()
@Controller('difusion/publicaciones')
@Roles('administrador', 'marketing')
export class DifusionAdminController {
  constructor(private readonly difusion: DifusionService) {}

  @Get()
  listar(@Query() filtros: ListarPublicacionesAdminQuery) {
    return this.difusion.listarAdmin(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.difusion.obtenerAdmin(id);
  }

  @Post()
  crear(@Body() dto: GuardarPublicacionDto, @UsuarioActual() usuario: Usuario) {
    return this.difusion.guardar(dto, usuario.id);
  }

  @Put(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarPublicacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.guardar(dto, usuario.id, id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoPublicacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.cambiarEstado(id, dto.estado, usuario.id);
  }

  @Post(':id/recursos')
  agregarRecurso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearRecursoDifusionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.agregarRecurso(id, dto, usuario.id);
  }

  @Delete(':id/recursos/:recursoId')
  @HttpCode(204)
  quitarRecurso(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recursoId', ParseUUIDPipe) recursoId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.quitarRecurso(id, recursoId, usuario.id);
  }
}
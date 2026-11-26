import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Delete, HttpCode, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { DifusionService } from './difusion.service.js';
import { ListarPublicacionesQuery } from './dto/listar-publicaciones.query.js';
import { CrearRecursoDifusionDto } from './dto/crear-recurso-difusion.dto.js';
import { Usuario } from '../../common/types/usuario.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';

@Public()
@ApiTags('Difusión pública')
@Controller('publico/publicaciones')
export class DifusionPublicaController {
  constructor(private readonly difusion: DifusionService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query() filtros: ListarPublicacionesQuery) {
    return this.difusion.listarPublicadas(filtros);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.difusion.obtenerPublicada(id);
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
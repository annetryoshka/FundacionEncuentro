import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { DifusionService } from './difusion.service.js';
import { ListarPublicacionesQuery } from './dto/listar-publicaciones.query.js';

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

}

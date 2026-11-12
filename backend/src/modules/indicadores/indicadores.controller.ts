import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ConsultarIndicadoresQuery } from './dto/consultar-indicadores.query.js';
import { IndicadoresService } from './indicadores.service.js';

@ApiTags('Indicadores')
@ApiBearerAuth()
@Controller('indicadores')
@Roles('administrador')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar indicadores operativos',
    description:
      'Solo administración. Período inclusivo para sesiones y pagos; los casos corresponden al estado actual.',
  })
  @ApiResponse({ status: 200, description: 'Indicadores calculados.' })
  @ApiResponse({ status: 400, description: 'Fechas inválidas o período invertido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Requiere administración.' })
  consultar(@Query() filtros: ConsultarIndicadoresQuery) {
    return this.indicadores.consultar(filtros);
  }
}
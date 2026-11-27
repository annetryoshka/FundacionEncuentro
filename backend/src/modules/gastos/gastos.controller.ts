import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AnularGastoDto, ConsultarGastosQuery, GuardarGastoDto } from './dto/guardar-gasto.dto.js';
import { GastosService } from './gastos.service.js';

@ApiTags('Gastos')
@ApiBearerAuth()
@Controller('gastos')
@Roles('administrador')
export class GastosController {
  constructor(private readonly gastos: GastosService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Consultar los gastos de un mes con su total y los totales por categoría' })
  @ApiResponse({ status: 200, description: 'Lista del mes (anulados marcados), totalMes y totalesPorCategoria.' })
  @ApiResponse({ status: 400, description: 'Mes con formato distinto de AAAA-MM.' })
  @ApiResponse({ status: 403, description: 'Solo administración.' })
  consultar(@Query() consulta: ConsultarGastosQuery, @UsuarioActual() usuario: Usuario) {
    return this.gastos.consultarMes(usuario.id, consulta.mes);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Registrar un gasto de funcionamiento' })
  @ApiResponse({ status: 201, description: 'Gasto registrado.' })
  @ApiResponse({ status: 400, description: 'Tipo, fecha, monto o descripción inválidos.' })
  @ApiResponse({ status: 403, description: 'Solo administración.' })
  registrar(@Body() dto: GuardarGastoDto, @UsuarioActual() usuario: Usuario) {
    return this.gastos.registrar(usuario.id, dto);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Corregir un gasto vigente (se envían los cuatro campos)' })
  @ApiResponse({ status: 200, description: 'Gasto corregido.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Gasto inexistente.' })
  @ApiResponse({ status: 409, description: 'El gasto está anulado.' })
  corregir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarGastoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.gastos.corregir(usuario.id, id, dto);
  }

  @Post(':id/anular')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Anular un gasto; repetir la anulación no vuelve a restar' })
  @ApiResponse({ status: 200, description: 'Gasto anulado (o ya anulado).' })
  @ApiResponse({ status: 404, description: 'Gasto inexistente.' })
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularGastoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.gastos.anular(usuario.id, id, dto.motivo);
  }
}

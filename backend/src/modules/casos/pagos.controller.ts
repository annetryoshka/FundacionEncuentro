import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PagosService } from './pagos.service.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { RegistrarPagoDto } from './dto/registrar-pago.dto.js';

@ApiTags('Pagos')
@ApiBearerAuth()
@Controller('carpetas/:id/pagos')
@Roles('administrador')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar pagos del caso; solo administración' })
  @ApiResponse({ status: 200, description: 'Pagos guardados del caso.' })
  @ApiResponse({ status: 400, description: 'UUID inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Requiere administración.' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado.' })
  listar(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagos.listar(id);
  }
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registrar pago o recuperar un reintento idéntico',
    description:
      'Solo administración. Un pago por sesión; no verifica el cobro con un banco.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago guardado o existente. reutilizado indica un reintento.',
  })
  @ApiResponse({ status: 400, description: 'Datos o relación sesión/caso inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Requiere administración.' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado.' })
  @ApiResponse({ status: 409, description: 'La sesión tiene un pago con otros datos.' })
  registrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarPagoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    return this.pagos.registrar(id, dto, admin.id);
  }
}
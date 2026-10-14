import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ListarCasosQuery } from './dto/listar-casos.query.js';
import { RegistrarCasoDto } from './dto/registrar-caso.dto.js';

/**
 * Carpetas digitales de pacientes. Por ahora SOLO el administrador:
 * el acceso de terapeutas a sus propios casos llega con FE-37.
 */
@Controller('casos')
@Roles('administrador')
export class CasosController {
  constructor(private readonly casos: CasosService) {}

  /** Registro integral: paciente + carpeta con número correlativo. */
  @Post()
  registrar(@Body() dto: RegistrarCasoDto, @UsuarioActual() admin: Usuario) {
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
}


import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from './casos.service.js';
import { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';

/**
 * FE-52: Edición de datos del paciente.
 * PATCH /api/carpetas/:id
 *
 * Acceso exclusivo para administradores.
 */
@Controller('carpetas')
@Roles('administrador')
export class EditarPacienteController {
  constructor(private readonly casos: CasosService) {}

  @Patch(':id')
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCasoDto,
    @UsuarioActual() admin: Usuario,
  ) {
    const carpeta = await this.casos.actualizarDatosPaciente(
      id,
      dto,
      admin.id,
    );

    return {
      id: carpeta.id,
      numero: carpeta.numeroCorrelativo,
      tipo: carpeta.tipo,
      estado: carpeta.estado,
      fechaIngreso: carpeta.fechaIngreso,
      paciente: {
        id: carpeta.paciente.id,
        nombreCompleto: carpeta.paciente.nombreCompleto,
      },
      terapeuta: null,
      creadoPor: null,
      creadoEn: carpeta.creadoEn,
      asignadoPor: null,
      asignadoEn: null,
    };
  }
}

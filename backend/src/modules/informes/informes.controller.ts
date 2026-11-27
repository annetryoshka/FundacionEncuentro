import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { GenerarInformeDto } from './dto/generar-informe.dto.js';
import { InformesService } from './informes.service.js';
import { definirPlantillaJudicial } from './plantilla-judicial.js';
import { definirPlantillaSistemica } from './plantilla-sistemica.js';
import { RevisarInformeDto } from './dto/revisar-informe.dto.js';

@ApiTags('Informes')
@ApiBearerAuth()
@Controller('carpetas/:id/informes')
@Roles('terapeuta')
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  @Post()
  generar(
    @Param('id', ParseUUIDPipe) casoId: string,
    @UsuarioActual() usuario: Usuario,
    @Body() dto: GenerarInformeDto,
  ) {
    return this.informes.generar(
      casoId,
      usuario,
      {
        sesionesIds: dto.sesionesIds ?? [],
        incluirFamilia: dto.incluirFamilia ?? false,
        incluirGenograma: dto.incluirGenograma ?? false,
      },
      (origen) =>
        dto.tipo === 'judicial'
          ? definirPlantillaJudicial(origen, dto.objeto)
          : definirPlantillaSistemica(origen),
    );
  }

  @Patch(':versionId/revision')
  revisar(
    @Param('id', ParseUUIDPipe) casoId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @UsuarioActual() usuario: Usuario,
    @Body() dto: RevisarInformeDto,
  ) {
    return this.informes.revisar(casoId, versionId, usuario, dto.secciones);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  listar(@Param('id', ParseUUIDPipe) casoId: string, @UsuarioActual() usuario: Usuario) {
    return this.informes.listar(casoId, usuario);
  }

  @Get(':versionId')
  @Header('Cache-Control', 'private, no-store')
  consultar(
    @Param('id', ParseUUIDPipe) casoId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.informes.consultar(casoId, versionId, usuario);
  }
}
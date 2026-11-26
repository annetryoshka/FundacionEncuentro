import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post, Get, Header, InternalServerErrorException, StreamableFile
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { GenerarExportacionDto } from './dto/generar-exportacion.dto.js';
import { GenerarExportacionService } from './generar-exportacion.service.js';
import { createHash } from 'node:crypto';
import { ExportacionesAlmacenService } from './exportaciones-almacen.service.js';
import { ExportacionesRegistroService } from './exportaciones-registro.service.js';

@ApiTags('Exportaciones')
@ApiBearerAuth()
@Controller('carpetas/:casoId/exportaciones')
@Roles('administrador', 'terapeuta')
export class ExportacionesController {
    constructor(
    private readonly generador: GenerarExportacionService,
    private readonly registro: ExportacionesRegistroService,
    private readonly almacen: ExportacionesAlmacenService,
  ) {}

  @Post()
  async generar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @UsuarioActual() usuario: Usuario,
    @Body() dto: GenerarExportacionDto,
  ) {
    const { datosMostrados, ...parametros } = dto;

    try {
      return await this.generador.generar(casoId, usuario.id, parametros, datosMostrados);
    } catch (error) {
      const codigo = error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;

      switch (codigo) {
        case '22023':
          throw new BadRequestException('La selección de exportación es inválida.');
        case '42501':
          throw new ForbiddenException('No tienes permiso para esta exportación.');
        case 'P0002':
          throw new NotFoundException('Caso o versión del informe no disponible.');
        case '23514':
          throw new ConflictException('Revisa que el informe esté revisado o actualiza la vista previa.');
        case '0A000':
          throw new ConflictException('El genograma aún no está disponible para exportar.');
        default:
          throw error;
      }
    }
  }

    @Get(':exportacionId/archivo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async descargar(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Param('exportacionId', ParseUUIDPipe) exportacionId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<StreamableFile> {
    const archivo = await this.registro
      .consultarArchivo(casoId, exportacionId, usuario.id)
      .catch((error: unknown) => {
        const codigo = error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;

        if (codigo === 'P0002') {
          throw new NotFoundException('Exportación no encontrada.');
        }
        if (codigo === '55000') {
          throw new ConflictException('La exportación todavía no tiene un archivo disponible.');
        }
        throw error;
      });

    if (!archivo) {
      throw new NotFoundException('Exportación no encontrada.');
    }

    const contenido = await this.almacen.leer(archivo.archivoPath).catch(() => {
      throw new InternalServerErrorException('No se pudo leer el archivo de exportación.');
    });
    const sha256 = createHash('sha256').update(contenido).digest('hex');

    if (contenido.length !== archivo.bytes || sha256 !== archivo.sha256) {
      throw new InternalServerErrorException('El archivo de exportación no pasó la verificación.');
    }

    return new StreamableFile(contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.archivoNombre}"`,
      length: contenido.length,
    });
  }
}
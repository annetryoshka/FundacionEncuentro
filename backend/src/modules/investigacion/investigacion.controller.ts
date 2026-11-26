import { Controller, Get, Header, Query, Body, Param, ParseUUIDPipe, Post, Patch, StreamableFile, Put } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import {
  FiltrosInvestigacionQuery,
  SeleccionInvestigacionQuery,
} from './dto/filtros-investigacion.query.js';
import { InvestigacionService } from './investigacion.service.js';
import { AsignarEtiquetaDto } from './dto/asignar-etiqueta.dto.js';
import { PrepararExportacionDto } from './dto/preparar-exportacion.dto.js';
import { ConfirmarRevisionDto } from './dto/confirmar-revision.dto.js';
import { CrearCategoriaDto, EditarCategoriaDto } from './dto/guardar-categoria.dto.js';

@Controller('investigacion')
@Roles('administrador', 'terapeuta')
export class InvestigacionController {
  constructor(private readonly investigacion: InvestigacionService) {}

  @Get('categorias')
  @Header('Cache-Control', 'private, no-store')
  listarCategorias(
    @Query() filtros: FiltrosInvestigacionQuery,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.listarCategorias(usuario.id, filtros);
  }

  @Get('seleccion')
  @Header('Cache-Control', 'private, no-store')
  listarSeleccion(
    @Query() filtros: SeleccionInvestigacionQuery,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.listarSeleccion(usuario.id, filtros);
  }

    @Post('casos/:casoId/etiquetas')
  asignarEtiqueta(
    @Param('casoId', ParseUUIDPipe) casoId: string,
    @Body() dto: AsignarEtiquetaDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.asignarEtiqueta(casoId, usuario.id, dto);
  }

    @Post('exportaciones')
  @Header('Cache-Control', 'private, no-store')
  prepararExportacion(
    @Body() dto: PrepararExportacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.prepararExportacion(usuario.id, dto);
  }

  @Get('exportaciones/:id/manifiesto')
  @Header('Cache-Control', 'private, no-store')
  obtenerManifiesto(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.obtenerManifiesto(usuario.id, id);
  }

  @Get('exportaciones/:id/documentos/:codigo')
  @Header('Cache-Control', 'private, no-store')
  obtenerDocumento(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codigo') codigo: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.obtenerDocumento(usuario.id, id, codigo);
  }

  @Get('exportaciones/:id/revision')
  @Header('Cache-Control', 'private, no-store')
  obtenerVistaRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.obtenerVistaRevision(usuario.id, id);
  }

  @Patch('exportaciones/:id/revision')
  @Header('Cache-Control', 'private, no-store')
  confirmarRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarRevisionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.confirmarRevision(usuario.id, id, dto.huella);
  }

    @Get('exportaciones/:id/descarga')
  @Header('Cache-Control', 'private, no-store')
  async descargar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    const archivo = await this.investigacion.descargarExportacion(usuario.id, id);

    return new StreamableFile(archivo, {
      type: 'application/zip',
      disposition: 'attachment; filename="investigacion.zip"',
      length: archivo.length,
    });
  }

    @Post('categorias')
  @Roles('administrador')
  crearCategoria(
    @Body() dto: CrearCategoriaDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.guardarCategoria(usuario.id, dto, { codigo: dto.codigo });
  }

  @Put('categorias/:id')
  @Roles('administrador')
  editarCategoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarCategoriaDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.investigacion.guardarCategoria(usuario.id, dto, { id });
  }
}
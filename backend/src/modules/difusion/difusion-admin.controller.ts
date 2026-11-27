import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { ESQUEMA_SUBIR_IMAGEN, TextoAlternativoDto } from '../imagenes-publicas/dto/texto-alternativo.dto.js';
import { RecibirImagenInterceptor, type ArchivoSubido } from '../imagenes-publicas/recibir-imagen.interceptor.js';
import {
  CACHE_PRIVADA,
  responderImagen,
  type PeticionImagen,
  type RespuestaImagen,
} from '../imagenes-publicas/responder-imagen.js';
import { DifusionService } from './difusion.service.js';
import { GuardarPublicacionDto } from './dto/guardar-publicacion.dto.js';
import {
  CambiarEstadoPublicacionDto,
  ListarPublicacionesAdminQuery,
} from './dto/listar-publicaciones.query.js';

@ApiTags('Administración de difusión')
@ApiBearerAuth()
@Controller('difusion/publicaciones')
@Roles('administrador', 'marketing')
export class DifusionAdminController {
  constructor(private readonly difusion: DifusionService) {}

  @Get()
  listar(@Query() filtros: ListarPublicacionesAdminQuery) {
    return this.difusion.listarAdmin(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.difusion.obtenerAdmin(id);
  }

  @Post()
  crear(@Body() dto: GuardarPublicacionDto, @UsuarioActual() usuario: Usuario) {
    return this.difusion.guardar(dto, usuario.id);
  }

  @Put(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarPublicacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.guardar(dto, usuario.id, id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoPublicacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.cambiarEstado(id, dto.estado, usuario.id);
  }

  @Put(':id/imagen')
  @UseInterceptors(RecibirImagenInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody(ESQUEMA_SUBIR_IMAGEN)
  @ApiOperation({ summary: 'Subir o reemplazar la imagen de portada (se reduce y se guarda como WebP)' })
  @ApiResponse({ status: 413, description: 'Más de 15 MB.' })
  @ApiResponse({ status: 415, description: 'No es JPEG, PNG ni WebP.' })
  @ApiResponse({ status: 422, description: 'No se pudo leer o es muy pequeña.' })
  subirImagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TextoAlternativoDto,
    @UsuarioActual() usuario: Usuario,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    return this.difusion.subirImagen(id, archivo?.buffer, dto.textoAlternativo, usuario.id);
  }

  @Patch(':id/imagen')
  @ApiOperation({ summary: 'Cambiar la descripción de la imagen' })
  cambiarTextoImagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TextoAlternativoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.difusion.cambiarTextoImagen(id, dto.textoAlternativo, usuario.id);
  }

  @Delete(':id/imagen')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar la imagen (el archivo se borra)' })
  async quitarImagen(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    await this.difusion.quitarImagen(id, usuario.id);
  }

  @Get(':id/imagen/archivo')
  @ApiOperation({ summary: 'Imagen para la vista previa, en cualquier estado' })
  async archivoImagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() peticion: PeticionImagen,
    @Res({ passthrough: true }) respuesta: RespuestaImagen,
  ) {
    return responderImagen(peticion, respuesta, await this.difusion.archivoImagen(id), CACHE_PRIVADA);
  }
}

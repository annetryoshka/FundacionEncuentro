import {
  Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { ESQUEMA_SUBIR_IMAGEN, TextoAlternativoDto } from '../imagenes-publicas/dto/texto-alternativo.dto.js';
import { RecibirImagenInterceptor, type ArchivoSubido } from '../imagenes-publicas/recibir-imagen.interceptor.js';
import {
  CACHE_PRIVADA, responderImagen, type PeticionImagen, type RespuestaImagen,
} from '../imagenes-publicas/responder-imagen.js';
import {
  CambiarEstadoArticuloDto,
  GuardarArticuloDto,
  ListarArticulosPublicosQuery,
  ListarArticulosQuery,
} from './dto/articulo.dto.js';
import { ArticulosService } from './articulos.service.js';

@ApiTags('Investigaciones públicas')
@ApiBearerAuth()
@Controller('investigaciones/articulos')
@Roles('administrador', 'marketing')
export class ArticulosAdminController {
  constructor(private readonly articulos: ArticulosService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Listar artículos en cualquier estado (gestión)' })
  listar(@Query() filtros: ListarArticulosQuery, @UsuarioActual() usuario: Usuario) {
    return this.articulos.listar(usuario.id, filtros);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Consultar un artículo (gestión)' })
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    return this.articulos.obtener(usuario.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un artículo en borrador' })
  @ApiResponse({ status: 201, description: 'Borrador creado.' })
  crear(@Body() dto: GuardarArticuloDto, @UsuarioActual() usuario: Usuario) {
    return this.articulos.crear(usuario.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar un artículo (formulario completo; la imagen se conserva)' })
  @ApiResponse({ status: 422, description: 'Un artículo publicado no puede quedar sin resumen.' })
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarArticuloDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.articulos.editar(usuario.id, id, dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Publicar, retirar o volver a borrador' })
  @ApiResponse({ status: 409, description: 'Transición no permitida.' })
  @ApiResponse({ status: 422, description: 'Faltan datos para publicar (camposFaltantes).' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoArticuloDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.articulos.cambiarEstado(usuario.id, id, dto.estado);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un artículo que nunca se publicó' })
  @ApiResponse({ status: 409, description: 'Ya se publicó: se retira, no se elimina.' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    await this.articulos.eliminar(usuario.id, id);
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
    return this.articulos.subirImagen(usuario.id, id, archivo?.buffer, dto.textoAlternativo);
  }

  @Patch(':id/imagen')
  @ApiOperation({ summary: 'Cambiar la descripción de la imagen' })
  cambiarTextoImagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TextoAlternativoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.articulos.cambiarTextoImagen(usuario.id, id, dto.textoAlternativo);
  }

  @Delete(':id/imagen')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar la imagen (el archivo se borra)' })
  async quitarImagen(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    await this.articulos.quitarImagen(usuario.id, id);
  }

  @Get(':id/imagen/archivo')
  @ApiOperation({ summary: 'Imagen para la vista previa, en cualquier estado' })
  async archivoImagen(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() peticion: PeticionImagen,
    @Res({ passthrough: true }) respuesta: RespuestaImagen,
  ) {
    return responderImagen(peticion, respuesta, await this.articulos.archivoImagen(id), CACHE_PRIVADA);
  }
}

@ApiTags('Investigaciones públicas')
@Public()
@Controller('publico/investigaciones')
export class ArticulosPublicosController {
  constructor(private readonly articulos: ArticulosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar investigaciones publicadas (sin sesión)' })
  listar(@Query() filtros: ListarArticulosPublicosQuery) {
    return this.articulos.listarPublicados(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Leer una investigación publicada (sin sesión)' })
  @ApiResponse({ status: 404, description: 'No existe, es un borrador o fue retirada.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.articulos.obtenerPublicado(id);
  }
}

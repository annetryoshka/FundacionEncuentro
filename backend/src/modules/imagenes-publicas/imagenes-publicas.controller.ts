import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { ImagenesPublicasService } from './imagenes-publicas.service.js';
import { CACHE_PUBLICA, responderImagen, type PeticionImagen, type RespuestaImagen } from './responder-imagen.js';

@Public()
@ApiTags('Imágenes del portal')
@Controller('publico/imagenes')
export class ImagenesPublicasController {
  constructor(private readonly imagenes: ImagenesPublicasService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Imagen de una publicación o artículo publicado (sin sesión)' })
  @ApiResponse({ status: 404, description: 'No existe o lo que la usa no está publicado.' })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() peticion: PeticionImagen,
    @Res({ passthrough: true }) respuesta: RespuestaImagen,
  ) {
    const imagen = await this.imagenes.leerPublicada(id);
    if (!imagen) throw new NotFoundException('Imagen no encontrada');
    return responderImagen(peticion, respuesta, imagen, CACHE_PUBLICA);
  }
}

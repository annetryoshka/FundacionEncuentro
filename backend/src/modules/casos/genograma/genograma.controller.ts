import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../../common/types/usuario.js';
import { GenogramaDescargaService } from './genograma-descarga.service.js';
import { GenogramaReemplazoService } from './genograma-reemplazo.service.js';

const MAX_GENOGRAMA_BYTES = 5 * 1024 * 1024;

type ArchivoRecibido = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@ApiTags('Genograma')
@ApiBearerAuth()
@Controller('carpetas/:id/genograma')
@Roles('administrador', 'terapeuta')
export class GenogramaController {
  constructor(
    private readonly descarga: GenogramaDescargaService,
    private readonly reemplazo: GenogramaReemplazoService,
  ) {}

  @Put()
  @HttpCode(204)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: MAX_GENOGRAMA_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Cargar o reemplazar el genograma del caso' })
  async cargar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
    @UploadedFile() archivo?: ArchivoRecibido,
  ): Promise<void> {
    await this.reemplazo.reemplazar(
      id,
      usuario,
      archivo && {
        nombre: archivo.originalname,
        tipo: archivo.mimetype,
        contenido: archivo.buffer,
      },
      MAX_GENOGRAMA_BYTES,
    );
  }
  @Get()
    @Header('Cache-Control', 'private, no-store')
    @ApiOperation({ summary: 'Consultar los metadatos del genograma vigente' })
    consultar(
      @Param('id', ParseUUIDPipe) id: string,
      @UsuarioActual() usuario: Usuario,
    ) {
      return this.descarga.consultar(id, usuario);
    }

  @Get('archivo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Descargar el genograma vigente del caso' })
  async descargar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<StreamableFile> {
    const archivo = await this.descarga.descargar(id, usuario);
    const nombreSeguro = archivo.nombre.replace(/[^a-zA-Z0-9._-]/g, '_');

    return new StreamableFile(archivo.contenido, {
      type: archivo.tipo,
      disposition: `attachment; filename="${nombreSeguro || 'genograma'}"`,
      length: archivo.contenido.length,
    });
  }
}
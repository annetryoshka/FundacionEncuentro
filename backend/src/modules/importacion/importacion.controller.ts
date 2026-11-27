import {
  BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe,
  Post, UnsupportedMediaTypeException, UploadedFile, UseInterceptors, HttpCode, ParseIntPipe, Patch
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { basename, extname } from 'node:path';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { ImportacionService } from './importacion.service.js';
import { ConfirmarImportacionDto, DecidirFilaImportacionDto, CorregirFilaImportacionDto } from './dto/decidir-importacion.dto.js';
class CargarImportacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origen?: string;
}

type ArchivoRecibido = {
  originalname: string;
  buffer: Buffer;
};

@Controller('importaciones')
@Roles('administrador')
export class ImportacionController {
  constructor(private readonly importacion: ImportacionService) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  cargar(
    @UploadedFile() archivo: ArchivoRecibido | undefined,
    @Body() dto: CargarImportacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    if (!archivo?.buffer.length) {
      throw new BadRequestException('Adjunta un archivo CSV o XLSX');
    }

    const nombre = basename(archivo.originalname.replaceAll('\\', '/'));
        const extension = extname(nombre).toLowerCase();
    if (extension !== '.csv' && extension !== '.xlsx') {
      throw new UnsupportedMediaTypeException('Solo se admite CSV o XLSX');
    }

    const formato = extension === '.xlsx' ? 'xlsx' : 'csv';
    return this.importacion.cargarArchivo(
      usuario.id, nombre, archivo.buffer, formato, dto.origen,
    );
}

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.importacion.obtener(id, usuario.id);
  }

    @Patch(':id/filas/:numeroFila')
  @Header('Cache-Control', 'private, no-store')
  decidirFila(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('numeroFila', ParseIntPipe) numeroFila: number,
    @Body() dto: DecidirFilaImportacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.importacion.decidirFila(id, numeroFila, usuario.id, dto);
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  confirmar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarImportacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.importacion.confirmar(id, usuario.id, dto);
  }

    @Patch(':id/filas/:numeroFila/datos')
  @Header('Cache-Control', 'private, no-store')
  corregirFila(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('numeroFila', ParseIntPipe) numeroFila: number,
    @Body() dto: CorregirFilaImportacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.importacion.corregirFila(id, numeroFila, usuario.id, dto);
  }
}
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { ESTADOS_CASO } from './registrar-caso.dto.js';

export class ActualizarEstadoCasoDto {
  @ApiProperty({
    description: 'Nuevo estado del caso',
    enum: ESTADOS_CASO,
    example: 'en_proceso',
  })
  @IsString()
  @IsIn(ESTADOS_CASO, {
    message: 'El estado debe ser iniciado, en_proceso o concluido',
  })
  estado: (typeof ESTADOS_CASO)[number];
}
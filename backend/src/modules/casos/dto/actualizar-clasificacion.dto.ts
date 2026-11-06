import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export const CLASIFICACIONES_CASO = ['social', 'privado'] as const;

export class ActualizarClasificacionDto {
  @ApiProperty({ enum: CLASIFICACIONES_CASO })
  @IsString()
  @IsIn(CLASIFICACIONES_CASO)
  clasificacion: (typeof CLASIFICACIONES_CASO)[number];
}
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ESTADOS_CASO, TIPOS_CASO } from './registrar-caso.dto.js';

export class ListarCasosQuery {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de caso',
    enum: TIPOS_CASO,
    example: 'derivado',
  })
  @IsOptional()
  @IsIn(TIPOS_CASO)
  tipo?: (typeof TIPOS_CASO)[number];

  @ApiPropertyOptional({
    description: 'Filtrar por estado del caso',
    enum: ESTADOS_CASO,
    example: 'en_proceso',
  })
  @IsOptional()
  @IsIn(ESTADOS_CASO)
  estado?: (typeof ESTADOS_CASO)[number];

  @ApiPropertyOptional({
    description: 'Obtener las carpetas de un paciente específico',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @ApiPropertyOptional({
    description: 'Buscar casos por nombre del paciente',
    example: 'María',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de resultados, entre 1 y 100',
    example: 20,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de registros que se omiten para paginación',
    example: 0,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}
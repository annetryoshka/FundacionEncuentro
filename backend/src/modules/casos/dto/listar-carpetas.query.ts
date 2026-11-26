import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CLASIFICACIONES_CASO } from './actualizar-clasificacion.dto.js';
import { ESTADOS_CASO } from './registrar-caso.dto.js';

const FILTROS_RESIDENCIA = ['la_paz', 'el_alto', 'otra', 'sin_registrar'] as const;

export class ListarCarpetasQuery {
  @ApiPropertyOptional({ enum: CLASIFICACIONES_CASO })
  @IsOptional()
  @IsIn(CLASIFICACIONES_CASO)
  clasificacion?: (typeof CLASIFICACIONES_CASO)[number];

  @ApiPropertyOptional({ enum: ESTADOS_CASO })
  @IsOptional()
  @IsIn(ESTADOS_CASO)
  estado?: (typeof ESTADOS_CASO)[number];

  @ApiPropertyOptional({ enum: FILTROS_RESIDENCIA })
  @IsOptional()
  @IsIn(FILTROS_RESIDENCIA)
  residencia?: (typeof FILTROS_RESIDENCIA)[number];

  @ApiPropertyOptional({ description: 'Nombre del paciente o número de carpeta' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  busqueda?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamano: number = 10;
}
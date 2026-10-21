import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ESTADOS_CASO, TIPOS_CASO } from './registrar-caso.dto.js';

export class ListarCasosQuery {
  @IsOptional()
  @IsIn(TIPOS_CASO)
  tipo?: (typeof TIPOS_CASO)[number];

  @IsOptional()
  @IsIn(ESTADOS_CASO)
  estado?: (typeof ESTADOS_CASO)[number];

  /** Todas las carpetas de un paciente. */
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  /** Busca por nombre del paciente. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}

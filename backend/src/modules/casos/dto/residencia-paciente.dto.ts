import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const CIUDADES_RESIDENCIA = ['la_paz', 'el_alto', 'otra'] as const;

export class ResidenciaPacienteDto {
  @ApiPropertyOptional({ enum: CIUDADES_RESIDENCIA, nullable: true })
  @IsOptional()
  @IsIn(CIUDADES_RESIDENCIA)
  ciudadResidencia?: (typeof CIUDADES_RESIDENCIA)[number] | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  otraLocalidad?: string | null;
}
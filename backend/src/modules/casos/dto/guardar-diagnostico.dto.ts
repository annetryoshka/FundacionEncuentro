import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601, IsString, Matches, MaxLength, ValidateIf,
} from 'class-validator';

export class GuardarDiagnosticoDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  fecha: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @Matches(/\S/, { message: 'El diagnóstico de ingreso es obligatorio' })
  @MaxLength(10000)
  diagnosticoIngreso: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @MaxLength(10000)
  hipotesisRelacional?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @MaxLength(10000)
  comentariosClinicos?: string | null;
}
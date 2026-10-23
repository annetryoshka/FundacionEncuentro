import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarCasoDto {
  @ApiProperty({
    description: 'Nombre completo actualizado del paciente',
    example: 'María López García',
    minLength: 3,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  nombreCompleto: string;

  @ApiProperty({
    description: 'Fecha de ingreso del caso en formato AAAA-MM-DD',
    example: '2026-10-23',
    format: 'date',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, {
    message: 'La fecha de ingreso no es válida',
  })
  fechaIngreso: string;
}
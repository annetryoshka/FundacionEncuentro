import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, Matches, MaxLength } from 'class-validator';

export class RegistrarSesionDto {
  @ApiProperty({ format: 'date', example: '2026-11-12' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  fecha: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @Matches(/\S/, { message: 'La evolución de la sesión es obligatoria' })
  @MaxLength(10000)
  evolucion: string;
}
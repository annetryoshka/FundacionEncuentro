import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsIn, IsISO8601, IsString,
  Matches, MaxLength, ValidateIf,
} from 'class-validator';

export const ESTADOS_CONSENTIMIENTO = [
  'pendiente', 'registrado', 'no_aplica',
] as const;

export class ActualizarConstanciaDto {
  @ApiPropertyOptional({
    description: 'Procedencia o derivación del caso',
    maxLength: 500,
  })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @Matches(/\S/, { message: 'La procedencia no puede estar vacía' })
  @MaxLength(500)
  procedencia?: string | null;

  @ApiProperty({
    description: 'Indica si el caso proviene del juzgado',
    example: false,
  })
  @IsBoolean()
  origenJudicial: boolean;

  @ApiProperty({ enum: ESTADOS_CONSENTIMIENTO })
  @IsIn(ESTADOS_CONSENTIMIENTO)
  estado: (typeof ESTADOS_CONSENTIMIENTO)[number];

  @ApiPropertyOptional({
    description: 'Obligatoria cuando el estado es registrado',
    format: 'date',
  })
  @ValidateIf((obj, valor) =>
    obj.estado === 'registrado' ||
    (valor !== undefined && valor !== null),
  )
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, {
    message: 'La fecha de consentimiento no es válida',
  })
  fechaConsentimiento?: string | null;

  @ApiPropertyOptional({
    description: 'Referencia de evidencia; obligatoria para registrado',
    maxLength: 1000,
  })
  @ValidateIf((obj, valor) =>
    obj.estado === 'registrado' ||
    (valor !== undefined && valor !== null),
  )
  @IsString()
  @Matches(/\S/, { message: 'La referencia de evidencia es obligatoria' })
  @MaxLength(1000)
  referenciaEvidencia?: string | null;

  @ApiPropertyOptional({
    description: 'Obligatoria cuando el estado es no_aplica',
    maxLength: 1000,
  })
  @ValidateIf((obj, valor) =>
    obj.estado === 'no_aplica' ||
    (valor !== undefined && valor !== null),
  )
  @IsString()
  @Matches(/\S/, { message: 'La explicación es obligatoria' })
  @MaxLength(1000)
  explicacion?: string | null;
}
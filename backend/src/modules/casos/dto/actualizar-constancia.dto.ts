import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsIn, IsISO8601, IsString,
  Matches, MaxLength, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';
import { ContextoJudicialDto } from './contexto-judicial.dto.js';

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

  @ApiPropertyOptional({
  type: () => ContextoJudicialDto,
  nullable: true,
  description: 'Obligatorio cuando origenJudicial es true',
  })
  @ValidateIf((obj, valor) =>
    obj.origenJudicial === true ||
    (valor !== undefined && valor !== null),
  )
  @IsDefined({
    message: 'El contexto judicial es obligatorio para origen judicial',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ContextoJudicialDto)
  contextoJudicial?: ContextoJudicialDto | null;
}
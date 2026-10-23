import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const TIPOS_CASO = ['derivado', 'voluntario'] as const;
export const ESTADOS_CASO = ['iniciado', 'en_proceso', 'concluido'] as const;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MSG_FECHA = 'La fecha debe tener formato AAAA-MM-DD y ser una fecha real';

export class PacienteDto {
  @ApiProperty({
    description: 'Nombre completo del paciente',
    example: 'María López',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del paciente es obligatorio' })
  @MaxLength(150)
  nombreCompleto: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento en formato AAAA-MM-DD',
    example: '2001-05-15',
    format: 'date',
  })
  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaNacimiento?: string;

  @ApiPropertyOptional({
    description: 'Edad al ingreso. Si se omite y existe fecha de nacimiento, se calcula automáticamente.',
    example: 25,
    minimum: 0,
    maximum: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  edadAlIngreso?: number;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '71234567',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}

export class CasoDto {
  @ApiProperty({
    description: 'Tipo de caso',
    enum: TIPOS_CASO,
    example: 'derivado',
  })
  @IsIn(TIPOS_CASO, { message: 'El tipo de caso debe ser derivado o voluntario' })
  tipo: (typeof TIPOS_CASO)[number];

  @ApiPropertyOptional({
    description: 'Número manual de carpeta. Si se omite, se genera automáticamente.',
    example: 125,
    minimum: 1,
    maximum: 999999,
  })
  @IsOptional()
  @IsInt({ message: 'El número de carpeta debe ser un entero' })
  @Min(1, { message: 'El número de carpeta debe ser mayor a 0' })
  @Max(999999)
  numeroCorrelativo?: number;

  @ApiPropertyOptional({
    description: 'Estado del caso',
    enum: ESTADOS_CASO,
    example: 'iniciado',
  })
  @IsOptional()
  @IsIn(ESTADOS_CASO, { message: 'El estado debe ser iniciado, en_proceso o concluido' })
  estado?: (typeof ESTADOS_CASO)[number];

  @ApiPropertyOptional({
    description: 'Fecha de ingreso en formato AAAA-MM-DD',
    example: '2026-10-23',
    format: 'date',
  })
  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaIngreso?: string;

  @ApiPropertyOptional({
    description: 'Diagnóstico inicial del caso',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosticoIngreso?: string;

  @ApiPropertyOptional({
    description: 'Hipótesis relacional del caso',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  hipotesisRelacional?: string;

  @ApiPropertyOptional({
    description: 'Comentarios clínicos del caso',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comentariosClinicos?: string;
}

export class ContextoJudicialDto {
  @ApiPropertyOptional({
    description: 'Juzgado que deriva el caso',
    example: 'Juzgado de Familia N.º 1',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  juzgado?: string;

  @ApiPropertyOptional({
    description: 'Número de expediente judicial',
    example: 'EXP-2026-001',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nroExpediente?: string;

  @ApiPropertyOptional({
    description: 'Fecha de derivación judicial',
    example: '2026-10-20',
    format: 'date',
  })
  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaDerivacion?: string;

  @ApiPropertyOptional({
    description: 'Observaciones del contexto judicial',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}

export class RegistrarCasoDto {
  @ApiPropertyOptional({
    description: 'Datos de un paciente nuevo. Enviar paciente o pacienteId, no ambos.',
    type: () => PacienteDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PacienteDto)
  paciente?: PacienteDto;

  @ApiPropertyOptional({
    description: 'UUID de un paciente existente. Alternativa a enviar paciente.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'pacienteId no es un id válido' })
  pacienteId?: string;

  @ApiProperty({
    description: 'Datos principales del caso',
    type: () => CasoDto,
  })
  @IsDefined({ message: 'Faltan los datos del caso' })
  @ValidateNested()
  @Type(() => CasoDto)
  caso: CasoDto;

  @ApiPropertyOptional({
    description: 'Información judicial para casos derivados por un juzgado',
    type: () => ContextoJudicialDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextoJudicialDto)
  contextoJudicial?: ContextoJudicialDto;
}

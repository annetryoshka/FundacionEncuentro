import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_CASO, TIPOS_CASO } from './registrar-caso.dto.js';

export class PacienteRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'María López' })
  nombreCompleto: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'date',
    example: '2001-05-15',
  })
  fechaNacimiento: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 25 })
  edadAlIngreso: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '71234567',
  })
  telefono: string | null;
}

export class ContextoJudicialRespuestaDto {
  @ApiProperty({ type: String, nullable: true })
  juzgado: string | null;

  @ApiProperty({ type: String, nullable: true })
  nroExpediente: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  fechaDerivacion: string | null;

  @ApiProperty({ type: String, nullable: true })
  observaciones: string | null;
}

export class CarpetaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TIPOS_CASO, example: 'derivado' })
  tipo: (typeof TIPOS_CASO)[number];

  @ApiProperty({ type: Number, example: 125 })
  numeroCorrelativo: number;

  @ApiProperty({ enum: ESTADOS_CASO, example: 'iniciado' })
  estado: (typeof ESTADOS_CASO)[number];

  @ApiProperty({ format: 'date', example: '2026-10-23' })
  fechaIngreso: string;

  @ApiProperty({ type: String, nullable: true })
  diagnosticoIngreso: string | null;

  @ApiProperty({ type: String, nullable: true })
  hipotesisRelacional: string | null;

  @ApiProperty({ type: String, nullable: true })
  comentariosClinicos: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn: Date;

  @ApiProperty({ type: () => PacienteRespuestaDto })
  paciente: PacienteRespuestaDto;

  @ApiProperty({
    type: () => ContextoJudicialRespuestaDto,
    nullable: true,
  })
  contextoJudicial: ContextoJudicialRespuestaDto | null;
}

export class PosibleDuplicadoDto {
  @ApiProperty({
    description: 'Identificador del paciente posiblemente duplicado',
    format: 'uuid',
  })
  pacienteId: string;

  @ApiProperty({
    description: 'Nombre completo del paciente encontrado',
    example: 'María López García',
  })
  nombreCompleto: string;

  @ApiProperty({
    description: 'Nivel de similitud entre nombres, de 0 a 1',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  similitud: number;
}

export class RegistrarCasoRespuestaDto extends CarpetaRespuestaDto {
  @ApiProperty({
    description: 'Pacientes existentes con nombres similares. Puede ser un arreglo vacío.',
    type: () => PosibleDuplicadoDto,
    isArray: true,
  })
  posiblesDuplicados: PosibleDuplicadoDto[];
}
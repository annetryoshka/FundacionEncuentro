import { ApiProperty } from '@nestjs/swagger';
import { ESTADOS_CASO, TIPOS_CASO } from './registrar-caso.dto.js';

export class PersonaResumenDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'María López' })
  nombreCompleto: string;
}

export class CarpetaAutorizadaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 125 })
  numero: number;

  @ApiProperty({ enum: TIPOS_CASO })
  tipo: (typeof TIPOS_CASO)[number];

  @ApiProperty({ enum: ESTADOS_CASO })
  estado: (typeof ESTADOS_CASO)[number];

  @ApiProperty({
    format: 'date',
    example: '2026-10-23',
  })
  fechaIngreso: string;

  @ApiProperty({ type: () => PersonaResumenDto })
  paciente: PersonaResumenDto;

  @ApiProperty({
    type: () => PersonaResumenDto,
    nullable: true,
    description: 'Terapeuta asignado a la carpeta, si existe',
  })
  terapeuta: PersonaResumenDto | null;

  @ApiProperty({
    type: () => PersonaResumenDto,
    nullable: true,
    description: 'Usuario que registró el caso',
  })
  creadoPor: PersonaResumenDto | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  creadoEn: Date;

  @ApiProperty({
    type: () => PersonaResumenDto,
    nullable: true,
    description: 'Administrador que realizó la asignación',
  })
  asignadoPor: PersonaResumenDto | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Fecha de asignación del terapeuta',
  })
  asignadoEn: Date | null;
}
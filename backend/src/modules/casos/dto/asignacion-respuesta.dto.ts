import { ApiProperty } from '@nestjs/swagger';

export class AsignacionRespuestaDto {
  @ApiProperty({
    description: 'Identificador UUID del terapeuta asignado',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  perfilId: string;

  @ApiProperty({
    description: 'Nombre completo del terapeuta',
    example: 'Ana María López',
  })
  nombreCompleto: string;

  @ApiProperty({
    description: 'Indica si el terapeuta está activo',
    example: true,
  })
  activo: boolean;

  @ApiProperty({
    description: 'Fecha y hora de asignación del terapeuta',
    type: String,
    format: 'date-time',
    example: '2026-10-23T14:30:00.000Z',
  })
  asignadoEn: Date;
}
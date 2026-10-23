import { ApiProperty } from '@nestjs/swagger';
import { ESTADOS_CASO, TIPOS_CASO } from './registrar-caso.dto.js';

export class PacienteResumenDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'María López' })
  nombreCompleto: string;
}

export class CasoResumenDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TIPOS_CASO })
  tipo: (typeof TIPOS_CASO)[number];

  @ApiProperty({ example: 125 })
  numeroCorrelativo: number;

  @ApiProperty({ enum: ESTADOS_CASO })
  estado: (typeof ESTADOS_CASO)[number];

  @ApiProperty({ format: 'date', example: '2026-10-23' })
  fechaIngreso: string;

  @ApiProperty({ type: () => PacienteResumenDto })
  paciente: PacienteResumenDto;
}

export class ListarCasosRespuestaDto {
  @ApiProperty({ type: () => CasoResumenDto, isArray: true })
  datos: CasoResumenDto[];

  @ApiProperty({ example: 35 })
  total: number;

  @ApiProperty({ example: 20 })
  limite: number;

  @ApiProperty({ example: 0 })
  desplazamiento: number;
}
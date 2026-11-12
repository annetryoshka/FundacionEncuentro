import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ActualizarCumplimientoDto {
  @ApiProperty({ enum: ['pendiente', 'realizada'] })
  @IsIn(['pendiente', 'realizada'])
  estado: 'pendiente' | 'realizada';
}
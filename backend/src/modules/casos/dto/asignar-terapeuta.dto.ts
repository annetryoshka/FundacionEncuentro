import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AsignarTerapeutaDto {
  @ApiProperty({
    description: 'Identificador UUID del terapeuta que será asignado a la carpeta',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID(undefined, { message: 'perfilId no es un id válido' })
  perfilId: string;
}
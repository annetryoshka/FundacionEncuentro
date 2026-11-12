import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CrearTareaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sesionId: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @Matches(/\S/, { message: 'La descripción es obligatoria' })
  @MaxLength(10000)
  descripcion: string;
}
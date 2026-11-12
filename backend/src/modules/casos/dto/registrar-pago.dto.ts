import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn, IsISO8601, IsString, IsUUID,
  Matches, MaxLength, ValidateIf,
} from 'class-validator';

export class RegistrarPagoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sesionId: string;

  @ApiProperty({
    description: 'Importe en BOB como texto decimal, usando punto',
    example: '75.50',
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/, {
    message: 'El monto debe tener hasta 8 enteros y 2 decimales, usando punto',
  })
  @Matches(/[1-9]/, {
    message: 'El monto debe ser mayor que cero',
  })
  monto: string;

  @ApiProperty({ format: 'date', example: '2026-11-12' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, {
    message: 'La fecha de pago no es válida',
  })
  fecha: string;

  @ApiProperty({ enum: ['qr', 'transferencia'] })
  @IsIn(['qr', 'transferencia'])
  metodo: 'qr' | 'transferencia';

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @MaxLength(500)
  referencia?: string | null;
}
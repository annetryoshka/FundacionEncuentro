import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const CATEGORIAS_GASTO = ['internet', 'electricidad', 'alquiler', 'otros'] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export class GuardarGastoDto {
  @ApiProperty({ enum: CATEGORIAS_GASTO, example: 'internet' })
  @IsIn(CATEGORIAS_GASTO, { message: 'El tipo de gasto debe ser internet, electricidad, alquiler u otros' })
  categoria: CategoriaGasto;

  @ApiProperty({ format: 'date', example: '2026-11-20' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha del gasto no es válida' })
  fecha: string;

  @ApiProperty({ example: '120.00', description: 'Bolivianos, positivo, hasta 8 enteros y 2 decimales, como texto' })
  @IsString({ message: 'El monto debe enviarse como texto decimal, por ejemplo "120.00"' })
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/, {
    message: 'El monto debe tener hasta 8 enteros y 2 decimales, usando punto',
  })
  @Matches(/[1-9]/, { message: 'El monto debe ser mayor que cero' })
  monto: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200, example: 'Servicio mensual ficticio' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción admite hasta 200 caracteres' })
  @Matches(/\S/, { message: 'La descripción no puede quedar en blanco' })
  descripcion?: string | null;
}

export class AnularGastoDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El motivo admite hasta 200 caracteres' })
  motivo?: string | null;
}

export class ConsultarGastosQuery {
  @ApiPropertyOptional({ example: '2026-11', description: 'AAAA-MM; si falta, el mes actual en Bolivia' })
  @IsOptional()
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/, { message: 'El mes debe tener formato AAAA-MM' })
  mes?: string;
}

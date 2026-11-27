import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min,
} from 'class-validator';

export const ESTADOS_ARTICULO = ['borrador', 'publicado', 'retirado'] as const;
export type EstadoArticulo = (typeof ESTADOS_ARTICULO)[number];

export class GuardarArticuloDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Matches(/\S/, { message: 'El título es obligatorio' })
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500, description: 'Obligatorio para publicar' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumen?: string | null;

  @ApiProperty({ maxLength: 20000 })
  @IsString()
  @Matches(/\S/, { message: 'El contenido es obligatorio' })
  @MaxLength(20000)
  contenido: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, description: 'Autoría visible autorizada; null si no se autorizó' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  autorVisible?: string | null;
}

export class CambiarEstadoArticuloDto {
  @ApiProperty({ enum: ESTADOS_ARTICULO })
  @IsIn(ESTADOS_ARTICULO)
  estado: EstadoArticulo;
}

export class ListarArticulosPublicosQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamano = 10;
}

export class ListarArticulosQuery extends ListarArticulosPublicosQuery {
  @ApiPropertyOptional({ enum: ESTADOS_ARTICULO })
  @IsOptional()
  @IsIn(ESTADOS_ARTICULO)
  estado?: EstadoArticulo;
}

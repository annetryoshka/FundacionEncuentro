import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListarCarpetasQuery {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  busqueda?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamano: number = 10;
}

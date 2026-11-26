import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const TIPOS_PUBLICACION = ['campana', 'actividad', 'curso'] as const;

export class ListarPublicacionesQuery {
  @IsOptional()
  @IsIn(TIPOS_PUBLICACION)
  tipo?: (typeof TIPOS_PUBLICACION)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pagina = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamano = 10;
}

export const ESTADOS_PUBLICACION = ['borrador', 'publicado', 'retirado'] as const;
export type EstadoPublicacion = (typeof ESTADOS_PUBLICACION)[number];

export class ListarPublicacionesAdminQuery extends ListarPublicacionesQuery {
  @IsOptional()
  @IsIn(ESTADOS_PUBLICACION)
  estado?: EstadoPublicacion;
}

export class CambiarEstadoPublicacionDto {
  @IsIn(ESTADOS_PUBLICACION)
  estado: EstadoPublicacion;
}
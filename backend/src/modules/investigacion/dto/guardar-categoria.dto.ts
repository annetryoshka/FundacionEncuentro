import {
  IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength,
} from 'class-validator';

export class EditarCategoriaDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @IsOptional()
  @IsUUID()
  padreId?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string | null;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class CrearCategoriaDto extends EditarCategoriaDto {
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
  @MaxLength(30)
  codigo: string;
}
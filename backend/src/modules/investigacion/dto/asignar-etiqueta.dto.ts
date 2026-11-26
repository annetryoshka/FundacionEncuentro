import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AsignarEtiquetaDto {
  @IsUUID()
  categoriaId: string;

  @IsOptional()
  @IsUUID()
  fichaDiagnosticoId?: string | null;

  @IsOptional()
  @IsUUID()
  fichaSeguimientoId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fragmento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string | null;
}
import {
  IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min, IsObject
} from 'class-validator';

class VersionImportacionDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  version: number;
}

export class DecidirFilaImportacionDto extends VersionImportacionDto {
  @IsIn(['crear', 'vincular', 'excluir'])
  decision: 'crear' | 'vincular' | 'excluir';

  @IsOptional()
  @IsUUID()
  pacienteDestinoId?: string;

  @IsOptional()
  @IsUUID()
  casoDestinoId?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(2147483647)
  filaDestino?: number;
}

export class ConfirmarImportacionDto extends VersionImportacionDto {
  @IsOptional()
  @IsBoolean()
  aceptaAvanceContador?: boolean;
}

export class CorregirFilaImportacionDto extends VersionImportacionDto {
  @IsObject()
  datos: Record<string, string | null>;
}
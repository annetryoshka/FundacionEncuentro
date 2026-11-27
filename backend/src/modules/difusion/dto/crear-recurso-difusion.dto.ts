import {
  IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min,
} from 'class-validator';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class CrearRecursoDifusionDto {
  @IsString()
  @MaxLength(300)
  @Matches(/^(?!.*\.\.)[A-Za-z0-9_-][A-Za-z0-9/_.-]*$/)
  ruta: string;

  @IsIn(TIPOS_IMAGEN)
  tipoMime: (typeof TIPOS_IMAGEN)[number];

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  tamanoBytes: number;

  @IsString()
  @Matches(/\S/)
  @MaxLength(300)
  textoAlternativo: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  ancho?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  alto?: number;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}
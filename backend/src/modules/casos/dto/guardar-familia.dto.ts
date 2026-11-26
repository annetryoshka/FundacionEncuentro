import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const PARENTESCOS = [
  'madre', 'padre', 'hermano', 'hermana', 'hijo', 'hija',
  'abuelo_materno', 'abuela_materna', 'abuelo_paterno', 'abuela_paterna',
  'tio', 'tia', 'pareja', 'tutor', 'tutora', 'otro',
] as const;

export class FamiliarEntradaDto {
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @IsIn(PARENTESCOS)
  parentesco: (typeof PARENTESCOS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentescoDetalle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreCompleto?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaNacimiento?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  edadReferida?: number | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaReferencia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ocupacion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lugarTrabajoEstudio?: string | null;

  @IsOptional()
  @IsBoolean()
  conviveConPaciente?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class GuardarFamiliaDto {
  @ValidateIf((_dto, valor) => valor !== null)
  @IsInt()
  @Min(1)
  version: number | null;

  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => FamiliarEntradaDto)
  familiares: FamiliarEntradaDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  eliminarIds?: string[];
}
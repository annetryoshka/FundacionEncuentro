import { Transform } from 'class-transformer';
import {
  IsArray, IsIn, IsISO8601, IsOptional, IsUUID, Matches,
} from 'class-validator';

const RESIDENCIAS = ['la_paz', 'el_alto', 'otra', 'sin_registrar'] as const;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class FiltrosInvestigacionQuery {
  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  desde?: string;

  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  hasta?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  @IsArray()
  @IsIn(RESIDENCIAS, { each: true })
  residencias?: string[];
}

export class SeleccionInvestigacionQuery extends FiltrosInvestigacionQuery {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  @IsArray()
  @IsUUID(undefined, { each: true })
  categorias?: string[];
}
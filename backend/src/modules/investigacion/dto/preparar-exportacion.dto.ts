import {
  ArrayNotEmpty, IsArray, IsIn, IsISO8601, IsOptional, IsUUID, Matches,
} from 'class-validator';

const SECCIONES = ['diagnostico', 'seguimiento', 'tareas'] as const;
const FORMATOS = ['docx', 'txt'] as const;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class PrepararExportacionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  casosIds: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SECCIONES, { each: true })
  secciones: (typeof SECCIONES)[number][];

  @IsIn(FORMATOS)
  formato: (typeof FORMATOS)[number];

  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  desde?: string;

  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  hasta?: string;
}
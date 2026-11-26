import { Equals, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
import type { ParametrosExportacion } from '../exportaciones-registro.service.js';

export class GenerarExportacionDto implements ParametrosExportacion {
  @IsIn(['informe', 'ficha', 'historial'])
  documento!: ParametrosExportacion['documento'];

  @IsIn(['pdf', 'docx'])
  formato!: ParametrosExportacion['formato'];

  @IsOptional()
  @Equals(1)
  formatoVersion?: 1;

  @IsOptional()
  @IsUUID()
  informeVersionId?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['identificacion', 'familia', 'diagnostico', 'sesiones'], { each: true })
  secciones?: ParametrosExportacion['secciones'];

  @IsOptional()
  @IsBoolean()
  incluirGenograma?: boolean;

  @IsOptional()
  @IsBoolean()
  incluirPagos?: boolean;

  @IsOptional()
  @IsObject()
  datosMostrados?: Record<string, unknown>;
}
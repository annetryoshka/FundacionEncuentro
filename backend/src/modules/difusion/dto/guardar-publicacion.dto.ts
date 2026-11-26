import {
  IsIn, IsISO8601, IsOptional, IsString, IsUrl, Matches, MaxLength,
} from 'class-validator';
import { TIPOS_PUBLICACION } from './listar-publicaciones.query.js';

const MODALIDADES = ['presencial', 'virtual', 'mixta'] as const;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class GuardarPublicacionDto {
  @IsIn(TIPOS_PUBLICACION)
  tipo: (typeof TIPOS_PUBLICACION)[number];

  @IsString()
  @Matches(/\S/)
  @MaxLength(150)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumen?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  contenido?: string | null;

  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  fechaInicio?: string | null;

  @IsOptional()
  @Matches(FECHA)
  @IsISO8601({ strict: true })
  fechaFin?: string | null;

  @IsOptional()
  @IsIn(MODALIDADES)
  modalidad?: (typeof MODALIDADES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lugar?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  contactoUrl?: string | null;
}
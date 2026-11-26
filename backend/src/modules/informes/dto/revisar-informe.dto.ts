import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsObject,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

class SeccionRevisadaDto {
  @IsString()
  @Matches(/\S/)
  titulo: string;

  @IsString()
  contenido: string;
}

export class RevisarInformeDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SeccionRevisadaDto)
  secciones: SeccionRevisadaDto[];
}
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GenerarInformeDto {
  @IsIn(['intervencion_sistemica', 'judicial'])
  tipo: 'intervencion_sistemica' | 'judicial';

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  sesionesIds?: string[];

  @IsOptional()
  @IsBoolean()
  incluirFamilia?: boolean;

  @IsOptional()
  @IsBoolean()
  incluirGenograma?: boolean;

  @IsOptional()
  @IsString()
  objeto?: string;
}
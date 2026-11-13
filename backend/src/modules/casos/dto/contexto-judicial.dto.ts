import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601, IsString, Matches, MaxLength, ValidateIf,
} from 'class-validator';

export class ContextoJudicialDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Matches(/\S/, { message: 'El juzgado es obligatorio' })
  @MaxLength(200)
  juzgado: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @MaxLength(100)
  nroExpediente?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  fechaDerivacion?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @ValidateIf((_obj, valor) => valor !== undefined && valor !== null)
  @IsString()
  @MaxLength(1000)
  observaciones?: string | null;
}
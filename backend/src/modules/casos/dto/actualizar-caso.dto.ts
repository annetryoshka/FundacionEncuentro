
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarCasoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  nombreCompleto: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, {
    message: 'La fecha de ingreso no es válida',
  })
  fechaIngreso: string;
}

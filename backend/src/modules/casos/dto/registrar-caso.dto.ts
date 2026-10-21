import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const TIPOS_CASO = ['derivado', 'voluntario'] as const;
export const ESTADOS_CASO = ['iniciado', 'en_proceso', 'concluido'] as const;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MSG_FECHA = 'La fecha debe tener formato AAAA-MM-DD y ser una fecha real';

export class PacienteDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del paciente es obligatorio' })
  @MaxLength(150)
  nombreCompleto: string;

  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaNacimiento?: string;

  /** Si no se envía y hay fecha de nacimiento, se calcula con la fecha de ingreso. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  edadAlIngreso?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}

export class CasoDto {
  @IsIn(TIPOS_CASO, { message: 'El tipo de caso debe ser derivado o voluntario' })
  tipo: (typeof TIPOS_CASO)[number];

  /**
   * Número de carpeta manual (para registrar carpetas antiguas con su número original).
   * Si no se envía, se asigna el siguiente correlativo del tipo.
   */
  @IsOptional()
  @IsInt({ message: 'El número de carpeta debe ser un entero' })
  @Min(1, { message: 'El número de carpeta debe ser mayor a 0' })
  @Max(999999)
  numeroCorrelativo?: number;

  @IsOptional()
  @IsIn(ESTADOS_CASO, { message: 'El estado debe ser iniciado, en_proceso o concluido' })
  estado?: (typeof ESTADOS_CASO)[number];

  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaIngreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosticoIngreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  hipotesisRelacional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comentariosClinicos?: string;
}

export class ContextoJudicialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  juzgado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nroExpediente?: string;

  @IsOptional()
  @Matches(FECHA, { message: MSG_FECHA })
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaDerivacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}

export class RegistrarCasoDto {
  /** Paciente nuevo. Se envía este o pacienteId, no ambos. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PacienteDto)
  paciente?: PacienteDto;

  /** Paciente que ya existe: abre una carpeta nueva para él. */
  @IsOptional()
  @IsUUID(undefined, { message: 'pacienteId no es un id válido' })
  pacienteId?: string;

  @IsDefined({ message: 'Faltan los datos del caso' })
  @ValidateNested()
  @Type(() => CasoDto)
  caso: CasoDto;

  /** Solo para casos derivados por un juzgado. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextoJudicialDto)
  contextoJudicial?: ContextoJudicialDto;
}

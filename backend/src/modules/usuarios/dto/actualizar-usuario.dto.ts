import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLES_VALIDOS } from './crear-usuario.dto.js';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @MaxLength(120)
  nombreCompleto?: string;

  @IsOptional()
  @IsIn(ROLES_VALIDOS, { message: 'El rol debe ser administrador, terapeuta o marketing' })
  rol?: (typeof ROLES_VALIDOS)[number];

  @IsOptional()
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo?: boolean;
}

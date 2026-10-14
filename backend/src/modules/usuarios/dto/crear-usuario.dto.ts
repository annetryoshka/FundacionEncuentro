import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const ROLES_VALIDOS = ['administrador', 'terapeuta', 'marketing'] as const;

export class CrearUsuarioDto {
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  nombreCompleto: string;

  @IsIn(ROLES_VALIDOS, { message: 'El rol debe ser administrador, terapeuta o marketing' })
  rol: (typeof ROLES_VALIDOS)[number];
}

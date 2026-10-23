import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const ROLES_VALIDOS = ['administrador', 'terapeuta', 'marketing'] as const;

export class CrearUsuarioDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'terapeuta@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario, entre 10 y 72 caracteres',
    example: 'ClaveSegura123',
    minLength: 10,
    maxLength: 72,
    writeOnly: true,
  })
  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'María Pérez',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  nombreCompleto: string;

  @ApiProperty({
    description: 'Rol asignado al usuario',
    enum: ROLES_VALIDOS,
    example: 'terapeuta',
  })
  @IsIn(ROLES_VALIDOS, { message: 'El rol debe ser administrador, terapeuta o marketing' })
  rol: (typeof ROLES_VALIDOS)[number];
}
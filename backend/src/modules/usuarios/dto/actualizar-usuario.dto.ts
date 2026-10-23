import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLES_VALIDOS } from './crear-usuario.dto.js';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre completo del usuario',
    example: 'María Pérez García',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @MaxLength(120)
  nombreCompleto?: string;

  @ApiPropertyOptional({
    description: 'Nuevo rol del usuario',
    enum: ROLES_VALIDOS,
    example: 'terapeuta',
  })
  @IsOptional()
  @IsIn(ROLES_VALIDOS, { message: 'El rol debe ser administrador, terapeuta o marketing' })
  rol?: (typeof ROLES_VALIDOS)[number];

  @ApiPropertyOptional({
    description: 'Indica si el usuario está activo',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo?: boolean;
}
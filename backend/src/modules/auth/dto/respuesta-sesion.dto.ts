import { ApiProperty } from '@nestjs/swagger';

export class UsuarioSesionDto {
  @ApiProperty({
    description: 'Identificador único del usuario',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'María Pérez',
  })
  nombreCompleto: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: ['administrador', 'terapeuta', 'marketing'],
  })
  rol: string;
}

export class RespuestaSesionDto {
  @ApiProperty({
    description: 'Token JWT utilizado para acceder a los endpoints protegidos',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token utilizado para renovar la sesión',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Duración del token de acceso en segundos',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Información del usuario autenticado',
    type: () => UsuarioSesionDto,
  })
  usuario: UsuarioSesionDto;
}
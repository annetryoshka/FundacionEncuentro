import { ApiProperty } from '@nestjs/swagger';
import { ROLES_VALIDOS } from './crear-usuario.dto.js';

export class UsuarioDetalleDto {
  @ApiProperty({
    description: 'Identificador único del usuario',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'terapeuta@ejemplo.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'María Pérez',
  })
  nombreCompleto: string;

  @ApiProperty({
    description: 'Rol asignado al usuario',
    enum: ROLES_VALIDOS,
    example: 'terapeuta',
  })
  rol: (typeof ROLES_VALIDOS)[number];

  @ApiProperty({
    description: 'Estado del usuario',
    example: true,
  })
  activo: boolean;

  @ApiProperty({
    description: 'Fecha de creación del usuario',
    type: String,
    format: 'date-time',
    example: '2026-10-20T14:30:00.000Z',
  })
  creadoEn: Date;
}

export class ListaUsuariosRespuestaDto {
  @ApiProperty({
    description: 'Usuarios registrados que cumplen los filtros',
    type: () => UsuarioDetalleDto,
    isArray: true,
  })
  usuarios: UsuarioDetalleDto[];
}
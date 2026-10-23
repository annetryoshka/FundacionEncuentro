import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { TokenActual } from '../../common/decorators/token-actual.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiOkResponse } from '@nestjs/swagger';
import { RespuestaSesionDto } from './dto/respuesta-sesion.dto.js';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica al usuario mediante su correo electrónico y contraseña.',
  })
  @ApiOkResponse({
    description: 'Inicio de sesión exitoso.',
    type: RespuestaSesionDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales incorrectas.',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renovar sesión',
    description: 'Genera nuevos tokens utilizando un refresh token válido.',
  })
  @ApiOkResponse({
    description: 'Sesión renovada correctamente.',
    type: RespuestaSesionDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido o expirado.',
  })
  refrescar(@Body() dto: RefreshDto) {
    return this.auth.refrescar(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Cierra la sesión del usuario autenticado.',
  })
  @ApiResponse({
    status: 204,
    description: 'Sesión cerrada correctamente. Sin contenido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuario no autenticado.',
  })
  async logout(
    @UsuarioActual() usuario: Usuario,
    @TokenActual() token: string,
  ) {
    await this.auth.logout(usuario.id, token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener usuario autenticado',
    description: 'Devuelve la información del usuario correspondiente al token de acceso.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del usuario autenticado.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuario no autenticado.',
  })
  me(@UsuarioActual() usuario: Usuario) {
    return usuario;
  }
}
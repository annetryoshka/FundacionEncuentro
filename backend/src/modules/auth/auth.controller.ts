import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Inicia sesión con correo y contraseña. */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /** Renueva la sesión cuando el accessToken expira. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  refrescar(@Body() dto: RefreshDto) {
    return this.auth.refrescar(dto.refreshToken);
  }

  /** Datos del usuario con sesión iniciada (sirve para recuperar la sesión). */
  @Get('me')
  me(@UsuarioActual() usuario: Usuario) {
    return usuario;
  }
}

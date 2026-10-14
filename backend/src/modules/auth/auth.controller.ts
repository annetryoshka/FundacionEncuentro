import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { TokenActual } from '../../common/decorators/token-actual.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Usuario } from '../../common/types/usuario.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  @Post('logout')
  @HttpCode(204)
  async logout(@UsuarioActual() usuario: Usuario, @TokenActual() token: string) {
    await this.auth.logout(usuario.id, token);
  }

  @Get('me')
  me(@UsuarioActual() usuario: Usuario) {
    return usuario;
  }
}

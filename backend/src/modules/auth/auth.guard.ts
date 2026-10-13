import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICA } from '../../common/decorators/public.decorator.js';
import type { RequestConUsuario } from '../../common/types/usuario.js';
import { AuthService } from './auth.service.js';
import { SupabaseAuthClient } from './supabase-auth.client.js';

/** Guard global: toda ruta exige sesión salvo las marcadas con @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseAuthClient,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(ES_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const token = this.extraerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Falta iniciar sesión');

    const usuarioSupabase = await this.supabase.obtenerUsuario(token);
    if (!usuarioSupabase) throw new UnauthorizedException('Sesión inválida o expirada');

    request.usuario = await this.auth.cargarPerfil(usuarioSupabase.id);
    request.token = token;
    return true;
  }

  private extraerToken(cabecera: string | string[] | undefined): string | null {
    const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera;
    if (!valor) return null;
    const [tipo, token] = valor.split(' ');
    return tipo?.toLowerCase() === 'bearer' && token ? token : null;
  }
}

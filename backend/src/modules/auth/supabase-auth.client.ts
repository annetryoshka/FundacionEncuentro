import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SesionSupabase {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string };
}

/** Habla con la API de Supabase Auth (login, refresh, validar token). */
@Injectable()
export class SupabaseAuthClient {
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
  }

  async loginConPassword(email: string, password: string): Promise<SesionSupabase> {
    const res = await this.llamar('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return this.leerSesion(res, 'Correo o contraseña incorrectos');
  }

  async refrescar(refreshToken: string): Promise<SesionSupabase> {
    const res = await this.llamar('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return this.leerSesion(res, 'La sesión expiró, inicia sesión de nuevo');
  }

  /**
   * Cierra SOLO la sesión de este dispositivo (scope=local): el refresh token
   * deja de servir y el token de acceso se invalida.
   */
  async cerrarSesion(accessToken: string): Promise<void> {
    const res = await this.llamar('/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status >= 500) throw this.servicioCaido();
    // 401/403: la sesión ya estaba cerrada o vencida; el resultado es el mismo.
  }

  /** Devuelve el usuario dueño del token, o null si el token no sirve. */
  async obtenerUsuario(accessToken: string): Promise<{ id: string } | null> {
    const res = await this.llamar('/auth/v1/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status >= 500) throw this.servicioCaido();
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id ? { id: user.id } : null;
  }

  // --- internos -----------------------------------------------------------

  private async llamar(ruta: string, init: RequestInit & { headers?: Record<string, string> }) {
    try {
      return await fetch(`${this.url}${ruta}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.anonKey,
          ...init.headers,
        },
      });
    } catch {
      throw this.servicioCaido();
    }
  }

  private async leerSesion(res: Response, mensajeInvalido: string): Promise<SesionSupabase> {
    if (res.status === 429) {
      throw new HttpException('Demasiados intentos, espera un momento', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (res.status >= 500) throw this.servicioCaido();
    if (!res.ok) throw new UnauthorizedException(mensajeInvalido);
    return (await res.json()) as SesionSupabase;
  }

  private servicioCaido() {
    return new ServiceUnavailableException('No se pudo contactar el servicio de autenticación');
  }
}

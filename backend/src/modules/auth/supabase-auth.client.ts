import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  BadGatewayException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SUPABASE_AUTH_TIMEOUT_MS = 5_000;

export interface SesionSupabase {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string };
}

/*upabase Auth (login, refresh, validar token). */
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

  /** Solicita a Supabase el cierre de la sesión actual (scope=local). */
  async cerrarSesion(accessToken: string): Promise<void> {
    const res = await this.llamar('/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204) return;

    if (res.status >= 500) throw this.servicioCaido();

    throw new BadGatewayException(
      'El servicio de autenticación no confirmó la revocación de la sesión',
    );
  }

  async obtenerUsuario(accessToken: string): Promise<{ id: string } | null> {
    const res = await this.llamar('/auth/v1/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status >= 500) throw this.servicioCaido();
    if (!res.ok) return null;
    const user = await this.leerJson<{ id?: string }>(res);
    return user.id ? { id: user.id } : null;
  }

  // --- internos -----------------------------------------------------------

  private async llamar(
    ruta: string,
    init: RequestInit & { headers?: Record<string, string> },
  ): Promise<Response> {
    try {
      return await fetch(`${this.url}${ruta}`, {
        ...init,
        signal: AbortSignal.timeout(SUPABASE_AUTH_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          apikey: this.anonKey,
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'El servicio de autenticación superó el tiempo de espera',
        );
      }
      throw this.servicioCaido();
    }
  }

  private async leerJson<T>(res: Response): Promise<T> {
    try {
        return (await res.json()) as T;
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
          throw new GatewayTimeoutException(
            'El servicio de autenticación superó el tiempo de espera',
          );
        }
        throw this.servicioCaido();
      }
  }

  private async leerSesion(res: Response, mensajeInvalido: string): Promise<SesionSupabase> {
    if (res.status === 429) {
      throw new HttpException('Demasiados intentos, espera un momento', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (res.status >= 500) throw this.servicioCaido();
    if (!res.ok) throw new UnauthorizedException(mensajeInvalido);
    return this.leerJson<SesionSupabase>(res);
  }

  private servicioCaido() {
    return new ServiceUnavailableException('No se pudo contactar el servicio de autenticación');
  }
}

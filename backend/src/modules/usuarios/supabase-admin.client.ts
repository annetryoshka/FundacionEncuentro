import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Operaciones de administración sobre Supabase Auth.
 * Usa la llave service_role: SOLO existe en el backend, nunca en el frontend.
 */
@Injectable()
export class SupabaseAdminClient {
  private readonly logger = new Logger(SupabaseAdminClient.name);
  private readonly url: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    this.serviceKey = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
  }

  /** Crea la cuenta (ya confirmada) y devuelve su id. */
  async crearUsuario(email: string, password: string): Promise<{ id: string }> {
    const res = await this.llamar('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    if (res.status === 409 || res.status === 422) {
      const cuerpo = (await res.json().catch(() => ({}))) as {
        error_code?: string;
        code?: string;
        msg?: string;
      };
      const codigo = cuerpo.error_code ?? cuerpo.code;
      if (codigo === 'email_exists' || codigo === 'user_already_exists') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      if (codigo === 'weak_password') {
        throw new BadRequestException('La contraseña es demasiado débil');
      }
      throw new BadRequestException(cuerpo.msg ?? 'No se pudo crear el usuario');
    }
    if (res.status >= 500) throw this.servicioCaido();
    if (!res.ok) {
      this.logger.error(`Supabase rechazó la creación de usuario (HTTP ${res.status}). Revisa SUPABASE_SERVICE_ROLE_KEY.`);
      throw new InternalServerErrorException('Error de configuración del servicio de autenticación');
    }

    const user = (await res.json()) as { id: string };
    return { id: user.id };
  }

  /** Borra una cuenta (se usa para deshacer una creación que quedó a medias). */
  async eliminarUsuario(id: string): Promise<void> {
    const res = await this.llamar(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      this.logger.error(`No se pudo borrar el usuario ${id} de Supabase Auth (HTTP ${res.status})`);
    }
  }

  private async llamar(ruta: string, init: RequestInit) {
    try {
      return await fetch(`${this.url}${ruta}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });
    } catch {
      throw this.servicioCaido();
    }
  }

  private servicioCaido() {
    return new ServiceUnavailableException('No se pudo contactar el servicio de autenticación');
  }
}

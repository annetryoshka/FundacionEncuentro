import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';
import { SupabaseAuthClient, type SesionSupabase } from './supabase-auth.client.js';

export interface RespuestaSesion {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: Usuario;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseAuthClient,
    private readonly db: DatabaseService,
  ) {}

  async login(email: string, password: string): Promise<RespuestaSesion> {
    const sesion = await this.supabase.loginConPassword(email, password);
    const usuario = await this.cargarPerfil(sesion.user.id);

    // Queda registrado en la auditoría quién inició sesión.
    await this.db.query(
      `insert into auditoria (usuario_id, accion, tabla) values ($1, 'LOGIN', 'auth')`,
      [usuario.id],
    );

    return this.armarRespuesta(sesion, usuario);
  }

  async logout(usuarioId: string, accessToken: string): Promise<void> {
    await this.supabase.cerrarSesion(accessToken);

    await this.db.query(
      `insert into auditoria (usuario_id, accion, tabla) values ($1, 'LOGOUT', 'auth')`,
      [usuarioId],
    );
  }

  async refrescar(refreshToken: string): Promise<RespuestaSesion> {
    const sesion = await this.supabase.refrescar(refreshToken);
    const usuario = await this.cargarPerfil(sesion.user.id);
    return this.armarRespuesta(sesion, usuario);
  }

  async cargarPerfil(usuarioId: string): Promise<Usuario> {
    const { rows } = await this.db.query<{
      id: string;
      nombre_completo: string;
      rol: Usuario['rol'];
      activo: boolean;
    }>('select id, nombre_completo, rol, activo from perfiles where id = $1', [usuarioId]);

    const perfil = rows[0];
    if (!perfil || !perfil.activo) {
      throw new ForbiddenException('Tu usuario no tiene acceso al sistema');
    }
    return { id: perfil.id, nombreCompleto: perfil.nombre_completo, rol: perfil.rol };
  }

  private armarRespuesta(sesion: SesionSupabase, usuario: Usuario): RespuestaSesion {
    return {
      accessToken: sesion.access_token,
      refreshToken: sesion.refresh_token,
      expiresIn: sesion.expires_in,
      usuario,
    };
  }
}

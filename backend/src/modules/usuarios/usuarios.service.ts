import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { Rol } from '../../common/types/usuario.js';
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import type { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { SupabaseAdminClient } from './supabase-admin.client.js';

export interface UsuarioDetalle {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
}

const SELECT_USUARIO = `
  select p.id, u.email, p.nombre_completo, p.rol, p.activo, p.creado_en
    from perfiles p
    join auth.users u on u.id = p.id`;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly admin: SupabaseAdminClient,
  ) {}

  async listar(): Promise<UsuarioDetalle[]> {
    const { rows } = await this.db.query(`${SELECT_USUARIO} order by p.creado_en`);
    return rows.map(this.aDetalle);
  }

  async obtener(id: string): Promise<UsuarioDetalle> {
    const { rows } = await this.db.query(`${SELECT_USUARIO} where p.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Usuario no encontrado');
    return this.aDetalle(rows[0]);
  }

  /** Crea la cuenta en Supabase Auth y su perfil con rol. Si el perfil falla, deshace la cuenta. */
  async crear(dto: CrearUsuarioDto, adminId: string): Promise<UsuarioDetalle> {
    const cuenta = await this.admin.crearUsuario(dto.email, dto.password);

    try {
      await this.db.transaction(adminId, (client) =>
        client.query('insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)', [
          cuenta.id,
          dto.nombreCompleto.trim(),
          dto.rol,
        ]),
      );
    } catch (error) {
      await this.admin.eliminarUsuario(cuenta.id);
      throw error;
    }

    return this.obtener(cuenta.id);
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, adminId: string): Promise<UsuarioDetalle> {
    const cambios: string[] = [];
    const valores: unknown[] = [];
    const agregar = (columna: string, valor: unknown) => {
      valores.push(valor);
      cambios.push(`${columna} = $${valores.length}`);
    };

    if (dto.nombreCompleto !== undefined) agregar('nombre_completo', dto.nombreCompleto.trim());
    if (dto.rol !== undefined) agregar('rol', dto.rol);
    if (dto.activo !== undefined) agregar('activo', dto.activo);

    if (cambios.length === 0) {
      throw new BadRequestException('No hay nada que actualizar');
    }

    // Evita que el administrador se deje a sí mismo sin acceso.
    if (id === adminId && (dto.activo === false || (dto.rol && dto.rol !== 'administrador'))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte tu propio rol de administrador');
    }

    await this.obtener(id); // 404 si no existe

    valores.push(id);
    await this.db.transaction(adminId, (client) =>
      client.query(`update perfiles set ${cambios.join(', ')} where id = $${valores.length}`, valores),
    );

    return this.obtener(id);
  }

  private aDetalle(fila: {
    id: string;
    email: string;
    nombre_completo: string;
    rol: Rol;
    activo: boolean;
    creado_en: Date;
  }): UsuarioDetalle {
    return {
      id: fila.id,
      email: fila.email,
      nombreCompleto: fila.nombre_completo,
      rol: fila.rol,
      activo: fila.activo,
      creadoEn: fila.creado_en,
    };
  }
}

import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';
import type { RegistrarSesionDto } from './dto/registrar-sesion.dto.js';

interface FilaSesion {
  id: string;
  caso_id: string;
  nro_sesion: number;
  fecha: string;
  evolucion: string;
  responsable_id: string;
  responsable_nombre: string;
  creado_por: string | null;
  creado_en: Date;
  actualizado_por: string | null;
  actualizado_en: Date;
}

const SELECT_SESION = `
  select s.id, s.caso_id, s.nro_sesion,
         to_char(s.fecha, 'YYYY-MM-DD') as fecha,
         s.evolucion, s.responsable_id,
         r.nombre_completo as responsable_nombre,
         s.creado_por, s.creado_en,
         s.actualizado_por, s.actualizado_en
    from fichas_seguimiento s
    join perfiles r on r.id = s.responsable_id
`;

@Injectable()
export class SesionesService {
  constructor(private readonly db: DatabaseService) {}

  private async verificarAcceso(
    client: PoolClient,
    casoId: string,
    usuario: Usuario,
  ) {
    const caso = await client.query(
      `select c.id
         from casos c
         join pacientes p on p.id = c.paciente_id
        where c.id = $1
          and c.deleted_at is null
          and p.deleted_at is null
        for update of c`,
      [casoId],
    );

    if (!caso.rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }

    const acceso = await client.query(
      `select 1
        where $1::text = 'administrador'
           or (
             $1::text = 'terapeuta'
             and exists (
               select 1 from asignaciones_caso
                where caso_id = $2 and perfil_id = $3
             )
           )`,
      [usuario.rol, casoId, usuario.id],
    );

    if (!acceso.rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }
  }

  async registrar(
    casoId: string,
    dto: RegistrarSesionDto,
    usuario: Usuario,
  ) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const responsable = await client.query<{ id: string }>(
        `select p.id
           from asignaciones_caso a
           join perfiles p on p.id = a.perfil_id
          where a.caso_id = $1
            and p.rol = 'terapeuta'
            and p.activo = true
          for share of a, p`,
        [casoId],
      );

      if (responsable.rows.length !== 1) {
        throw new BadRequestException(
          'El caso debe tener una terapeuta activa asignada para registrar sesiones',
        );
      }

      const { rows } = await client.query<{ id: string }>(
        `insert into fichas_seguimiento (
           caso_id, fecha, evolucion, responsable_id,
           creado_por, actualizado_por
         )
         values ($1, $2::date, $3, $4, $5, $5)
         returning id`,
        [
          casoId,
          dto.fecha,
          dto.evolucion.trim(),
          responsable.rows[0].id,
          usuario.id,
        ],
      );

      // Leer antes del COMMIT: un fallo también revierte el alta.
      const sesion = await client.query<FilaSesion>(
        `${SELECT_SESION} where s.id = $1 and s.caso_id = $2`,
        [rows[0].id, casoId],
      );

      if (!sesion.rows[0]) {
        throw new NotFoundException('No se pudo recuperar la sesión creada');
      }

      return { sesion: this.respuesta(sesion.rows[0]) };
    });
  }

  async listar(casoId: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const { rows } = await client.query<FilaSesion>(
        `${SELECT_SESION}
          where s.caso_id = $1
          order by s.fecha asc, s.nro_sesion asc, s.id asc`,
        [casoId],
      );

      return {
        sesiones: rows.map((fila) => {
          const sesion = this.respuesta(fila);
          const { evolucion, ...resumen } = sesion;
          return resumen;
        }),
      };
    });
  }

  async obtener(
    casoId: string,
    sesionId: string,
    usuario: Usuario,
  ) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const { rows } = await client.query<FilaSesion>(
        `${SELECT_SESION}
          where s.id = $1 and s.caso_id = $2`,
        [sesionId, casoId],
      );

      if (!rows[0]) {
        throw new NotFoundException('Sesión no encontrada');
      }

      return { sesion: this.respuesta(rows[0]) };
    });
  }

  private respuesta(fila: FilaSesion) {
    return {
      id: fila.id,
      casoId: fila.caso_id,
      numero: fila.nro_sesion,
      fecha: fila.fecha,
      evolucion: fila.evolucion,
      responsable: {
        id: fila.responsable_id,
        nombreCompleto: fila.responsable_nombre,
      },
      creadoPor: fila.creado_por,
      creadoEn: fila.creado_en,
      actualizadoPor: fila.actualizado_por,
      actualizadoEn: fila.actualizado_en,
    };
  }
}
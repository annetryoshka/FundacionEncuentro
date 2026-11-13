import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';
import type { CrearTareaDto } from './dto/crear-tarea.dto.js';
import type { ActualizarCumplimientoDto } from './dto/actualizar-cumplimiento.dto.js';

interface FilaTarea {
  id: string;
  caso_id: string;
  sesion_id: string;
  nro_sesion: number;
  descripcion: string;
  completada: boolean;
  fecha_asignada: string;
  perfil_id: string | null;
  creado_en: Date;
  cumplimiento_actualizado_por: string | null;
  cumplimiento_actualizado_en: Date | null;
}

const SELECT_TAREA = `
  select t.id, t.caso_id, t.sesion_id, s.nro_sesion,
         t.descripcion, t.completada,
         to_char(t.fecha_asignada, 'YYYY-MM-DD') as fecha_asignada,
         t.perfil_id, t.creado_en,
         t.cumplimiento_actualizado_por,
         t.cumplimiento_actualizado_en
    from tareas_terapeuticas t
    join fichas_seguimiento s
      on s.id = t.sesion_id and s.caso_id = t.caso_id
`;

@Injectable()
export class TareasService {
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

  async crear(casoId: string, dto: CrearTareaDto, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const sesion = await client.query(
        `select id
           from fichas_seguimiento
          where id = $1 and caso_id = $2
          for share`,
        [dto.sesionId, casoId],
      );

      if (!sesion.rows[0]) {
        throw new BadRequestException(
          'La sesión no existe o no pertenece al caso',
        );
      }

      const { rows } = await client.query<{ id: string }>(
        `insert into tareas_terapeuticas (
           caso_id, sesion_id, descripcion, completada, perfil_id
         )
         values ($1, $2, $3, false, $4)
         returning id`,
        [casoId, dto.sesionId, dto.descripcion.trim(), usuario.id],
      );

      return {
        tarea: await this.leerTarea(client, casoId, rows[0].id),
      };
    });
  }

  async listar(casoId: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const { rows } = await client.query<FilaTarea>(
        `${SELECT_TAREA}
          where t.caso_id = $1
          order by s.fecha asc, s.nro_sesion asc,
                   t.creado_en asc, t.id asc`,
        [casoId],
      );

      return { tareas: rows.map((fila) => this.respuesta(fila)) };
    });
  }

  async actualizarCumplimiento(
    casoId: string,
    tareaId: string,
    dto: ActualizarCumplimientoDto,
    usuario: Usuario,
  ) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, casoId, usuario);

      const tarea = await client.query(
        `select id
           from tareas_terapeuticas
          where id = $1 and caso_id = $2
          for update`,
        [tareaId, casoId],
      );

      if (!tarea.rows[0]) {
        throw new NotFoundException('Tarea no encontrada');
      }

      // Si el estado ya coincide, no genera otra escritura.
      await client.query(
        `update tareas_terapeuticas
            set completada = $1
          where id = $2 and caso_id = $3
            and completada is distinct from $1::boolean`,
        [dto.estado === 'realizada', tareaId, casoId],
      );

      return {
        tarea: await this.leerTarea(client, casoId, tareaId),
      };
    });
  }

  private async leerTarea(
    client: PoolClient,
    casoId: string,
    tareaId: string,
  ) {
    const { rows } = await client.query<FilaTarea>(
      `${SELECT_TAREA} where t.id = $1 and t.caso_id = $2`,
      [tareaId, casoId],
    );

    if (!rows[0]) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return this.respuesta(rows[0]);
  }

  private respuesta(fila: FilaTarea) {
    return {
      id: fila.id,
      casoId: fila.caso_id,
      sesionId: fila.sesion_id,
      numeroSesion: fila.nro_sesion,
      descripcion: fila.descripcion,
      estado: fila.completada ? 'realizada' : 'pendiente',
      fecha: fila.fecha_asignada,
      creadoPor: fila.perfil_id,
      creadoEn: fila.creado_en,
      cumplimientoActualizadoPor: fila.cumplimiento_actualizado_por,
      cumplimientoActualizadoEn: fila.cumplimiento_actualizado_en,
    };
  }
}
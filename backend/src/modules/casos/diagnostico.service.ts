import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';
import type { GuardarDiagnosticoDto } from './dto/guardar-diagnostico.dto.js';

interface Ficha {
  id: string;
  caso_id: string;
  fecha: string;
  contenido: {
    diagnosticoIngreso?: string;
    hipotesisRelacional?: string | null;
    comentariosClinicos?: string | null;
    [campo: string]: unknown;
  };
  creado_por: string | null;
  creado_en: Date;
  actualizado_por: string | null;
  actualizado_en: Date;
}

@Injectable()
export class DiagnosticoService {
  constructor(private readonly db: DatabaseService) {}

  private async verificarAcceso(
    client: PoolClient,
    id: string,
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
      [id],
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
                where caso_id = $2
                  and perfil_id = $3
             )
           )`,
      [usuario.rol, id, usuario.id],
    );

    if (!acceso.rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }
  }

  async obtener(id: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, id, usuario);

      const { rows } = await client.query<Ficha>(
        `select id, caso_id,
                to_char(fecha, 'YYYY-MM-DD') as fecha,
                contenido, creado_por, creado_en,
                actualizado_por, actualizado_en
           from fichas_diagnostico
          where caso_id = $1`,
        [id],
      );

      return {
        diagnostico: rows[0] ? this.respuesta(rows[0]) : null,
      };
    });
  }

  async guardar(
    id: string,
    dto: GuardarDiagnosticoDto,
    usuario: Usuario,
  ) {
    const contenido = {
      diagnosticoIngreso: dto.diagnosticoIngreso.trim(),
      hipotesisRelacional: dto.hipotesisRelacional?.trim() || null,
      comentariosClinicos: dto.comentariosClinicos?.trim() || null,
    };

    return this.db.transaction(usuario.id, async (client) => {
      await this.verificarAcceso(client, id, usuario);

      const { rows } = await client.query<Ficha>(
        `insert into fichas_diagnostico (
           caso_id, fecha, contenido, creado_por, actualizado_por
         )
         values ($1, $2::date, $3::jsonb, $4, $4)
         on conflict (caso_id) do update set
           fecha = excluded.fecha,
           contenido = excluded.contenido,
           actualizado_por = excluded.actualizado_por
         returning id, caso_id,
                   to_char(fecha, 'YYYY-MM-DD') as fecha,
                   contenido, creado_por, creado_en,
                   actualizado_por, actualizado_en`,
        [id, dto.fecha, JSON.stringify(contenido), usuario.id],
      );

      return { diagnostico: this.respuesta(rows[0]) };
    });
  }

  private respuesta(fila: Ficha) {
    return {
      id: fila.id,
      casoId: fila.caso_id,
      fecha: fila.fecha,
      diagnosticoIngreso: fila.contenido.diagnosticoIngreso ?? null,
      hipotesisRelacional: fila.contenido.hipotesisRelacional ?? null,
      comentariosClinicos: fila.contenido.comentariosClinicos ?? null,
      creadoPor: fila.creado_por,
      creadoEn: fila.creado_en,
      actualizadoPor: fila.actualizado_por,
      actualizadoEn: fila.actualizado_en,
    };
  }
}
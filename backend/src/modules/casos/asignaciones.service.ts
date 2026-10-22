import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

@Injectable()
export class AsignacionesService {
  constructor(private readonly db: DatabaseService) {}

  async listar(casoId: string) {
    await this.verificarCaso(casoId);
    const { rows } = await this.db.query(
      `select a.perfil_id, p.nombre_completo, p.activo, a.asignado_en
         from asignaciones_caso a
         join perfiles p on p.id = a.perfil_id
        where a.caso_id = $1
        order by a.asignado_en`,
      [casoId],
    );
    return rows.map((f) => ({
      perfilId: f.perfil_id,
      nombreCompleto: f.nombre_completo,
      activo: f.activo,
      asignadoEn: f.asignado_en,
    }));
  }

  async asignar(casoId: string, perfilId: string, adminId: string) {
  return this.db.transaction(adminId, async (client) => {
    // Bloqueamos el caso
    const caso = await client.query(
      `select id
         from casos
        where id = $1 and deleted_at is null
        for update`,
      [casoId],
    );

    if (!caso.rowCount) {
      throw new NotFoundException('Caso no encontrado');
    }

    //terapeuta activa
    const { rows } = await client.query<{ rol: string; activo: boolean }>(
      'select rol, activo from perfiles where id = $1',
      [perfilId],
    );

    if (!rows[0]) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (rows[0].rol !== 'terapeuta' || !rows[0].activo) {
      throw new BadRequestException(
        'Solo se puede asignar a terapeutas activos',
      );
    }

    const asignacion = await client.query<{ perfil_id: string }>(
      'select perfil_id from asignaciones_caso where caso_id = $1',
      [casoId],
    );

    if (asignacion.rows[0]?.perfil_id === perfilId) {
      throw new ConflictException(
        'Ese terapeuta ya está asignado al caso',
      );
    }


    await client.query(
      'delete from asignaciones_caso where caso_id = $1',
      [casoId],
    );

    await client.query(
      `insert into asignaciones_caso
         (caso_id, perfil_id, asignado_por)
       values ($1, $2, $3)`,
      [casoId, perfilId, adminId],
    );

    const resultado = await client.query(
      `select a.perfil_id, p.nombre_completo, p.activo, a.asignado_en
         from asignaciones_caso a
         join perfiles p on p.id = a.perfil_id
        where a.caso_id = $1`,
      [casoId],
    );

    return resultado.rows.map((f) => ({
      perfilId: f.perfil_id,
      nombreCompleto: f.nombre_completo,
      activo: f.activo,
      asignadoEn: f.asignado_en,
    }));
  });
}

  async quitar(casoId: string, perfilId: string, adminId: string): Promise<void> {
    await this.verificarCaso(casoId);
    const resultado = await this.db.transaction(adminId, (client) =>
      client.query('delete from asignaciones_caso where caso_id = $1 and perfil_id = $2', [
        casoId,
        perfilId,
      ]),
    );
    if (resultado.rowCount === 0) throw new NotFoundException('Ese terapeuta no está asignado al caso');
  }

  private async verificarCaso(casoId: string) {
    const { rowCount } = await this.db.query(
      'select 1 from casos where id = $1 and deleted_at is null',
      [casoId],
    );
    if (!rowCount) throw new NotFoundException('Caso no encontrado');
  }
}

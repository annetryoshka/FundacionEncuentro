import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { Usuario } from '../../../common/types/usuario.js';
import { DatabaseService } from '../../../database/database.service.js';
@Injectable()
export class GenogramaAccesoService {
  constructor(private readonly db: DatabaseService) {}

  /** Con `client`, la comprobación corre dentro de esa transacción. */
  async verificar(
    casoId: string,
    usuario: Usuario,
    client?: Pick<PoolClient, 'query'>,
  ): Promise<void> {
    const consultar = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);
    const resultado = await consultar<{ id: string }>(
      `select c.id
         from casos c
         join pacientes p on p.id = c.paciente_id
        where c.id = $1
          and c.deleted_at is null
          and p.deleted_at is null
          and (
            $2::text = 'administrador'
            or (
              $2::text = 'terapeuta'
              and exists (
                select 1
                  from asignaciones_caso a
                 where a.caso_id = c.id
                   and a.perfil_id = $3
              )
            )
          )`,
      [casoId, usuario.rol, usuario.id],
    );

    if (!resultado.rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }
  }
}
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { GuardarFamiliaDto } from './dto/guardar-familia.dto.js';
import { guardarIntegrante } from './familia-escritura.js';
import type { Usuario } from '../../common/types/usuario.js';
import { DatabaseService } from '../../database/database.service.js';

@Injectable()
export class FamiliaService {
  constructor(private readonly db: DatabaseService) {}

  async obtener(casoId: string, usuario: Usuario, client?: PoolClient) {
    const consultar = (sql: string, parametros: unknown[]) =>
      client ? client.query(sql, parametros) : this.db.query(sql, parametros);

    const { rows } = await consultar(
      `select c.id as "casoId",
              p.id as "pacienteId",
              (ff.id is not null) as registrada,
              ff.version,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', f.id,
                    'parentesco', f.parentesco,
                    'parentescoDetalle', f.parentesco_detalle,
                    'nombreCompleto', f.nombre_completo,
                    'fechaNacimiento', f.fecha_nacimiento,
                    'edadReferida', f.edad_referida,
                    'fechaReferencia', f.fecha_referencia,
                    'ocupacion', f.ocupacion,
                    'lugarTrabajoEstudio', f.lugar_trabajo_estudio,
                    'conviveConPaciente', f.convive_con_paciente,
                    'observaciones', f.observaciones,
                    'creadoPor', f.creado_por,
                    'creadoEn', f.creado_en,
                    'actualizadoPor', f.actualizado_por,
                    'actualizadoEn', f.actualizado_en
                  ) order by f.orden_registro
                )
                  from public.familiares f
                 where f.caso_id = c.id and f.deleted_at is null
              ), '[]'::jsonb) as familiares
         from public.casos c
         join public.pacientes p on p.id = c.paciente_id
         left join public.fichas_familiares ff on ff.caso_id = c.id
        where c.id = $1
          and c.deleted_at is null
          and p.deleted_at is null
          and (
            $2::text = 'administrador'
            or (
              $2::text = 'terapeuta'
              and exists (
                select 1
                  from public.asignaciones_caso a
                 where a.caso_id = c.id and a.perfil_id = $3
              )
            )
          )`,
      [casoId, usuario.rol, usuario.id],
    );

    if (!rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }

    return rows[0];
  }

    async guardar(casoId: string, usuario: Usuario, dto: GuardarFamiliaDto) {
    const eliminarIds = dto.eliminarIds ?? [];
    const ids = [
      ...dto.familiares.flatMap(({ id }) => id ? [id] : []),
      ...eliminarIds,
    ].map((id) => id.toLowerCase());

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Un familiar solo puede aparecer una vez en la solicitud.',
      );
    }

    try {
      return await this.db.transaction(usuario.id, async (client) => {
        // Comparte el bloqueo del caso con las operaciones de reasignación.
        await client.query(
          'select id from public.casos where id = $1 for update',
          [casoId],
        );
        await this.obtener(casoId, usuario, client);

        const { rows: [ficha] } = await client.query<{ version: number }>(
          `select version from public.fichas_familiares
            where caso_id = $1 for update`,
          [casoId],
        );

        if (dto.version !== (ficha?.version ?? null)) {
          throw new ConflictException(
            'La ficha familiar cambió. Vuelve a consultarla antes de guardar.',
          );
        }

        if (!ficha) {
          await client.query(
            'insert into public.fichas_familiares (caso_id) values ($1)',
            [casoId],
          );
        }

        for (const familiar of dto.familiares) {
          await guardarIntegrante(client, casoId, familiar);
        }

        if (eliminarIds.length > 0) {
          const resultado = await client.query(
            `update public.familiares
                set deleted_at = now()
              where caso_id = $1 and id = any($2::uuid[])
                and deleted_at is null`,
            [casoId, eliminarIds],
          );

          if (resultado.rowCount !== eliminarIds.length) {
            throw new NotFoundException('Familiar no encontrado en el caso');
          }
        }

        return this.obtener(casoId, usuario, client);
      });
    } catch (error) {
      const codigo = error instanceof Error && 'code' in error
        ? error.code
        : undefined;

      if (codigo === '23514' || codigo === '22007' || codigo === '22008') {
        throw new BadRequestException(
          'Revisa las fechas, la edad y los datos de parentesco de los familiares.',
        );
      }

      throw error;
    }
  }
}
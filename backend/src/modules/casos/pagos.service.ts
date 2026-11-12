import {
  BadRequestException, ConflictException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { RegistrarPagoDto } from './dto/registrar-pago.dto.js';

interface FilaPago {
  id: string;
  caso_id: string;
  sesion_id: string;
  monto: string;
  moneda: string;
  fecha: string;
  metodo: string;
  referencia: string | null;
  registrado_por: string | null;
  creado_en: Date;
}

const SELECT_PAGO = `
  select id, caso_id, sesion_id, monto::text as monto,
         moneda, to_char(fecha, 'YYYY-MM-DD') as fecha,
         metodo, referencia, registrado_por, creado_en
    from pagos
`;

@Injectable()
export class PagosService {
  constructor(private readonly db: DatabaseService) {}

  async listar(casoId: string) {
    const caso = await this.db.query(
      `select c.id
         from casos c
         join pacientes p on p.id = c.paciente_id
        where c.id = $1
          and c.deleted_at is null
          and p.deleted_at is null`,
      [casoId],
    );

    if (!caso.rows[0]) {
      throw new NotFoundException('Caso no encontrado');
    }

    const { rows } = await this.db.query<FilaPago>(
      `${SELECT_PAGO}
        where caso_id = $1
          and exists (
            select 1
              from casos c
              join pacientes p on p.id = c.paciente_id
             where c.id = pagos.caso_id
               and c.deleted_at is null
               and p.deleted_at is null
          )
        order by fecha asc, creado_en asc, id asc`,
      [casoId],
    );

    return { pagos: rows.map((fila) => this.respuesta(fila)) };
  }

  async registrar(
    casoId: string,
    dto: RegistrarPagoDto,
    adminId: string,
  ) {
    const referencia = dto.referencia?.trim() || null;

    return this.db.transaction(adminId, async (client) => {
      // Serializa registros del mismo caso, incluidos los reintentos.
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

      const sesion = await client.query(
        `select id from fichas_seguimiento
          where id = $1 and caso_id = $2
          for share`,
        [dto.sesionId, casoId],
      );

      if (!sesion.rows[0]) {
        throw new BadRequestException(
          'La sesión no existe o no pertenece al caso',
        );
      }

      // La restricción única también protege ante otros escritores.
      const insertado = await client.query<{ id: string }>(
        `insert into pagos (
           caso_id, sesion_id, monto, moneda, fecha,
           metodo, referencia, registrado_por
         )
         values ($1, $2, $3::numeric, 'BOB', $4::date, $5, $6, $7)
         on conflict (sesion_id) do nothing
         returning id`,
        [
          casoId, dto.sesionId, dto.monto, dto.fecha,
          dto.metodo, referencia, adminId,
        ],
      );

      const { rows } = await client.query<FilaPago & {
        coincide: boolean;
      }>(
        `select p.id, p.caso_id, p.sesion_id,
                p.monto::text as monto, p.moneda,
                to_char(p.fecha, 'YYYY-MM-DD') as fecha,
                p.metodo, p.referencia,
                p.registrado_por, p.creado_en,
                (
                  p.monto = $3::numeric
                  and p.moneda = 'BOB'
                  and p.fecha = $4::date
                  and p.metodo = $5
                  and p.referencia is not distinct from $6::text
                ) as coincide
           from pagos p
          where p.sesion_id = $1 and p.caso_id = $2
          for update of p`,
        [
          dto.sesionId, casoId, dto.monto,
          dto.fecha, dto.metodo, referencia,
        ],
      );

      if (!rows[0]) {
        throw new ConflictException(
          'No se pudo recuperar el pago de la sesión',
        );
      }

      if (!rows[0].coincide) {
        throw new ConflictException(
          'La sesión ya tiene un pago registrado con otros datos',
        );
      }

      return {
        pago: this.respuesta(rows[0]),
        reutilizado: insertado.rows.length === 0,
      };
    });
  }

  private respuesta(fila: FilaPago) {
    return {
      id: fila.id,
      casoId: fila.caso_id,
      sesionId: fila.sesion_id,
      monto: fila.monto,
      moneda: fila.moneda,
      fecha: fila.fecha,
      metodo: fila.metodo,
      referencia: fila.referencia,
      registradoPor: fila.registrado_por,
      creadoEn: fila.creado_en,
    };
  }
}
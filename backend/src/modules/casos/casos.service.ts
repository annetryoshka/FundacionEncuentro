import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { ListarCasosQuery } from './dto/listar-casos.query.js';
import type { RegistrarCasoDto } from './dto/registrar-caso.dto.js';

const SELECT_CARPETA = `
  select c.id, c.tipo, c.numero_correlativo, c.estado,
         to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
         c.diagnostico_ingreso, c.hipotesis_relacional, c.comentarios_clinicos, c.creado_en,
         p.id as paciente_id, p.nombre_completo,
         to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
         p.edad_al_ingreso, p.telefono,
         j.id as judicial_id, j.juzgado, j.nro_expediente,
         to_char(j.fecha_derivacion, 'YYYY-MM-DD') as fecha_derivacion, j.observaciones
    from casos c
    join pacientes p on p.id = c.paciente_id
    left join contexto_judicial j on j.caso_id = c.id`;

/** Texto vacío o solo espacios se guarda como null. */
const limpiar = (valor?: string | null) => valor?.trim() || null;

@Injectable()
export class CasosService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Registro integral: crea al paciente, abre su carpeta (caso con número
   * correlativo automático) y, si es derivado, guarda el contexto judicial.
   * Todo ocurre en una sola transacción: o se guarda completo o no se guarda nada.
   */
  async registrar(dto: RegistrarCasoDto, adminId: string) {
    const { paciente, caso, contextoJudicial } = dto;

    if (caso.tipo === 'voluntario' && contextoJudicial) {
      throw new BadRequestException('Un caso voluntario no lleva contexto judicial');
    }

    const nombre = paciente.nombreCompleto.trim();
    if (!nombre) throw new BadRequestException('El nombre del paciente es obligatorio');

    const casoId = await this.db.transaction(adminId, async (client) => {
      const { rows: hoyRows } = await client.query<{ hoy: string }>(
        `select to_char(current_date, 'YYYY-MM-DD') as hoy`,
      );
      const hoy = hoyRows[0].hoy;
      const fechaIngreso = caso.fechaIngreso ?? hoy;

      if (fechaIngreso > hoy) {
        throw new BadRequestException('La fecha de ingreso no puede ser futura');
      }
      if (paciente.fechaNacimiento && paciente.fechaNacimiento > fechaIngreso) {
        throw new BadRequestException('La fecha de nacimiento no puede ser posterior al ingreso');
      }

      const pac = await client.query<{ id: string }>(
        `insert into pacientes (nombre_completo, fecha_nacimiento, edad_al_ingreso, telefono, creado_por)
         values ($1, $2::date,
                 coalesce($3::int, case when $2::date is null then null
                                        else date_part('year', age($4::date, $2::date))::int end),
                 $5, $6)
         returning id`,
        [
          nombre,
          paciente.fechaNacimiento ?? null,
          paciente.edadAlIngreso ?? null,
          fechaIngreso,
          limpiar(paciente.telefono),
          adminId,
        ],
      );

      // numero_correlativo lo asigna solo un trigger de la base, separado por tipo.
      const nuevoCaso = await client.query<{ id: string }>(
        `insert into casos (paciente_id, tipo, estado, fecha_ingreso,
                            diagnostico_ingreso, hipotesis_relacional, comentarios_clinicos, creado_por)
         values ($1, $2, coalesce($3, 'iniciado'), $4::date, $5, $6, $7, $8)
         returning id`,
        [
          pac.rows[0].id,
          caso.tipo,
          caso.estado ?? null,
          fechaIngreso,
          limpiar(caso.diagnosticoIngreso),
          limpiar(caso.hipotesisRelacional),
          limpiar(caso.comentariosClinicos),
          adminId,
        ],
      );

      if (contextoJudicial) {
        await client.query(
          `insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion, observaciones)
           values ($1, $2, $3, $4::date, $5)`,
          [
            nuevoCaso.rows[0].id,
            limpiar(contextoJudicial.juzgado),
            limpiar(contextoJudicial.nroExpediente),
            contextoJudicial.fechaDerivacion ?? null,
            limpiar(contextoJudicial.observaciones),
          ],
        );
      }

      return nuevoCaso.rows[0].id;
    });

    const carpeta = await this.obtener(casoId);
    const posiblesDuplicados = await this.buscarPosiblesDuplicados(nombre, carpeta.paciente.id);
    return { ...carpeta, posiblesDuplicados };
  }

  async obtener(id: string) {
    const { rows } = await this.db.query(
      `${SELECT_CARPETA} where c.id = $1 and c.deleted_at is null and p.deleted_at is null`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Caso no encontrado');
    return this.aCarpeta(rows[0]);
  }

  async listar(filtros: ListarCasosQuery) {
    const condiciones = ['c.deleted_at is null', 'p.deleted_at is null'];
    const valores: unknown[] = [];
    const agregar = (sql: string, valor: unknown) => {
      valores.push(valor);
      condiciones.push(sql.replace('?', `$${valores.length}`));
    };

    if (filtros.tipo) agregar('c.tipo = ?', filtros.tipo);
    if (filtros.estado) agregar('c.estado = ?', filtros.estado);
    const busqueda = filtros.q?.trim();
    if (busqueda) agregar('position(lower(?) in lower(p.nombre_completo)) > 0', busqueda);

    const donde = condiciones.join(' and ');
    const limite = filtros.limite ?? 20;
    const desplazamiento = filtros.desplazamiento ?? 0;

    const total = await this.db.query<{ total: string }>(
      `select count(*) as total from casos c join pacientes p on p.id = c.paciente_id where ${donde}`,
      valores,
    );

    const { rows } = await this.db.query(
      `select c.id, c.tipo, c.numero_correlativo, c.estado,
              to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
              p.id as paciente_id, p.nombre_completo
         from casos c join pacientes p on p.id = c.paciente_id
        where ${donde}
        order by c.fecha_ingreso desc, c.numero_correlativo desc
        limit $${valores.length + 1} offset $${valores.length + 2}`,
      [...valores, limite, desplazamiento],
    );

    return {
      datos: rows.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        numeroCorrelativo: f.numero_correlativo,
        estado: f.estado,
        fechaIngreso: f.fecha_ingreso,
        paciente: { id: f.paciente_id, nombreCompleto: f.nombre_completo },
      })),
      total: Number(total.rows[0].total),
      limite,
      desplazamiento,
    };
  }

  /** Pacientes con nombre muy parecido: es un aviso, no bloquea el registro. */
  private async buscarPosiblesDuplicados(nombre: string, pacienteId: string) {
    const { rows } = await this.db.query(
      `select id, nombre_completo, extensions.similarity(nombre_completo, $1) as similitud
         from pacientes
        where deleted_at is null and id <> $2
          and extensions.similarity(nombre_completo, $1) > 0.6
        order by similitud desc
        limit 5`,
      [nombre, pacienteId],
    );
    return rows.map((f) => ({
      pacienteId: f.id,
      nombreCompleto: f.nombre_completo,
      similitud: Number(Number(f.similitud).toFixed(2)),
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private aCarpeta(f: any) {
    return {
      id: f.id,
      tipo: f.tipo,
      numeroCorrelativo: f.numero_correlativo,
      estado: f.estado,
      fechaIngreso: f.fecha_ingreso,
      diagnosticoIngreso: f.diagnostico_ingreso,
      hipotesisRelacional: f.hipotesis_relacional,
      comentariosClinicos: f.comentarios_clinicos,
      creadoEn: f.creado_en,
      paciente: {
        id: f.paciente_id,
        nombreCompleto: f.nombre_completo,
        fechaNacimiento: f.fecha_nacimiento,
        edadAlIngreso: f.edad_al_ingreso,
        telefono: f.telefono,
      },
      contextoJudicial: f.judicial_id
        ? {
            juzgado: f.juzgado,
            nroExpediente: f.nro_expediente,
            fechaDerivacion: f.fecha_derivacion,
            observaciones: f.observaciones,
          }
        : null,
    };
  }
}

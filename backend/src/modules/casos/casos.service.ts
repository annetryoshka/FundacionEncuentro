import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { ListarCasosQuery } from './dto/listar-casos.query.js';
import type { RegistrarCasoDto } from './dto/registrar-caso.dto.js';
import type { ActualizarCasoDto } from './dto/actualizar-caso.dto.js';
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

const esNumeroDuplicado = (error: unknown) => {
  const e = error as { code?: string; constraint?: string };
  return e.code === '23505' && e.constraint === 'uq_caso_numero';
};
@Injectable()
export class CasosService {
  constructor(private readonly db: DatabaseService) {}
  /**
   * FE-52: Actualizar nombre del paciente y fecha de ingreso.
   * Conserva identificadores, tipo y número correlativo.
   */
  async actualizarDatosPaciente(
    id: string,
    dto: ActualizarCasoDto,
    adminId: string,
  ) {
    const nombreCompleto = dto.nombreCompleto
      .trim()
      .replace(/\s+/g, ' ');
    if (
      nombreCompleto.length < 3 ||
      nombreCompleto.length > 150 ||
      !/\p{L}/u.test(nombreCompleto)
    ) {
      throw new BadRequestException(
        'El nombre del paciente no es válido',
      );
    }
    await this.db.transaction(adminId, async (client) => {
      const { rows } = await client.query<{
        paciente_id: string;
        fecha_nacimiento: string | null;
        hoy: string;
      }>(
        `select c.paciente_id,
                to_char(p.fecha_nacimiento, 'YYYY-MM-DD')
                  as fecha_nacimiento,
                to_char(current_date, 'YYYY-MM-DD') as hoy
           from casos c
           join pacientes p on p.id = c.paciente_id
          where c.id = $1
            and c.deleted_at is null
            and p.deleted_at is null
          for update of c, p`,
        [id],
      );
      if (!rows[0]) {
        throw new NotFoundException('Caso no encontrado');
      }
      const registro = rows[0];
      const fechaIngreso = dto.fechaIngreso;
      if (
        fechaIngreso < '1990-01-01' ||
        fechaIngreso > registro.hoy
      ) {
        throw new BadRequestException(
          'La fecha de ingreso no es válida',
        );
      }
      if (
        registro.fecha_nacimiento &&
        registro.fecha_nacimiento > fechaIngreso
      ) {
        throw new BadRequestException(
          'La fecha de ingreso no puede ser anterior al nacimiento',
        );
      }
      await client.query(
        `update pacientes
            set nombre_completo = $1
          where id = $2`,
        [nombreCompleto, registro.paciente_id],
      );
      await client.query(
        `update casos
            set fecha_ingreso = $1::date
          where id = $2`,
        [fechaIngreso, id],
      );
    });
    return this.obtener(id);
  }
  /**
   * Registro integral: crea al paciente, abre su carpeta (caso con número
   * correlativo automático) y, si es derivado, guarda el contexto judicial.
   * Todo ocurre en una sola transacción: o se guarda completo o no se guarda nada.
   */
  async registrar(dto: RegistrarCasoDto, adminId: string) {
    const { paciente, pacienteId, caso, contextoJudicial } = dto;
    if (paciente && pacienteId) {
      throw new BadRequestException('Envía los datos de un paciente nuevo o el id de uno existente, no ambos');
    }
    if (!paciente && !pacienteId) {
      throw new BadRequestException('Falta el paciente: envía "paciente" (nuevo) o "pacienteId" (existente)');
    }
    if (caso.tipo === 'voluntario' && contextoJudicial) {
      throw new BadRequestException('Un caso voluntario no lleva contexto judicial');
    }
    const nombre = paciente?.nombreCompleto.trim();
    if (paciente && !nombre) throw new BadRequestException('El nombre del paciente es obligatorio');
    const casoId = await this.db.transaction(adminId, async (client) => {
      const { rows: hoyRows } = await client.query<{ hoy: string }>(
        `select to_char(current_date, 'YYYY-MM-DD') as hoy`,
      );
      const hoy = hoyRows[0].hoy;
      const fechaIngreso = caso.fechaIngreso ?? hoy;
      if (fechaIngreso > hoy) {
        throw new BadRequestException('La fecha de ingreso no puede ser futura');
      }
      if (paciente?.fechaNacimiento && paciente.fechaNacimiento > fechaIngreso) {
        throw new BadRequestException('La fecha de nacimiento no puede ser posterior al ingreso');
      }
      let idPaciente: string;
      if (pacienteId) {
        const existe = await client.query(
          'select 1 from pacientes where id = $1 and deleted_at is null',
          [pacienteId],
        );
        if (existe.rowCount === 0) throw new NotFoundException('Paciente no encontrado');
        idPaciente = pacienteId;
      } else {
        const pac = await client.query<{ id: string }>(
        `insert into pacientes (nombre_completo, fecha_nacimiento, edad_al_ingreso, telefono, creado_por)
         values ($1, $2::date,
                 coalesce($3::int, case when $2::date is null then null
                                        else date_part('year', age($4::date, $2::date))::int end),
                 $5, $6)
         returning id`,
        [
          nombre,
          paciente!.fechaNacimiento ?? null,
          paciente!.edadAlIngreso ?? null,
          fechaIngreso,
          limpiar(paciente!.telefono),
          adminId,
        ],
        );
        idPaciente = pac.rows[0].id;
      }
      // Si no se envía número, un trigger de la base asigna el siguiente, separado por tipo.
      let nuevoCaso;
      try {
        nuevoCaso = await client.query<{ id: string }>(
          `insert into casos (paciente_id, tipo, estado, fecha_ingreso,
                              diagnostico_ingreso, hipotesis_relacional, comentarios_clinicos,
                              creado_por, numero_correlativo)
           values ($1, $2, coalesce($3, 'iniciado'), $4::date, $5, $6, $7, $8, $9::int)
           returning id`,
          [
            idPaciente,
            caso.tipo,
            caso.estado ?? null,
            fechaIngreso,
            limpiar(caso.diagnosticoIngreso),
            limpiar(caso.hipotesisRelacional),
            limpiar(caso.comentariosClinicos),
            adminId,
            caso.numeroCorrelativo ?? null,
          ],
        );
      } catch (error) {
        if (esNumeroDuplicado(error)) {
          throw new ConflictException(
            `Ya existe un caso ${caso.tipo} con el número de carpeta ${caso.numeroCorrelativo}`,
          );
        }
        throw error;
      }
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
    const posiblesDuplicados = nombre
      ? await this.buscarPosiblesDuplicados(nombre, carpeta.paciente.id)
      : [];
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
    if (filtros.pacienteId) agregar('c.paciente_id = ?', filtros.pacienteId);
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

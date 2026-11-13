import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { ListarCasosQuery } from "./dto/listar-casos.query.js";
import type { RegistrarCasoDto } from "./dto/registrar-caso.dto.js";
import type { ActualizarCasoDto } from "./dto/actualizar-caso.dto.js";
import type { Usuario } from "../../common/types/usuario.js";
import type { ListarCarpetasQuery } from './dto/listar-carpetas.query.js';
import type { ActualizarEstadoCasoDto } from './dto/actualizar-estado-caso.dto.js';
import type { ActualizarClasificacionDto } from './dto/actualizar-clasificacion.dto.js';
import type { ActualizarConstanciaDto } from './dto/actualizar-constancia.dto.js';

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

const limpiar = (valor?: string | null) => valor?.trim() || null;

const esNumeroDuplicado = (error: unknown) => {
  const e = error as { code?: string; constraint?: string };
  return e.code === "23505" && e.constraint === "uq_caso_numero";
};
@Injectable()
export class CasosService {
  constructor(private readonly db: DatabaseService) {}
  /* FE-52: Actualizar nombre del paciente y fecha de ingreso*/
  async actualizarDatosPaciente(
    id: string,
    dto: ActualizarCasoDto,
    adminId: string,
  ) {
    const nombreCompleto = dto.nombreCompleto.trim().replace(/\s+/g, " ");
    if (
      nombreCompleto.length < 3 ||
      nombreCompleto.length > 150 ||
      !/\p{L}/u.test(nombreCompleto)
    ) {
      throw new BadRequestException("El nombre del paciente no es válido");
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
        throw new NotFoundException("Caso no encontrado");
      }
      const registro = rows[0];
      const fechaIngreso = dto.fechaIngreso;
      if (fechaIngreso < "1990-01-01" || fechaIngreso > registro.hoy) {
        throw new BadRequestException("La fecha de ingreso no es válida");
      }
      if (
        registro.fecha_nacimiento &&
        registro.fecha_nacimiento > fechaIngreso
      ) {
        throw new BadRequestException(
          "La fecha de ingreso no puede ser anterior al nacimiento",
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
  }
  /*Registro paciente correlativo automático, si es derivado guarda el contexto judicial*/
  async registrar(dto: RegistrarCasoDto, adminId: string) {
    const { paciente, pacienteId, caso, contextoJudicial } = dto;
    if (paciente && pacienteId) {
      throw new BadRequestException(
        "Envía los datos de un paciente nuevo o el id de uno existente, no ambos",
      );
    }
    if (!paciente && !pacienteId) {
      throw new BadRequestException(
        'Falta el paciente: envía "paciente" (nuevo) o "pacienteId" (existente)',
      );
    }
    if (caso.tipo === "voluntario" && contextoJudicial) {
      throw new BadRequestException(
        "Un caso voluntario no lleva contexto judicial",
      );
    }
    const nombre = paciente?.nombreCompleto.trim();
    if (paciente && !nombre)
      throw new BadRequestException("El nombre del paciente es obligatorio");
    return this.db.transaction(adminId, async (client) => {
      const { rows: hoyRows } = await client.query<{ hoy: string }>(
        `select to_char(current_date, 'YYYY-MM-DD') as hoy`,
      );
      const hoy = hoyRows[0].hoy;
      const fechaIngreso = caso.fechaIngreso ?? hoy;
      if (fechaIngreso > hoy) {
        throw new BadRequestException(
          "La fecha de ingreso no puede ser futura",
        );
      }
      if (
        paciente?.fechaNacimiento &&
        paciente.fechaNacimiento > fechaIngreso
      ) {
        throw new BadRequestException(
          "La fecha de nacimiento no puede ser posterior al ingreso",
        );
      }
      let idPaciente: string;
      if (pacienteId) {
        const existe = await client.query(
          "select 1 from pacientes where id = $1 and deleted_at is null",
          [pacienteId],
        );
        if (existe.rowCount === 0)
          throw new NotFoundException("Paciente no encontrado");
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
      // Construir la respuesta antes del COMMIT: si falla una lectura, el alta se revierte.
      const carpeta = await this.obtener(nuevoCaso.rows[0].id, client);
      const posiblesDuplicados = nombre
        ? await this.buscarPosiblesDuplicados(
            nombre,
            carpeta.paciente.id,
            client,
          )
        : [];
      return { ...carpeta, posiblesDuplicados };
    });
  }
  async obtener(id: string, client?: Pick<DatabaseService, "query">) {
    const { rows } = await (client ?? this.db).query(
      `${SELECT_CARPETA} where c.id = $1 and c.deleted_at is null and p.deleted_at is null`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Caso no encontrado");
    return this.aCarpeta(rows[0]);
  }

  async obtenerCarpetaAutorizada(id: string, usuario: Usuario) {
    const { rows } = await this.db.query(
      `select c.id, c.tipo, c.numero_correlativo, c.estado, c.clasificacion,
          to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
          c.diagnostico_ingreso, c.hipotesis_relacional,
          c.comentarios_clinicos, c.creado_en,
          p.id as paciente_id, p.nombre_completo,
          to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
          p.edad_al_ingreso, p.telefono,
          t.id as terapeuta_id,
          t.nombre_completo as terapeuta_nombre,
          creador.id as creador_id,
          creador.nombre_completo as creador_nombre,
          asignador.id as asignador_id,
          asignador.nombre_completo as asignador_nombre,
          a.asignado_en,
          editor.id as editor_id,
          editor.nombre_completo as editor_nombre,
          ultima.creado_en as actualizado_en
     from casos c
     join pacientes p on p.id = c.paciente_id
     left join asignaciones_caso a on a.caso_id = c.id
     left join perfiles t on t.id = a.perfil_id
     left join perfiles creador on creador.id = c.creado_por
     left join perfiles asignador on asignador.id = a.asignado_por
     left join lateral (
  select au.usuario_id, au.creado_en
    from auditoria au
   where au.accion = 'UPDATE'
     and (
       (
         au.tabla = 'pacientes'
         and au.registro_id = p.id
         and (
           au.datos_anteriores ->> 'nombre_completo'
             is distinct from au.datos_nuevos ->> 'nombre_completo'
         )
       )
       or (
         au.tabla = 'casos'
         and au.registro_id = c.id
         and (
           au.datos_anteriores ->> 'fecha_ingreso'
             is distinct from au.datos_nuevos ->> 'fecha_ingreso'
           or au.datos_anteriores ->> 'estado'
             is distinct from au.datos_nuevos ->> 'estado'
           or au.datos_anteriores ->> 'clasificacion'
             is distinct from au.datos_nuevos ->> 'clasificacion'
         )
       )
     )
   order by au.creado_en desc, au.id desc
   limit 1
) ultima on true
     left join perfiles editor on editor.id = ultima.usuario_id
    where c.id = $1
      and c.deleted_at is null
      and p.deleted_at is null
      and (
        $2 = 'administrador'
        or (
          $2 = 'terapeuta'
          and a.perfil_id = $3
        )
      )`,
      [id, usuario.rol, usuario.id],
    );

    if (!rows[0]) {
      throw new NotFoundException("Caso no encontrado");
    }

    const carpeta = rows[0];

    return {
      id: carpeta.id,
      numero: carpeta.numero_correlativo,
      tipo: carpeta.tipo,
      estado: carpeta.estado,
      clasificacion: carpeta.clasificacion,
      fechaIngreso: carpeta.fecha_ingreso,

      paciente: {
        id: carpeta.paciente_id,
        nombreCompleto: carpeta.nombre_completo,
      },

      terapeuta: carpeta.terapeuta_id
        ? {
            id: carpeta.terapeuta_id,
            nombreCompleto: carpeta.terapeuta_nombre,
          }
        : null,

      creadoPor: carpeta.creador_id
        ? {
            id: carpeta.creador_id,
            nombreCompleto: carpeta.creador_nombre,
          }
        : null,

      creadoEn: carpeta.creado_en,

      asignadoPor: carpeta.asignador_id
        ? {
            id: carpeta.asignador_id,
            nombreCompleto: carpeta.asignador_nombre,
          }
        : null,

      asignadoEn: carpeta.asignado_en ?? null,

      actualizadoPor: carpeta.editor_id
        ? {
            id: carpeta.editor_id,
            nombreCompleto: carpeta.editor_nombre,
          }
        : null,

      actualizadoEn: carpeta.actualizado_en ?? null,
    };
  }

  async listarCarpetas(filtros: ListarCarpetasQuery, usuario: Usuario) {
    const valores: unknown[] = [usuario.rol, usuario.id];
    const condiciones = [
      'c.deleted_at is null',
      'p.deleted_at is null',
      "($1 = 'administrador' or ($1 = 'terapeuta' and a.perfil_id = $2))",
    ];
      if (filtros.clasificacion !== undefined) {
        valores.push(filtros.clasificacion);
        condiciones.push(`c.clasificacion = $${valores.length}`);
      }

      if (filtros.estado !== undefined) {
        valores.push(filtros.estado);
        condiciones.push(`c.estado = $${valores.length}`);
      }
    const busqueda = filtros.busqueda?.trim();
    if (busqueda && /^[0-9]+$/.test(busqueda)) {
      const numero = busqueda.replace(/^0+/, '') || '0';
      if (numero.length > 10 || Number(numero) > 2147483647) {
        condiciones.push('false');
      } else {
        valores.push(Number(numero));
        condiciones.push(`c.numero_correlativo = $${valores.length}`);
      }
    } else if (busqueda) {
      for (const palabra of busqueda.split(/\s+/)) {
        valores.push(palabra);
        condiciones.push(`position(extensions.unaccent(lower($${valores.length}::text))
          in extensions.unaccent(lower(p.nombre_completo))) > 0`);
      }
    }
    const origen = `from casos c
      join pacientes p on p.id = c.paciente_id
      left join asignaciones_caso a on a.caso_id = c.id
      left join perfiles t on t.id = a.perfil_id
      where ${condiciones.join(' and ')}`;
    const total = await this.db.query<{ total: string }>(
      `select count(*) as total ${origen}`, valores,
    );
    const { pagina, tamano } = filtros;
    const { rows } = await this.db.query(
      `select c.id, c.numero_correlativo, c.tipo, c.estado, c.clasificacion,
        to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
        p.id as paciente_id, p.nombre_completo,
        t.id as terapeuta_id, t.nombre_completo as terapeuta_nombre
      ${origen}
      order by c.fecha_ingreso desc, c.numero_correlativo desc, c.id asc
      limit $${valores.length + 1} offset $${valores.length + 2}`,
      [...valores, tamano, (pagina - 1) * tamano],
    );
    return {
      carpetas: rows.map((fila) => ({
        id: fila.id,
        numero: fila.numero_correlativo,
        tipo: fila.tipo,
        estado: fila.estado,
        clasificacion: fila.clasificacion,
        fechaIngreso: fila.fecha_ingreso,
        paciente: { id: fila.paciente_id, nombreCompleto: fila.nombre_completo },
        terapeuta: fila.terapeuta_id
          ? { id: fila.terapeuta_id, nombreCompleto: fila.terapeuta_nombre }
          : null,
      })),
      total: Number(total.rows[0].total),
      pagina,
      tamano,
    };
  }

  async listar(filtros: ListarCasosQuery, usuario: Usuario) {
    const condiciones = [
    'c.deleted_at is null',
    'p.deleted_at is null',
    `(
      $1::text = 'administrador'
      or (
        $1::text = 'terapeuta'
        and exists (
          select 1
            from asignaciones_caso a
           where a.caso_id = c.id
             and a.perfil_id = $2::uuid
        )
      )
    )`,
  ];

  const valores: unknown[] = [usuario.rol, usuario.id];
    const agregar = (sql: string, valor: unknown) => {
      valores.push(valor);
      condiciones.push(sql.replace("?", `$${valores.length}`));
    };
    if (filtros.tipo) agregar("c.tipo = ?", filtros.tipo);
    if (filtros.estado) agregar("c.estado = ?", filtros.estado);
    if (filtros.pacienteId) agregar("c.paciente_id = ?", filtros.pacienteId);
    const busqueda = filtros.q?.trim();
    if (busqueda)
      agregar("position(lower(?) in lower(p.nombre_completo)) > 0", busqueda);
    const donde = condiciones.join(" and ");
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

  private async buscarPosiblesDuplicados(
    nombre: string,
    pacienteId: string,
    client?: Pick<DatabaseService, "query">,
  ) {
    const { rows } = await (client ?? this.db).query(
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

 async actualizarEstado(
  id: string,
  dto: ActualizarEstadoCasoDto,
  usuario: Usuario,
) {
  return this.db.transaction(usuario.id, async (client) => {
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

    const { rows } = await client.query(
      `update casos
          set estado = $1
        where id = $2
        returning id, estado, actualizado_en`,
      [dto.estado, id],
    );

    return {
      id: rows[0].id,
      estado: rows[0].estado,
      actualizadoPor: usuario.id,
      actualizadoEn: rows[0].actualizado_en,
    };
  });
}

 async actualizarClasificacion(
  id: string,
  dto: ActualizarClasificacionDto,
  usuario: Usuario,
) {
  return this.db.transaction(usuario.id, async (client) => {
    // La asignación también bloquea el caso: así una reasignación no puede intercalarse entre verificar permisos y actualizar.
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

    const { rows } = await client.query(
      `update casos
          set clasificacion = $1
        where id = $2
        returning id, clasificacion, actualizado_en`,
      [dto.clasificacion, id],
    );

    return {
      id: rows[0].id,
      clasificacion: rows[0].clasificacion,
      actualizadoPor: usuario.id,
      actualizadoEn: rows[0].actualizado_en,
    };
  });
}
async obtenerConstancia(id: string, usuario: Usuario) {
  // Verifica el acceso incluso cuando no existe constancia
  await this.obtenerCarpetaAutorizada(id, usuario);

  const { rows } = await this.db.query(
    `select ca.*,
       to_char(ca.fecha_consentimiento, 'YYYY-MM-DD')
         as fecha_consentimiento,
       case when j.id is null then null
         else json_build_object(
           'juzgado', j.juzgado,
           'nroExpediente', j.nro_expediente,
           'fechaDerivacion',
             to_char(j.fecha_derivacion, 'YYYY-MM-DD'),
           'observaciones', j.observaciones
         )
       end as contexto_judicial
      from constancias_atencion ca
      left join contexto_judicial j on j.caso_id = ca.caso_id
       join casos c on c.id = ca.caso_id
       join pacientes p on p.id = c.paciente_id
      where ca.caso_id = $1
        and c.deleted_at is null
        and p.deleted_at is null
        and (
          $2::text = 'administrador'
          or (
            $2::text = 'terapeuta'
            and exists (
              select 1 from asignaciones_caso a
               where a.caso_id = c.id
                 and a.perfil_id = $3
            )
          )
        )`,
    [id, usuario.rol, usuario.id],
  );

  return { constancia: rows[0] ? this.aConstancia(rows[0]) : null };
}

async actualizarConstancia(
  id: string,
  dto: ActualizarConstanciaDto,
  usuario: Usuario,
) {
  const contexto = dto.contextoJudicial;
    if (dto.origenJudicial && !contexto?.juzgado?.trim()) {
      throw new BadRequestException(
        'El contexto judicial y el juzgado son obligatorios',
      );
    }

    if (!dto.origenJudicial && contexto != null) {
      throw new BadRequestException(
        'Un origen no judicial no admite contexto judicial',
      );
    }
  const fecha = dto.fechaConsentimiento ?? null;
  const evidencia = dto.referenciaEvidencia?.trim() || null;
  const explicacion = dto.explicacion?.trim() || null;

  if (dto.estado === 'pendiente' && (fecha || evidencia || explicacion)) {
    throw new BadRequestException(
      'Pendiente no admite fecha, evidencia ni explicación',
    );
  }

  if (
    dto.estado === 'registrado' &&
    (!fecha || !evidencia || explicacion)
  ) {
    throw new BadRequestException(
      'Registrado exige fecha y evidencia, sin explicación de no aplica',
    );
  }

  if (
    dto.estado === 'no_aplica' &&
    (!explicacion || fecha || evidencia)
  ) {
    throw new BadRequestException(
      'No aplica exige explicación y no admite fecha ni evidencia',
    );
  }

  return this.db.transaction(usuario.id, async (client) => {
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

    if (dto.origenJudicial && contexto) {
      await client.query(
        `insert into contexto_judicial (
          caso_id, juzgado, nro_expediente,
          fecha_derivacion, observaciones
        )
        values ($1, $2, $3, $4::date, $5)
        on conflict (caso_id) do update set
          juzgado = excluded.juzgado,
          nro_expediente = excluded.nro_expediente,
          fecha_derivacion = excluded.fecha_derivacion,
          observaciones = excluded.observaciones`,
        [
          id,
          contexto.juzgado.trim(),
          contexto.nroExpediente?.trim() || null,
          contexto.fechaDerivacion ?? null,
          contexto.observaciones?.trim() || null,
        ],
      );
    } else {
      await client.query(
        'delete from contexto_judicial where caso_id = $1',
        [id],
      );
    }

    const { rows } = await client.query(
      `insert into constancias_atencion (
         caso_id, procedencia, origen_judicial, estado,
         fecha_consentimiento, referencia_evidencia, explicacion,
         creado_por, actualizado_por
       )
       values ($1, $2, $3, $4, $5::date, $6, $7, $8, $8)
       on conflict (caso_id) do update set
         procedencia = excluded.procedencia,
         origen_judicial = excluded.origen_judicial,
         estado = excluded.estado,
         fecha_consentimiento = excluded.fecha_consentimiento,
         referencia_evidencia = excluded.referencia_evidencia,
         explicacion = excluded.explicacion,
         actualizado_por = excluded.actualizado_por
       returning *`,
      [
        id,
        dto.procedencia?.trim() || null,
        dto.origenJudicial,
        dto.estado,
        fecha,
        evidencia,
        explicacion,
        usuario.id,
      ],
    );

    //solicitamos el formato explícito.
    const consulta = await client.query(
        `select ca.*,
                to_char(ca.fecha_consentimiento, 'YYYY-MM-DD')
                  as fecha_consentimiento,
                case when j.id is null then null
                  else json_build_object(
                    'juzgado', j.juzgado,
                    'nroExpediente', j.nro_expediente,
                    'fechaDerivacion',
                      to_char(j.fecha_derivacion, 'YYYY-MM-DD'),
                    'observaciones', j.observaciones
                  )
                end as contexto_judicial
          from constancias_atencion ca
          left join contexto_judicial j on j.caso_id = ca.caso_id
          where ca.id = $1`,
        [rows[0].id],
      );

    return { constancia: this.aConstancia(consulta.rows[0]) };
  });
}

private aConstancia(fila: Record<string, any>) {
  return {
    id: fila.id,
    casoId: fila.caso_id,
    procedencia: fila.procedencia,
    origenJudicial: fila.origen_judicial,
    estado: fila.estado,
    fechaConsentimiento: fila.fecha_consentimiento,
    referenciaEvidencia: fila.referencia_evidencia,
    explicacion: fila.explicacion,
    creadoPor: fila.creado_por,
    creadoEn: fila.creado_en,
    actualizadoPor: fila.actualizado_por,
    actualizadoEn: fila.actualizado_en,
    contextoJudicial: fila.contexto_judicial ?? null,
  };
}
}

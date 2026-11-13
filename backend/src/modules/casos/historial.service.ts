import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';

@Injectable()
export class HistorialService {
  constructor(private readonly db: DatabaseService) {}

  async obtener(casoId: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {

      const caso = await client.query(
        `select c.id, c.numero_correlativo, c.tipo,
                c.clasificacion, c.estado,
                to_char(c.fecha_ingreso, 'YYYY-MM-DD') as fecha_ingreso,
                c.creado_por, c.creado_en, c.actualizado_en,
                p.id as paciente_id, p.nombre_completo,
                a.perfil_id as terapeuta_id,
                t.nombre_completo as terapeuta_nombre
           from casos c
           join pacientes p on p.id = c.paciente_id
           left join asignaciones_caso a on a.caso_id = c.id
           left join perfiles t on t.id = a.perfil_id
          where c.id = $1
            and c.deleted_at is null
            and p.deleted_at is null
            and (
              $2::text = 'administrador'
              or (
                $2::text = 'terapeuta'
                and a.perfil_id = $3
              )
            )`,
        [casoId, usuario.rol, usuario.id],
      );

      if (!caso.rows[0]) {
        throw new NotFoundException('Caso no encontrado');
      }

      const contexto = await client.query(
        `select json_build_object(
           'juzgado', juzgado,
           'nroExpediente', nro_expediente,
           'fechaDerivacion', to_char(fecha_derivacion, 'YYYY-MM-DD'),
           'observaciones', observaciones
         ) as datos
         from contexto_judicial
         where caso_id = $1`,
        [casoId],
      );

      const constancia = await client.query(
        `select json_build_object(
           'id', id,
           'procedencia', procedencia,
           'origenJudicial', origen_judicial,
           'estado', estado,
           'fechaConsentimiento',
             to_char(fecha_consentimiento, 'YYYY-MM-DD'),
           'referenciaEvidencia', referencia_evidencia,
           'explicacion', explicacion,
           'creadoPor', creado_por,
           'creadoEn', creado_en,
           'actualizadoPor', actualizado_por,
           'actualizadoEn', actualizado_en
         ) as datos
         from constancias_atencion
         where caso_id = $1`,
        [casoId],
      );

      const diagnostico = await client.query(
        `select json_build_object(
           'id', id,
           'fecha', to_char(fecha, 'YYYY-MM-DD'),
           'diagnosticoIngreso', contenido ->> 'diagnosticoIngreso',
           'hipotesisRelacional', contenido ->> 'hipotesisRelacional',
           'comentariosClinicos', contenido ->> 'comentariosClinicos',
           'creadoPor', creado_por,
           'creadoEn', creado_en,
           'actualizadoPor', actualizado_por,
           'actualizadoEn', actualizado_en
         ) as datos
         from fichas_diagnostico
         where caso_id = $1`,
        [casoId],
      );

      const sesiones = await client.query(
        `select s.id, json_build_object(
           'id', s.id,
           'casoId', s.caso_id,
           'numero', s.nro_sesion,
           'fecha', to_char(s.fecha, 'YYYY-MM-DD'),
           'evolucion', s.evolucion,
           'responsable', json_build_object(
             'id', r.id,
             'nombreCompleto', r.nombre_completo
           ),
           'creadoPor', s.creado_por,
           'creadoEn', s.creado_en,
           'actualizadoPor', s.actualizado_por,
           'actualizadoEn', s.actualizado_en
         ) as datos
         from fichas_seguimiento s
         join perfiles r on r.id = s.responsable_id
         where s.caso_id = $1
         order by s.fecha asc, s.nro_sesion asc, s.id asc`,
        [casoId],
      );

      const tareas = await client.query(
        `select t.sesion_id, json_build_object(
           'id', t.id,
           'casoId', t.caso_id,
           'sesionId', t.sesion_id,
           'descripcion', t.descripcion,
           'estado', case when t.completada
             then 'realizada' else 'pendiente' end,
           'fecha', to_char(t.fecha_asignada, 'YYYY-MM-DD'),
           'creadoPor', t.perfil_id,
           'creadoEn', t.creado_en,
           'cumplimientoActualizadoPor',
             t.cumplimiento_actualizado_por,
           'cumplimientoActualizadoEn',
             t.cumplimiento_actualizado_en
         ) as datos
         from tareas_terapeuticas t
         join fichas_seguimiento s
           on s.id = t.sesion_id and s.caso_id = t.caso_id
         where t.caso_id = $1
         order by s.fecha asc, s.nro_sesion asc,
                  t.creado_en asc, t.id asc`,
        [casoId],
      );

      const tareasPorSesion = new Map<string, unknown[]>();

      for (const fila of tareas.rows) {
        const lista = tareasPorSesion.get(fila.sesion_id) ?? [];
        lista.push(fila.datos);
        tareasPorSesion.set(fila.sesion_id, lista);
      }

      const c = caso.rows[0];

      return {
        carpeta: {
          id: c.id,
          numero: c.numero_correlativo,
          tipo: c.tipo,
          clasificacion: c.clasificacion,
          estado: c.estado,
          fechaIngreso: c.fecha_ingreso,
          paciente: {
            id: c.paciente_id,
            nombreCompleto: c.nombre_completo,
          },
          terapeuta: c.terapeuta_id ? {
            id: c.terapeuta_id,
            nombreCompleto: c.terapeuta_nombre,
          } : null,
          creadoPor: c.creado_por,
          creadoEn: c.creado_en,
          actualizadoEn: c.actualizado_en,
        },
        contexto: contexto.rows[0]?.datos ?? null,
        constancia: constancia.rows[0]?.datos ?? null,
        diagnostico: diagnostico.rows[0]?.datos ?? null,
        sesiones: sesiones.rows.map((fila) => ({
          ...fila.datos,
          tareas: tareasPorSesion.get(fila.id) ?? [],
        })),
      };
    }, { aislamiento: 'repeatable read' });
  }
}
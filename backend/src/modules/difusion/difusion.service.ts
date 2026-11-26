import { Injectable, NotFoundException, BadRequestException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { GuardarPublicacionDto } from './dto/guardar-publicacion.dto.js';
import type { EstadoPublicacion, ListarPublicacionesAdminQuery, ListarPublicacionesQuery,} from './dto/listar-publicaciones.query.js';
import type { CrearRecursoDifusionDto } from './dto/crear-recurso-difusion.dto.js';

const CAMPOS_PUBLICOS = `
  id, tipo, titulo, resumen, contenido,
  to_char(fecha_inicio, 'YYYY-MM-DD') as "fechaInicio",
  to_char(fecha_fin, 'YYYY-MM-DD') as "fechaFin",
  modalidad, lugar, contacto_url as "contactoUrl",
  publicado_en as "publicadoEn",
  case when imagen_ruta is not null then jsonb_build_object(
    'ruta', imagen_ruta,
    'textoAlternativo', imagen_texto_alternativo,
    'ancho', imagen_ancho,
    'alto', imagen_alto
  ) end as imagen
`;

const CAMPOS_ADMIN = `
  id, tipo, titulo, resumen, contenido, estado,
  to_char(fecha_inicio, 'YYYY-MM-DD') as "fechaInicio",
  to_char(fecha_fin, 'YYYY-MM-DD') as "fechaFin",
  modalidad, lugar, contacto_url as "contactoUrl",
  creado_por as "creadoPor", actualizado_por as "actualizadoPor",
  publicado_en as "publicadoEn", retirado_en as "retiradoEn"
`;

const ESTADO_ANTERIOR: Record<EstadoPublicacion, EstadoPublicacion> = {
  publicado: 'borrador',
  retirado: 'publicado',
  borrador: 'retirado',
};

const CAMPOS_RECURSO = `
  id, ruta, tipo_mime as "tipoMime", tamano_bytes as "tamanoBytes",
  texto_alternativo as "textoAlternativo", ancho, alto, principal
`;

@Injectable()
export class DifusionService {
  constructor(private readonly db: DatabaseService) {}

  async listarPublicadas({ tipo, pagina, tamano }: ListarPublicacionesQuery) {
    const filtro = 'where ($1::text is null or tipo = $1)';
    const parametros = [tipo ?? null];

    const { rows: [conteo] } = await this.db.query<{ total: string }>(
      `select count(*) as total from public.v_publicaciones_publicas ${filtro}`,
      parametros,
    );

    const { rows } = await this.db.query(
      `select ${CAMPOS_PUBLICOS}
         from public.v_publicaciones_publicas
         ${filtro}
        order by publicado_en desc, id
        limit $2 offset $3`,
      [...parametros, tamano, (pagina - 1) * tamano],
    );

    return { publicaciones: rows, total: Number(conteo.total), pagina, tamano };
  }

  async obtenerPublicada(id: string) {
    const { rows: [publicacion] } = await this.db.query(
      `select ${CAMPOS_PUBLICOS}
         from public.v_publicaciones_publicas
        where id = $1`,
      [id],
    );

    if (!publicacion) {
      throw new NotFoundException('Publicación no encontrada');
    }

    return publicacion;
  }

    async guardar(dto: GuardarPublicacionDto, usuarioId: string, id?: string) {
    if (dto.fechaInicio && dto.fechaFin && dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException('La fecha de fin no puede ser anterior al inicio');
    }

    const limpiar = (texto?: string | null) => texto?.trim() || null;
    const valores = [
      dto.tipo,
      dto.titulo.trim(),
      limpiar(dto.resumen),
      limpiar(dto.contenido),
      dto.fechaInicio ?? null,
      dto.fechaFin ?? null,
      dto.modalidad ?? null,
      limpiar(dto.lugar),
      limpiar(dto.contactoUrl),
    ];

    const devolver = `returning ${CAMPOS_ADMIN}`;

    try {
      return await this.db.transaction(usuarioId, async (client) => {
        const { rows } = id
          ? await client.query(
              `update public.publicaciones_difusion
                  set tipo = $1, titulo = $2, resumen = $3, contenido = $4,
                      fecha_inicio = $5, fecha_fin = $6, modalidad = $7,
                      lugar = $8, contacto_url = $9
                where id = $10
                ${devolver}`,
              [...valores, id],
            )
          : await client.query(
              `insert into public.publicaciones_difusion
                 (tipo, titulo, resumen, contenido, fecha_inicio, fecha_fin,
                  modalidad, lugar, contacto_url)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ${devolver}`,
              valores,
            );

        if (!rows[0]) {
          throw new NotFoundException('Publicación no encontrada');
        }

        return rows[0];
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23514') {
        throw new BadRequestException('Los datos de la publicación no son válidos');
      }

      throw error;
    } 
  }

    async listarAdmin({ tipo, estado, pagina, tamano }: ListarPublicacionesAdminQuery) {
    const filtro = `where ($1::text is null or tipo = $1)
                      and ($2::text is null or estado = $2)`;
    const parametros = [tipo ?? null, estado ?? null];

    const { rows: [conteo] } = await this.db.query<{ total: string }>(
      `select count(*) as total from public.publicaciones_difusion ${filtro}`,
      parametros,
    );

    const { rows } = await this.db.query(
      `select ${CAMPOS_ADMIN}
         from public.publicaciones_difusion
         ${filtro}
        order by actualizado_en desc, id
        limit $3 offset $4`,
      [...parametros, tamano, (pagina - 1) * tamano],
    );

    return { publicaciones: rows, total: Number(conteo.total), pagina, tamano };
  }

  async obtenerAdmin(id: string) {
    const { rows: [publicacion] } = await this.db.query(
      `select ${CAMPOS_ADMIN} from public.publicaciones_difusion where id = $1`,
      [id],
    );

    if (!publicacion) throw new NotFoundException('Publicación no encontrada');
        const { rows: recursos } = await this.db.query(
      `select ${CAMPOS_RECURSO}
         from public.recursos_difusion
        where publicacion_id = $1
        order by principal desc, creado_en, id`,
      [id],
    );
    return { ...publicacion, recursos };
  }

  async cambiarEstado(id: string, estado: EstadoPublicacion, usuarioId: string) {
    return this.db.transaction(usuarioId, async (client) => {
      const { rows: [actual] } = await client.query<{
        estado: EstadoPublicacion;
        resumen: string | null;
      }>(
        `select estado, resumen from public.publicaciones_difusion
          where id = $1 for update`,
        [id],
      );

      if (!actual) throw new NotFoundException('Publicación no encontrada');

      if (actual.estado !== ESTADO_ANTERIOR[estado]) {
        throw new ConflictException('El cambio de estado no está permitido');
      }

      if (estado === 'publicado' && !actual.resumen?.trim()) {
        throw new UnprocessableEntityException({
          message: 'Faltan datos para publicar',
          camposFaltantes: ['resumen'],
        });
      }

      const { rows: [publicacion] } = await client.query(
        `update public.publicaciones_difusion
            set estado = $2
          where id = $1
          returning ${CAMPOS_ADMIN}`,
        [id, estado],
      );

      return publicacion;
    });
  }

    async agregarRecurso(id: string, dto: CrearRecursoDifusionDto, usuarioId: string) {
    try {
      return await this.db.transaction(usuarioId, async (client) => {
        const { rows: [recurso] } = await client.query(
          `insert into public.recursos_difusion
             (publicacion_id, ruta, tipo_mime, tamano_bytes,
              texto_alternativo, ancho, alto, principal, creado_por)
           select id, $2, $3, $4, $5, $6, $7, $8,
                  nullif(current_setting('app.usuario_id', true), '')::uuid
             from public.publicaciones_difusion
            where id = $1
           returning ${CAMPOS_RECURSO}`,
          [
            id, dto.ruta, dto.tipoMime, dto.tamanoBytes,
            dto.textoAlternativo.trim(), dto.ancho ?? null, dto.alto ?? null,
            dto.principal ?? false,
          ],
        );

        if (!recurso) throw new NotFoundException('Publicación no encontrada');
        return recurso;
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new ConflictException('La ruta ya está registrada o ya existe una imagen principal');
      }
      throw error;
    }
  }

  async quitarRecurso(id: string, recursoId: string, usuarioId: string): Promise<void> {
    await this.db.transaction(usuarioId, async (client) => {
      const resultado = await client.query(
        `delete from public.recursos_difusion
          where publicacion_id = $1 and id = $2`,
        [id, recursoId],
      );

      if (resultado.rowCount === 0) {
        throw new NotFoundException('Recurso no encontrado en la publicación');
      }
    });
  }
}

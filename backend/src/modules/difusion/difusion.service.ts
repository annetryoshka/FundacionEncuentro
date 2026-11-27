import { Injectable, NotFoundException, BadRequestException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import { ImagenesPublicasService } from '../imagenes-publicas/imagenes-publicas.service.js';
import { procesarImagenPublica } from '../imagenes-publicas/procesar-imagen.js';
import type { GuardarPublicacionDto } from './dto/guardar-publicacion.dto.js';
import type { EstadoPublicacion, ListarPublicacionesAdminQuery, ListarPublicacionesQuery,} from './dto/listar-publicaciones.query.js';

const CAMPOS_PUBLICOS = `
  id, tipo, titulo, resumen, contenido,
  to_char(fecha_inicio, 'YYYY-MM-DD') as "fechaInicio",
  to_char(fecha_fin, 'YYYY-MM-DD') as "fechaFin",
  modalidad, lugar, contacto_url as "contactoUrl",
  publicado_en as "publicadoEn",
  case when imagen_id is not null then jsonb_build_object(
    'id', imagen_id,
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

const CONSULTA_IMAGEN = `
  select r.imagen_id as id, r.texto_alternativo as "textoAlternativo",
         i.ancho, i.alto, i.tamano_bytes as "tamanoBytes"
    from public.recursos_difusion r
    join public.imagenes_publicas i on i.id = r.imagen_id
   where r.publicacion_id = $1
`;

@Injectable()
export class DifusionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly imagenes: ImagenesPublicasService,
  ) {}

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
    const { rows: [imagen] } = await this.db.query(CONSULTA_IMAGEN, [id]);
    return { ...publicacion, imagen: imagen ?? null };
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

  /** Sube o reemplaza la imagen de portada. La anterior se borra (trigger de 024). */
  async subirImagen(id: string, archivo: Buffer | undefined, textoAlternativo: string, usuarioId: string) {
    await this.existe(id);
    const procesada = await procesarImagenPublica(archivo);
    return this.db.transaction(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const imagenId = await this.imagenes.guardar(client, procesada);
      await client.query(
        `insert into public.recursos_difusion (publicacion_id, imagen_id, texto_alternativo, creado_por)
         values ($1, $2, $3, nullif(current_setting('app.usuario_id', true), '')::uuid)
         on conflict (publicacion_id) do update
           set imagen_id = excluded.imagen_id, texto_alternativo = excluded.texto_alternativo,
               creado_por = excluded.creado_por, creado_en = now()`,
        [id, imagenId, textoAlternativo.trim()],
      );
      const { rows: [imagen] } = await client.query(CONSULTA_IMAGEN, [id]);
      return imagen;
    });
  }

  async cambiarTextoImagen(id: string, textoAlternativo: string, usuarioId: string) {
    return this.db.transaction(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const { rowCount } = await client.query(
        'update public.recursos_difusion set texto_alternativo = $2 where publicacion_id = $1',
        [id, textoAlternativo.trim()],
      );
      if (!rowCount) throw new NotFoundException('La publicación no tiene imagen');
      const { rows: [imagen] } = await client.query(CONSULTA_IMAGEN, [id]);
      return imagen;
    });
  }

  async quitarImagen(id: string, usuarioId: string): Promise<void> {
    await this.db.transaction(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const { rowCount } = await client.query('delete from public.recursos_difusion where publicacion_id = $1', [id]);
      if (!rowCount) throw new NotFoundException('La publicación no tiene imagen');
    });
  }

  /** Archivo para la vista previa de gestión, también en borrador. */
  async archivoImagen(id: string) {
    const { rows: [recurso] } = await this.db.query<{ imagenId: string }>(
      'select imagen_id as "imagenId" from public.recursos_difusion where publicacion_id = $1',
      [id],
    );
    const archivo = recurso ? await this.imagenes.leer(recurso.imagenId) : null;
    if (!archivo) throw new NotFoundException('La publicación no tiene imagen');
    return archivo;
  }

  /** Antes de procesar la foto: no se gasta trabajo en una publicación que no existe. */
  private async existe(id: string) {
    const { rowCount } = await this.db.query('select 1 from public.publicaciones_difusion where id = $1', [id]);
    if (!rowCount) throw new NotFoundException('Publicación no encontrada');
  }

  private async bloquear(client: PoolClient, id: string) {
    const { rowCount } = await client.query(
      'select 1 from public.publicaciones_difusion where id = $1 for update',
      [id],
    );
    if (!rowCount) throw new NotFoundException('Publicación no encontrada');
  }
}

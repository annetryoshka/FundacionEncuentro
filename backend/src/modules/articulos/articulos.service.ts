import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type {
  EstadoArticulo,
  GuardarArticuloDto,
  ListarArticulosPublicosQuery,
  ListarArticulosQuery,
} from './dto/articulo.dto.js';

const IMAGEN = `case when imagen_ruta is not null then jsonb_build_object(
    'ruta', imagen_ruta,
    'textoAlternativo', imagen_texto_alternativo,
    'ancho', imagen_ancho,
    'alto', imagen_alto
  ) end as imagen`;

const CAMPOS_PUBLICOS_LISTADO = `
  id, titulo, resumen, autor,
  to_char(fecha_publicacion, 'YYYY-MM-DD') as "fechaPublicacion",
  ${IMAGEN}
`;

const CAMPOS_ADMIN = `
  id, titulo, resumen, contenido, estado,
  autor_visible as "autorVisible",
  ${IMAGEN},
  autor_id as "creadoPor", creado_en as "creadoEn",
  actualizado_por as "actualizadoPor", actualizado_en as "actualizadoEn",
  publicado_en as "publicadoEn", publicado_por as "publicadoPor",
  retirado_en as "retiradoEn", retirado_por as "retiradoPor"
`;

const ESTADO_ANTERIOR: Record<EstadoArticulo, EstadoArticulo> = {
  publicado: 'borrador',
  retirado: 'publicado',
  borrador: 'retirado',
};

@Injectable()
export class ArticulosService {
  constructor(private readonly db: DatabaseService) {}

  async listarPublicados({ pagina, tamano }: ListarArticulosPublicosQuery) {
    const { rows: [conteo] } = await this.db.query<{ total: string }>(
      'select count(*) as total from public.v_investigaciones_publicas',
    );
    const { rows } = await this.db.query(
      `select ${CAMPOS_PUBLICOS_LISTADO}
         from public.v_investigaciones_publicas
        order by publicado_en desc, id
        limit $1 offset $2`,
      [tamano, (pagina - 1) * tamano],
    );
    return { investigaciones: rows, total: Number(conteo.total), pagina, tamano };
  }

  async obtenerPublicado(id: string) {
    const { rows: [articulo] } = await this.db.query(
      `select ${CAMPOS_PUBLICOS_LISTADO}, contenido
         from public.v_investigaciones_publicas
        where id = $1`,
      [id],
    );
    if (!articulo) throw new NotFoundException('Investigación no encontrada');
    return articulo;
  }

  listar(usuarioId: string, { estado, pagina, tamano }: ListarArticulosQuery) {
    return this.ejecutar(usuarioId, async (client) => {
      const filtro = 'where ($1::text is null or estado = $1)';
      const { rows: [conteo] } = await client.query<{ total: string }>(
        `select count(*) as total from public.publicaciones_foro ${filtro}`,
        [estado ?? null],
      );
      const { rows } = await client.query(
        `select ${CAMPOS_ADMIN}
           from public.publicaciones_foro
           ${filtro}
          order by actualizado_en desc, id
          limit $2 offset $3`,
        [estado ?? null, tamano, (pagina - 1) * tamano],
      );
      return { articulos: rows, total: Number(conteo.total), pagina, tamano };
    });
  }

  obtener(usuarioId: string, id: string) {
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [articulo] } = await client.query(
        `select ${CAMPOS_ADMIN} from public.publicaciones_foro where id = $1`,
        [id],
      );
      if (!articulo) throw new NotFoundException('Investigación no encontrada');
      return articulo;
    });
  }

  crear(usuarioId: string, dto: GuardarArticuloDto) {
    const valores = this.valores(dto);
    return this.ejecutar(usuarioId, async (client) => {
      const { rows } = await client.query(
        `insert into public.publicaciones_foro
           (titulo, resumen, contenido, autor_visible,
            imagen_ruta, imagen_texto_alternativo, imagen_ancho, imagen_alto)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning ${CAMPOS_ADMIN}`,
        valores,
      );
      return rows[0];
    });
  }

  editar(usuarioId: string, id: string, dto: GuardarArticuloDto) {
    const valores = this.valores(dto);
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [actual] } = await client.query<{ estado: EstadoArticulo }>(
        'select estado from public.publicaciones_foro where id = $1 for update',
        [id],
      );
      if (!actual) throw new NotFoundException('Investigación no encontrada');
      if (actual.estado === 'publicado' && !valores[1]) {
        throw new UnprocessableEntityException({
          message: 'Un artículo publicado necesita resumen',
          camposFaltantes: ['resumen'],
        });
      }
      const { rows } = await client.query(
        `update public.publicaciones_foro
            set titulo = $2, resumen = $3, contenido = $4, autor_visible = $5,
                imagen_ruta = $6, imagen_texto_alternativo = $7, imagen_ancho = $8, imagen_alto = $9
          where id = $1
          returning ${CAMPOS_ADMIN}`,
        [id, ...valores],
      );
      return rows[0];
    });
  }

  cambiarEstado(usuarioId: string, id: string, estado: EstadoArticulo) {
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [actual] } = await client.query<{ estado: EstadoArticulo; resumen: string | null }>(
        'select estado, resumen from public.publicaciones_foro where id = $1 for update',
        [id],
      );
      if (!actual) throw new NotFoundException('Investigación no encontrada');
      if (actual.estado !== ESTADO_ANTERIOR[estado]) {
        throw new ConflictException(`No se puede pasar de ${actual.estado} a ${estado}`);
      }
      if (estado === 'publicado' && !actual.resumen?.trim()) {
        throw new UnprocessableEntityException({
          message: 'Faltan datos para publicar',
          camposFaltantes: ['resumen'],
        });
      }
      const { rows } = await client.query(
        `update public.publicaciones_foro set estado = $2 where id = $1 returning ${CAMPOS_ADMIN}`,
        [id, estado],
      );
      return rows[0];
    });
  }

  eliminar(usuarioId: string, id: string) {
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [actual] } = await client.query<{ publicado: boolean }>(
        'select publicado_en is not null as publicado from public.publicaciones_foro where id = $1 for update',
        [id],
      );
      if (!actual) throw new NotFoundException('Investigación no encontrada');
      if (actual.publicado) {
        throw new ConflictException('Una investigación ya publicada no se elimina: se retira');
      }
      await client.query('delete from public.publicaciones_foro where id = $1', [id]);
    });
  }

  private valores(dto: GuardarArticuloDto) {
    const limpiar = (texto?: string | null) => texto?.trim() || null;
    const imagen = dto.imagen ?? null;
    return [
      dto.titulo.trim(),
      limpiar(dto.resumen),
      dto.contenido.trim(),
      limpiar(dto.autorVisible),
      imagen?.ruta ?? null,
      imagen ? imagen.textoAlternativo.trim() : null,
      imagen?.ancho ?? null,
      imagen?.alto ?? null,
    ];
  }

  private async ejecutar<T>(usuarioId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(usuarioId, fn);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) throw error;
      if (error.code === '42501') throw new ForbiddenException('Solo administración o marketing gestionan investigaciones');
      if (error.code === '23514' || error.code === '23502') {
        throw new BadRequestException('Revisa el título, el resumen, el contenido, el autor y la imagen');
      }
      throw error;
    }
  }
}

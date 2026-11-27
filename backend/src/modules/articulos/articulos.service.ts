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
import { ImagenesPublicasService } from '../imagenes-publicas/imagenes-publicas.service.js';
import { procesarImagenPublica } from '../imagenes-publicas/procesar-imagen.js';
import type {
  EstadoArticulo,
  GuardarArticuloDto,
  ListarArticulosPublicosQuery,
  ListarArticulosQuery,
} from './dto/articulo.dto.js';

const CAMPOS_PUBLICOS_LISTADO = `
  id, titulo, resumen, autor,
  to_char(fecha_publicacion, 'YYYY-MM-DD') as "fechaPublicacion",
  case when imagen_id is not null then jsonb_build_object(
    'id', imagen_id,
    'textoAlternativo', imagen_texto_alternativo,
    'ancho', imagen_ancho,
    'alto', imagen_alto
  ) end as imagen
`;

/** Artículo con su imagen (024): el archivo está en imagenes_publicas. */
const SELECT_ADMIN = `
  select f.id, f.titulo, f.resumen, f.contenido, f.estado,
         f.autor_visible as "autorVisible",
         case when f.imagen_id is not null then jsonb_build_object(
           'id', f.imagen_id,
           'textoAlternativo', f.imagen_texto_alternativo,
           'ancho', i.ancho,
           'alto', i.alto,
           'tamanoBytes', i.tamano_bytes
         ) end as imagen,
         f.autor_id as "creadoPor", f.creado_en as "creadoEn",
         f.actualizado_por as "actualizadoPor", f.actualizado_en as "actualizadoEn",
         f.publicado_en as "publicadoEn", f.publicado_por as "publicadoPor",
         f.retirado_en as "retiradoEn", f.retirado_por as "retiradoPor"
    from public.publicaciones_foro f
    left join public.imagenes_publicas i on i.id = f.imagen_id
`;

const ESTADO_ANTERIOR: Record<EstadoArticulo, EstadoArticulo> = {
  publicado: 'borrador',
  retirado: 'publicado',
  borrador: 'retirado',
};

@Injectable()
export class ArticulosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly imagenes: ImagenesPublicasService,
  ) {}

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
      const { rows: [conteo] } = await client.query<{ total: string }>(
        'select count(*) as total from public.publicaciones_foro where ($1::text is null or estado = $1)',
        [estado ?? null],
      );
      const { rows } = await client.query(
        `${SELECT_ADMIN}
          where ($1::text is null or f.estado = $1)
          order by f.actualizado_en desc, f.id
          limit $2 offset $3`,
        [estado ?? null, tamano, (pagina - 1) * tamano],
      );
      return { articulos: rows, total: Number(conteo.total), pagina, tamano };
    });
  }

  obtener(usuarioId: string, id: string) {
    return this.ejecutar(usuarioId, (client) => this.leer(client, id));
  }

  crear(usuarioId: string, dto: GuardarArticuloDto) {
    const valores = this.valores(dto);
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [{ id }] } = await client.query<{ id: string }>(
        `insert into public.publicaciones_foro (titulo, resumen, contenido, autor_visible)
         values ($1, $2, $3, $4)
         returning id`,
        valores,
      );
      return this.leer(client, id);
    });
  }

  /** La imagen no viaja en el formulario: se gestiona con PUT/PATCH/DELETE :id/imagen y se conserva aquí. */
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
      await client.query(
        `update public.publicaciones_foro
            set titulo = $2, resumen = $3, contenido = $4, autor_visible = $5
          where id = $1`,
        [id, ...valores],
      );
      return this.leer(client, id);
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
      await client.query('update public.publicaciones_foro set estado = $2 where id = $1', [id, estado]);
      return this.leer(client, id);
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

  /** Sube o reemplaza la imagen de portada. La anterior se borra (trigger de 024). */
  async subirImagen(usuarioId: string, id: string, archivo: Buffer | undefined, textoAlternativo: string) {
    const { rowCount } = await this.db.query('select 1 from public.publicaciones_foro where id = $1', [id]);
    if (!rowCount) throw new NotFoundException('Investigación no encontrada');
    const procesada = await procesarImagenPublica(archivo);
    return this.ejecutar(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const imagenId = await this.imagenes.guardar(client, procesada);
      await client.query(
        'update public.publicaciones_foro set imagen_id = $2, imagen_texto_alternativo = $3 where id = $1',
        [id, imagenId, textoAlternativo.trim()],
      );
      return (await this.leer(client, id)).imagen;
    });
  }

  cambiarTextoImagen(usuarioId: string, id: string, textoAlternativo: string) {
    return this.ejecutar(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const { rowCount } = await client.query(
        `update public.publicaciones_foro set imagen_texto_alternativo = $2
          where id = $1 and imagen_id is not null`,
        [id, textoAlternativo.trim()],
      );
      if (!rowCount) throw new NotFoundException('El artículo no tiene imagen');
      return (await this.leer(client, id)).imagen;
    });
  }

  quitarImagen(usuarioId: string, id: string) {
    return this.ejecutar(usuarioId, async (client) => {
      await this.bloquear(client, id);
      const { rowCount } = await client.query(
        `update public.publicaciones_foro set imagen_id = null, imagen_texto_alternativo = null
          where id = $1 and imagen_id is not null`,
        [id],
      );
      if (!rowCount) throw new NotFoundException('El artículo no tiene imagen');
    });
  }

  /** Archivo para la vista previa de gestión, también en borrador. */
  async archivoImagen(id: string) {
    const { rows: [fila] } = await this.db.query<{ imagenId: string | null }>(
      'select imagen_id as "imagenId" from public.publicaciones_foro where id = $1',
      [id],
    );
    const archivo = fila?.imagenId ? await this.imagenes.leer(fila.imagenId) : null;
    if (!archivo) throw new NotFoundException('El artículo no tiene imagen');
    return archivo;
  }

  private async leer(client: PoolClient, id: string) {
    const { rows: [articulo] } = await client.query(`${SELECT_ADMIN} where f.id = $1`, [id]);
    if (!articulo) throw new NotFoundException('Investigación no encontrada');
    return articulo;
  }

  private async bloquear(client: PoolClient, id: string) {
    const { rowCount } = await client.query('select 1 from public.publicaciones_foro where id = $1 for update', [id]);
    if (!rowCount) throw new NotFoundException('Investigación no encontrada');
  }

  private valores(dto: GuardarArticuloDto) {
    const limpiar = (texto?: string | null) => texto?.trim() || null;
    return [dto.titulo.trim(), limpiar(dto.resumen), dto.contenido.trim(), limpiar(dto.autorVisible)];
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

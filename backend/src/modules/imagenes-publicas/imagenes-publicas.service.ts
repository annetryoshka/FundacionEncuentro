import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { ImagenProcesada } from './procesar-imagen.js';

export interface ArchivoImagen {
  contenido: Buffer;
  tipoMime: string;
  sha256: string;
}

const CAMPOS_ARCHIVO = `contenido, tipo_mime as "tipoMime", encode(sha256, 'hex') as sha256`;

@Injectable()
export class ImagenesPublicasService {
  constructor(private readonly db: DatabaseService) {}

  /** Guarda la imagen dentro de la transacción de quien la usa. Devuelve su id. */
  async guardar(client: PoolClient, imagen: ImagenProcesada): Promise<string> {
    const { rows: [fila] } = await client.query<{ id: string }>(
      `insert into public.imagenes_publicas (tipo_mime, tamano_bytes, ancho, alto, contenido)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [imagen.tipoMime, imagen.contenido.length, imagen.ancho, imagen.alto, imagen.contenido],
    );
    return fila.id;
  }

  /** Solo si la usa una publicación o un artículo publicado: lo deciden las vistas públicas. */
  async leerPublicada(id: string): Promise<ArchivoImagen | null> {
    const { rows: [imagen] } = await this.db.query<ArchivoImagen>(
      `select ${CAMPOS_ARCHIVO}
         from public.imagenes_publicas i
        where i.id = $1
          and (exists (select 1 from public.v_publicaciones_publicas v where v.imagen_id = i.id)
               or exists (select 1 from public.v_investigaciones_publicas v where v.imagen_id = i.id))`,
      [id],
    );
    return imagen ?? null;
  }

  /** Vista previa en gestión: la imagen en cualquier estado de lo que la usa. */
  async leer(id: string): Promise<ArchivoImagen | null> {
    const { rows: [imagen] } = await this.db.query<ArchivoImagen>(
      `select ${CAMPOS_ARCHIVO} from public.imagenes_publicas where id = $1`,
      [id],
    );
    return imagen ?? null;
  }
}

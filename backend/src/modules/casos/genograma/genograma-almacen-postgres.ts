import { Injectable, NotFoundException } from '@nestjs/common';
import type { Usuario } from '../../../common/types/usuario.js';
import { DatabaseService } from '../../../database/database.service.js';
import { GenogramaAccesoService } from './genograma-acceso.service.js';
import type {
  GenogramaArchivos,
  GenogramaMetadatos,
} from './genograma-descarga.service.js';
import type { GenogramaEscritura } from './genograma-reemplazo.service.js';

const CLAVE = /^([0-9a-f-]{36})\/[0-9a-f-]{36}$/;

type Version = Parameters<GenogramaEscritura['activarVersion']>[2];

/** Archivos de genograma en PostgreSQL (migración 012). */
@Injectable()
export class GenogramaAlmacenPostgres
  implements GenogramaArchivos, GenogramaEscritura
{
  constructor(
    private readonly db: DatabaseService,
    private readonly acceso: GenogramaAccesoService,
  ) {}

  async guardarNuevo(clave: string, contenido: Buffer, tipo: string): Promise<void> {
    const casoId = CLAVE.exec(clave)?.[1];
    if (!casoId) throw new Error('Clave de genograma inválida');

    await this.db.transaction(null, (client) =>
      client.query(
        `insert into genograma_archivos (clave, caso_id, tipo, tamanio, contenido)
         values ($1, $2, $3, $4, $5)`,
        [clave, casoId, tipo, contenido.length, contenido],
      ),
    );
  }

  async activarVersion(casoId: string, usuario: Usuario, version: Version): Promise<void> {
    await this.db.transaction(usuario.id, async (client) => {
      await this.acceso.verificar(casoId, usuario, client);

      const activado = await client.query(
        `update genograma_archivos
            set nombre = $3, subido_por = $4, activado_en = now()
          where clave = $1 and caso_id = $2 and activado_en is null
            and tipo = $5 and tamanio = $6`,
        [version.clave, casoId, version.nombre, usuario.id, version.tipo, version.tamanio],
      );
      if (activado.rowCount !== 1) {
        throw new Error('El archivo del genograma no está disponible para activar');
      }

      await client.query(
        `insert into genogramas (caso_id, archivo_clave, actualizado_por)
         values ($1, $2, $3)
         on conflict (caso_id) do update
           set archivo_clave = excluded.archivo_clave,
               actualizado_por = excluded.actualizado_por`,
        [casoId, version.clave, usuario.id],
      );
    });
  }

  async buscarVigente(
    casoId: string,
  ): Promise<(GenogramaMetadatos & { clave: string }) | null> {
    const { rows } = await this.db.query<{
      clave: string;
      nombre: string;
      tipo: string;
      tamanio: number;
      autor_id: string;
      activado_en: Date;
    }>(
      `select a.clave, a.nombre, a.tipo, a.tamanio,
              a.subido_por as autor_id, a.activado_en
         from genogramas g
         join genograma_archivos a
           on a.clave = g.archivo_clave and a.caso_id = g.caso_id
        where g.caso_id = $1`,
      [casoId],
    );
    const fila = rows[0];
    if (!fila) return null;

    return {
      clave: fila.clave,
      nombre: fila.nombre,
      tipo: fila.tipo,
      tamanio: fila.tamanio,
      autorId: fila.autor_id,
      actualizadoEn: fila.activado_en.toISOString(),
    };
  }

  async leer(clave: string): Promise<Buffer> {
    const { rows } = await this.db.query<{ contenido: Buffer }>(
      'select contenido from genograma_archivos where clave = $1',
      [clave],
    );
    if (!rows[0]) throw new NotFoundException('Genograma no encontrado');
    return rows[0].contenido;
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { FormatoExportacion } from './exportaciones.service.js';
import { createHash } from 'node:crypto';

type TipoDocumento = 'informe' | 'ficha' | 'historial';
type SeccionExportacion = 'identificacion' | 'familia' | 'diagnostico' | 'sesiones';

export type ParametrosExportacion = {
  documento: TipoDocumento;
  formato: FormatoExportacion;
  informeVersionId?: string;
  secciones?: SeccionExportacion[];
  incluirGenograma?: boolean;
  incluirPagos?: boolean;
};

type ExportacionPreparada = {
  exportacionId: string;
  documento: TipoDocumento;
  formato: FormatoExportacion;
  estado: 'preparada';
  archivoNombre: string;
  archivoPath: string;
  datos: Record<string, unknown>;
};

@Injectable()
export class ExportacionesRegistroService {
  constructor(private readonly db: DatabaseService) {}

  preparar(
    casoId: string,
    usuarioId: string,
    parametros: ParametrosExportacion,
    datosMostrados?: Record<string, unknown>,
  ): Promise<ExportacionPreparada> {
    return this.db.transaction(usuarioId, async (client) => {
      const { rows: [registro] } = await client.query<{ id: string }>(
        'select public.preparar_exportacion_documento($1::uuid, $2::jsonb, $3::jsonb) as id',
        [casoId, parametros, datosMostrados ?? null],
      );

      const { rows: [resultado] } = await client.query<{ exportacion: ExportacionPreparada }>(
        'select public.datos_exportacion_documento($1::uuid) as exportacion',
        [registro.id],
      );

      return resultado.exportacion;
    });
  }

    async registrarArchivo(
    exportacionId: string,
    usuarioId: string,
    contenido: Buffer,
  ): Promise<void> {
    const sha256 = createHash('sha256').update(contenido).digest('hex');

    await this.db.transaction(usuarioId, async (client) => {
      await client.query(
        'select public.registrar_archivo_exportacion($1::uuid, $2::text, $3::bigint)',
        [exportacionId, sha256, contenido.length],
      );
    });
  }

  async registrarFallo(
    exportacionId: string,
    usuarioId: string,
    mensaje: string,
  ): Promise<void> {
    await this.db.transaction(usuarioId, async (client) => {
      await client.query(
        'select public.registrar_fallo_exportacion($1::uuid, $2::text)',
        [exportacionId, mensaje],
      );
    });
  }

    async consultarArchivo(
    casoId: string,
    exportacionId: string,
    usuarioId: string,
  ) {
    return this.db.transaction(usuarioId, async (client) => {
      const { rows: [fila] } = await client.query<{
        archivo: {
          archivoPath: string;
          archivoNombre: string;
          tipoContenido: string;
          bytes: number;
          sha256: string;
        } | null;
      }>(
        `select case
           when (public.exportacion_documento_accesible($1::uuid)).caso_id = $2::uuid
           then public.archivo_exportacion($1::uuid)
         end as archivo`,
        [exportacionId, casoId],
      );

      return fila.archivo;
    });
  }
}
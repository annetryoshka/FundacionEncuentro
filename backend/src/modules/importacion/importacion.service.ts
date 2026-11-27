import { createHash } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import { leerCsvImportacion } from './leer-csv-importacion.js';
import type { ConfirmarImportacionDto, DecidirFilaImportacionDto, CorregirFilaImportacionDto } from './dto/decidir-importacion.dto.js';
import { leerXlsxImportacion} from './leer-xlsx-importacion.js'

@Injectable()
export class ImportacionService {
  constructor(private readonly db: DatabaseService) {}

  async cargarArchivo(perfilId: string, nombre: string, contenido: Buffer, formato: 'csv' | 'xlsx', origen?: string) {
    const huella = createHash('sha256').update(contenido).digest('hex');

    return this.db.transaction(perfilId, async (client) => {
      const { rows: [existente] } = await client.query<{ id: string }>(
        `select id from public.importaciones
          where archivo_sha256 = $1 and estado = 'confirmada'
          limit 1`,
        [huella],
      );

      if (existente) {
        throw new ConflictException({
          message: 'Este archivo ya fue importado',
          loteId: existente.id,
        });
      }

      const { rows: [plantilla] } = await client.query<{ columnas: string[] }>(
        'select public.importacion_columnas() as columnas',
      );
      const filas = formato === 'xlsx' ? await leerXlsxImportacion(contenido, plantilla.columnas) : leerCsvImportacion(contenido, plantilla.columnas);

      const { rows: [lote] } = await client.query<{ id: string }>(
        `insert into public.importaciones
           (perfil_id, archivo_nombre, formato, archivo_sha256, origen)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [perfilId, nombre, formato, huella, origen?.trim() || null],
      );

      await client.query(
        `insert into public.importacion_filas
           (importacion_id, numero_fila, referencia_origen, datos)
         select $1, f."numeroFila", nullif(btrim(f.datos ->> 'referenciaOrigen'), ''), f.datos
           from jsonb_to_recordset($2::jsonb) as f("numeroFila" int, datos jsonb)`,
        [lote.id, JSON.stringify(filas)],
      );

      await client.query('select public.clasificar_importacion($1::uuid)', [lote.id]);
      return this.leerVistaPrevia(client, lote.id);
    });
  }

  async obtener(loteId: string, perfilId: string) {
    return this.db.transaction(perfilId, (client) =>
      this.leerVistaPrevia(client, loteId),
    );
  }

    async decidirFila(
    loteId: string,
    numeroFila: number,
    perfilId: string,
    dto: DecidirFilaImportacionDto,
  ) {
    const destinos = [
      dto.pacienteDestinoId ?? null,
      dto.casoDestinoId ?? null,
      dto.filaDestino ?? null,
    ];

    const cantidad = destinos.filter((destino) => destino !== null).length;
    if (cantidad !== (dto.decision === 'vincular' ? 1 : 0)) {
      throw new BadRequestException('Vincular requiere un único destino');
    }

    return this.ejecutarCambio(perfilId, async (client) => {
      const { rows: [lote] } = await client.query<{ version: number; estado: string }>(
        `select version, estado from public.importaciones
          where id = $1 for update`,
        [loteId],
      );

      if (!lote) throw new NotFoundException('Lote de importación no encontrado');
      if (lote.estado !== 'en_revision' || lote.version !== dto.version) {
        throw new ConflictException('El lote cambió. Vuelve a consultar la vista previa.');
      }

      const resultado = await client.query(
        `update public.importacion_filas
            set decision = $3, paciente_destino_id = $4,
                caso_destino_id = $5, fila_destino = $6
          where importacion_id = $1 and numero_fila = $2`,
        [loteId, numeroFila, dto.decision, ...destinos],
      );

      if (resultado.rowCount === 0) {
        throw new NotFoundException('Fila de importación no encontrada');
      }

      return this.leerVistaPrevia(client, loteId);
    });
  }

    async corregirFila(
    loteId: string,
    numeroFila: number,
    perfilId: string,
    dto: CorregirFilaImportacionDto,
  ) {
    return this.ejecutarCambio(perfilId, async (client) => {
      const { rows: [lote] } = await client.query<{ version: number; estado: string }>(
        `select version, estado from public.importaciones
          where id = $1 for update`,
        [loteId],
      );

      if (!lote) throw new NotFoundException('Lote de importación no encontrado');
      if (lote.estado !== 'en_revision' || lote.version !== dto.version) {
        throw new ConflictException('El lote cambió. Vuelve a consultar la vista previa.');
      }

      const { rows: [plantilla] } = await client.query<{ columnas: string[] }>(
        'select public.importacion_columnas() as columnas',
      );
      const columnas = new Set(plantilla.columnas);
      const cambios = Object.entries(dto.datos);

      if (
        cambios.length === 0 ||
        cambios.some(([campo, valor]) =>
          !columnas.has(campo) || (valor !== null && typeof valor !== 'string'),
        )
      ) {
        throw new BadRequestException('Envía columnas de la plantilla con valores de texto o null');
      }

      const resultado = await client.query(
        `update public.importacion_filas
            set datos = datos || $3::jsonb,
                referencia_origen = nullif(btrim((datos || $3::jsonb) ->> 'referenciaOrigen'), ''),
                decision = null,
                paciente_destino_id = null,
                caso_destino_id = null,
                fila_destino = null
          where importacion_id = $1 and numero_fila = $2`,
        [loteId, numeroFila, JSON.stringify(dto.datos)],
      );

      if (resultado.rowCount === 0) {
        throw new NotFoundException('Fila de importación no encontrada');
      }

      await client.query('select public.clasificar_importacion($1::uuid)', [loteId]);
      return this.leerVistaPrevia(client, loteId);
    });
  }

  async confirmar(loteId: string, perfilId: string, dto: ConfirmarImportacionDto) {
    return this.ejecutarCambio(perfilId, async (client) => {
      const { rows: [fila] } = await client.query(
        `select public.confirmar_importacion(
           $1::uuid, $2::int, $3::boolean
         ) as resultado`,
        [loteId, dto.version, dto.aceptaAvanceContador ?? false],
      );

      return fila.resultado;
    });
  }

  private async ejecutarCambio<T>(
    perfilId: string,
    ejecutar: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(perfilId, ejecutar);
    } catch (error) {
      const codigo = error instanceof Error && 'code' in error
        ? error.code
        : undefined;

      if (codigo === 'P0002') {
        throw new NotFoundException('Lote de importación no encontrado');
      }
      if (codigo === 'FEI01' || codigo === 'FEI03' || codigo === '23505') {
        throw new ConflictException('El lote o los datos cambiaron. Revisa la vista previa.');
      }
      if (codigo === 'FEI02' || codigo === 'FEI04') {
        const detalle = 'detail' in (error as Error)
          ? (error as Error & { detail?: string }).detail
          : undefined;
        const datos = detalle ? JSON.parse(detalle) : [];

        throw new UnprocessableEntityException(
          codigo === 'FEI02'
            ? { message: 'Hay filas sin resolver o no quedan filas para importar', filas: datos }
            : { message: 'Debes aceptar el avance del contador', saltos: datos },
        );
      }
      if (codigo === '23503' || codigo === '23514' || codigo === '22003') {
        throw new BadRequestException('Revisa la decisión y el destino de la fila');
      }

      throw error;
    }
  }

  private async leerVistaPrevia(client: PoolClient, loteId: string) {
    const { rows: [vista] } = await client.query(
      `select i.id as "loteId", i.version, i.estado,
              i.archivo_nombre as "archivoNombre", i.origen,
              jsonb_build_object(
                'total', count(f.id),
                'validas', count(*) filter (where f.estado = 'valida_nueva'),
                'advertencias', count(*) filter (
                  where f.estado in ('posible_duplicado', 'duplicado_en_lote')
                ),
                'errores', count(*) filter (where f.estado = 'error')
              ) as resumen,
              coalesce(jsonb_agg(jsonb_build_object(
                'numeroFila', f.numero_fila,
                'referenciaOrigen', f.referencia_origen,
                'datos', f.datos,
                'estado', f.estado,
                'errores', f.errores,
                'coincidencias', f.coincidencias,
                'advertencias', f.advertencias,
                'decision', f.decision,
                'resultado', f.resultado
              ) order by f.numero_fila) filter (where f.id is not null), '[]'::jsonb) as filas
         from public.importaciones i
         left join public.importacion_filas f on f.importacion_id = i.id
        where i.id = $1
        group by i.id`,
      [loteId],
    );

    if (!vista) throw new NotFoundException('Lote de importación no encontrado');
    return vista;
  }
}
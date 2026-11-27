import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException, ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type {
  FiltrosInvestigacionQuery,
  SeleccionInvestigacionQuery,
} from './dto/filtros-investigacion.query.js';
import type { AsignarEtiquetaDto } from './dto/asignar-etiqueta.dto.js';
import type { PoolClient } from 'pg';
import type { PrepararExportacionDto } from './dto/preparar-exportacion.dto.js';
import { generarPaqueteInvestigacion, type DocumentoInvestigacion, } from './generar-paquete.js';
import type { EditarCategoriaDto } from './dto/guardar-categoria.dto.js';

@Injectable()
export class InvestigacionService {
  constructor(private readonly db: DatabaseService) {}

  async listarCategorias(perfilId: string, filtros: FiltrosInvestigacionQuery) {
    const periodo = this.parametrosDeFiltro(filtros);

    const { rows } = await this.db.query(
      `select categoria_id as id, codigo, nombre, padre_id as "padreId", activa,
              casos, etiquetas_caso as "etiquetasCaso",
              etiquetas_diagnostico as "etiquetasDiagnostico",
              etiquetas_sesion as "etiquetasSesion"
         from public.conteo_categorias($1::uuid, $2::date, $3::date, $4::text[])
        order by codigo`,
      [perfilId, ...periodo],
    );

    return { categorias: rows };
  }

  async listarSeleccion(perfilId: string, filtros: SeleccionInvestigacionQuery) {
    const periodo = this.parametrosDeFiltro(filtros);

    const { rows } = await this.db.query(
      `select caso_id as "casoId", tipo, numero_correlativo as "numeroCorrelativo",
              categorias, sesiones_en_periodo as "sesionesEnPeriodo",
              tiene_diagnostico as "tieneDiagnostico"
         from public.seleccion_investigacion(
           $1::uuid, $2::uuid[], $3::date, $4::date, $5::text[]
         )
        order by tipo, numero_correlativo, caso_id`,
      [perfilId, filtros.categorias ?? null, ...periodo],
    );

    return { casos: rows };
  }

  private parametrosDeFiltro({ desde, hasta, residencias }: FiltrosInvestigacionQuery) {
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a hasta');
    }

    return [desde ?? null, hasta ?? null, residencias ?? null];
  }

    async asignarEtiqueta(casoId: string, perfilId: string, dto: AsignarEtiquetaDto) {
    if (dto.fichaDiagnosticoId && dto.fichaSeguimientoId) {
      throw new BadRequestException('Elige diagnóstico o seguimiento, solo uno');
    }

    try {
      return await this.db.transaction(perfilId, async (client) => {
        const { rows: [etiqueta] } = await client.query(
          `insert into public.caso_categorias
             (caso_id, categoria_id, ficha_diagnostico_id, ficha_seguimiento_id,
              fragmento, nota)
           select $1, $3, $4, $5, $6, $7
            where $1::uuid in (
              select public.casos_investigacion_autorizados($2::uuid)
            )
           returning id, caso_id as "casoId", categoria_id as "categoriaId",
                     ficha_diagnostico_id as "fichaDiagnosticoId",
                     ficha_seguimiento_id as "fichaSeguimientoId",
                     fragmento, nota, etiquetado_por as "etiquetadoPor"`,
          [
            casoId,
            perfilId,
            dto.categoriaId,
            dto.fichaDiagnosticoId ?? null,
            dto.fichaSeguimientoId ?? null,
            dto.fragmento ?? null,
            dto.nota ?? null,
          ],
        );

        if (!etiqueta) throw new NotFoundException('Caso no encontrado');

        return etiqueta;
      });
    } catch (error) {
      const codigo = error instanceof Error && 'code' in error
        ? error.code
        : undefined;

      if (codigo === '23505') {
        throw new ConflictException('La categoría ya está asignada a ese destino');
      }
      if (codigo === '23503') {
        throw new BadRequestException('La categoría o la ficha del caso no es válida');
      }
      if (codigo === '23514') {
        throw new BadRequestException('La categoría debe estar vigente y el caso activo');
      }

      throw error;
    }
  }

    async prepararExportacion(perfilId: string, dto: PrepararExportacionDto) {
    if (dto.secciones.includes('tareas') && !dto.secciones.includes('seguimiento')) {
      throw new BadRequestException('Incluye seguimiento para exportar las tareas');
    }

    return this.ejecutarExportacion(perfilId, async (client) => {
      const { rows: [fila] } = await client.query<{ exportacionId: string }>(
        `select public.preparar_exportacion_investigacion(
           $1::uuid[], $2::text[], $3::text, $4::date, $5::date
         ) as "exportacionId"`,
        [dto.casosIds, dto.secciones, dto.formato, dto.desde ?? null, dto.hasta ?? null],
      );
      return fila;
    });
  }

  async obtenerManifiesto(perfilId: string, id: string) {
    return this.ejecutarExportacion(perfilId, async (client) => {
      const { rows: [fila] } = await client.query(
        `select public.manifiesto_exportacion($1::uuid) as manifiesto`,
        [id],
      );
      return fila.manifiesto;
    });
  }

  async obtenerDocumento(perfilId: string, id: string, codigo: string) {
    return this.ejecutarExportacion(perfilId, async (client) => {
      const { rows: [fila] } = await client.query(
        `select public.datos_documento_investigacion($1::uuid, $2::text) as documento`,
        [id, codigo],
      );
      return fila.documento;
    });
  }

  private async ejecutarExportacion<T>(
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
        throw new NotFoundException('El paquete o uno de los casos no está disponible');
      }
      if (codigo === '42501') {
        throw new ForbiddenException('No tienes permiso para exportar estos datos');
      }
      if (codigo === '22023') {
        throw new BadRequestException('La selección, el formato o el período no son válidos');
      }
      if (codigo === 'FEX01') {
        throw new ConflictException('La selección cambió. Prepara un paquete nuevo.');
      }
      if (codigo === '23514') {
        throw new ConflictException('No se puede registrar la revisión del paquete');
      }
      throw error;
    }
  }

    async obtenerVistaRevision(perfilId: string, id: string) {
    return this.ejecutarExportacion(perfilId, async (client) => {
      const vista = await this.leerContenidoPaquete(client, id);
      const revision = await this.leerRevision(client, id);
      return {
        ...vista,
        revisadoEn: revision.revisadoEn,
        revisionVigente: revision.revisadoEn !== null && revision.huella === vista.huella,
      };
    });
  }

  async confirmarRevision(perfilId: string, id: string, huella: string) {
    return this.ejecutarExportacion(perfilId, async (client) => {
      const vista = await this.leerContenidoPaquete(client, id);

      if (vista.huella !== huella) {
        throw new ConflictException('El contenido cambió. Revisa la vista actualizada.');
      }

      // Repetir la confirmación de lo mismo no es un error: devuelve la revisión vigente.
      const previa = await this.leerRevision(client, id);
      if (previa.revisadoEn) {
        if (previa.huella === huella) return { revisadoEn: previa.revisadoEn };
        throw new ConflictException(
          'Este paquete ya se revisó y su contenido cambió después. Prepara un paquete nuevo.',
        );
      }

      const { rows: [revision] } = await client.query<{ revisadoEn: Date }>(
        `select public.marcar_revision_exportacion($1::uuid) as "revisadoEn"`,
        [id],
      );

      await client.query(
        `update public.exportaciones
            set huella_revision_investigacion = $2
          where id = $1`,
        [id, huella],
      );

      return revision;
    });
  }

  private async leerRevision(client: PoolClient, id: string) {
    const { rows: [revision] } = await client.query<{ revisadoEn: Date | null; huella: string | null }>(
      `select revisado_en as "revisadoEn", huella_revision_investigacion as huella
         from public.exportacion_investigacion_accesible($1::uuid)`,
      [id],
    );
    return revision;
  }

  private async leerContenidoPaquete(client: PoolClient, id: string) {
    const { rows: [vista] } = await client.query<{
      paquete: {
        manifiesto: Record<string, unknown>;
        documentos: DocumentoInvestigacion[]
      };
      huella: string;
    }>(
      `with contenido as materialized (
         select jsonb_build_object(
           'manifiesto', public.manifiesto_exportacion($1::uuid),
           'documentos', coalesce((
             select jsonb_agg(
               public.datos_documento_investigacion($1::uuid, d.id_exportacion)
               order by d.orden
             )
             from public.exportacion_documentos d
             where d.exportacion_id = $1
           ), '[]'::jsonb)
         ) as paquete
       )
       select paquete,
              encode(sha256(convert_to(paquete::text, 'UTF8')), 'hex') as huella
       from contenido`,
      [id],
    );

    return { ...vista.paquete, huella: vista.huella };
  }

    async descargarExportacion(perfilId: string, id: string): Promise<Buffer> {
    const vista = await this.ejecutarExportacion(perfilId, async (client) => {
      const contenido = await this.leerContenidoPaquete(client, id);

      const { rows: [revision] } = await client.query<{ huella: string | null }>(
        `select huella_revision_investigacion as huella
           from public.exportacion_investigacion_accesible($1::uuid)`,
        [id],
      );

      if (!revision.huella) {
        throw new ConflictException('Confirma la revisión antes de descargar');
      }
      if (revision.huella !== contenido.huella) {
        throw new ConflictException('El texto revisado cambió. Prepara y revisa un paquete nuevo.');
      }

      return contenido;
    });

    try {
      return await generarPaqueteInvestigacion(vista.manifiesto, vista.documentos);
    } catch {
      throw new InternalServerErrorException('No se pudo generar el paquete de investigación');
    }
  }

    async guardarCategoria(
    perfilId: string,
    dto: EditarCategoriaDto,
    destino: { codigo: string } | { id: string },
  ) {
    const valores = [
      dto.nombre,
      dto.descripcion ?? null,
      dto.padreId ?? null,
      dto.color ?? null,
      dto.activa ?? null,
    ];
    const devolver = `returning id, codigo, nombre, descripcion,
      padre_id as "padreId", color, activa`;

    try {
      return await this.db.transaction(perfilId, async (client) => {
        if ('id' in destino) {
          // Serializa los cambios de jerarquía para evitar ciclos concurrentes.
          await client.query(
            'lock table public.categorias_investigacion in share row exclusive mode',
          );

          const { rows: [categoria] } = await client.query(
            `update public.categorias_investigacion
                set nombre = $1, descripcion = $2, padre_id = $3, color = $4,
                    activa = coalesce($5::boolean, activa)
              where id = $6
              ${devolver}`,
            [...valores, destino.id],
          );

          if (!categoria) throw new NotFoundException('Categoría no encontrada');
          return categoria;
        }

        const { rows: [categoria] } = await client.query(
          `insert into public.categorias_investigacion
             (nombre, descripcion, padre_id, color, activa, codigo)
           values ($1, $2, $3, $4, coalesce($5::boolean, true), $6)
           ${devolver}`,
          [...valores, destino.codigo],
        );

        return categoria;
      });
    } catch (error) {
      const codigo = error instanceof Error && 'code' in error
        ? error.code
        : undefined;

      if (codigo === '23505') {
        throw new ConflictException('El código o el nombre en ese nivel ya existe');
      }
      if (codigo === '23503' || codigo === '23514') {
        throw new BadRequestException('Revisa los datos y la jerarquía de la categoría');
      }

      throw error;
    }
  }
}
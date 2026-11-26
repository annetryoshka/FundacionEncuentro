import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { armarDocumentoExportable } from './armar-documento-exportable.js';
import { ExportacionesAlmacenService } from './exportaciones-almacen.service.js';
import {
  ExportacionesRegistroService,
  type ParametrosExportacion,
} from './exportaciones-registro.service.js';
import { ExportacionesService } from './exportaciones.service.js';

@Injectable()
export class GenerarExportacionService {
  private readonly logger = new Logger(GenerarExportacionService.name);

  constructor(
    private readonly registro: ExportacionesRegistroService,
    private readonly generador: ExportacionesService,
    private readonly almacen: ExportacionesAlmacenService,
  ) {}

  async generar(
    casoId: string,
    usuarioId: string,
    parametros: ParametrosExportacion,
    datosMostrados?: Record<string, unknown>,
  ): Promise<{ exportacionId: string }> {
    const exportacion = await this.registro.preparar(
      casoId,
      usuarioId,
      parametros,
      datosMostrados,
    );
    const { exportacionId, archivoPath } = exportacion;
    let archivoGuardado = false;

    try {
      const documento = armarDocumentoExportable(
        exportacion.documento,
        exportacion.datos,
      );
      const contenido = await this.generador.generarArchivo(
        exportacion.formato,
        documento,
      );

      await this.almacen.guardar(archivoPath, contenido);
      archivoGuardado = true;
      await this.registro.registrarArchivo(exportacionId, usuarioId, contenido);

      return { exportacionId };
    } catch {
      try {
        await this.registro.registrarFallo(
          exportacionId,
          usuarioId,
          'No se pudo completar la generación del archivo.',
        );
        if (archivoGuardado) {
          await this.almacen.borrar(archivoPath);
        }
      } catch {
        this.logger.error(`No se pudo registrar o limpiar el fallo de ${exportacionId}`);
      }

      throw new InternalServerErrorException(
        'No se pudo completar la exportación. Intenta de nuevo.',
      );
    }
  }
}
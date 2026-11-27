import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service.js";
import { renderizarGenograma } from "./renderizar-genograma.js";
import type { DocumentoExportable } from "./generar-docx.js";

@Injectable()
export class ExportarGenogramaService {
  constructor(private readonly db: DatabaseService) {}

  async preparar(
    casoId: string,
    usuarioId: string,
    datos: Record<string, unknown>,
  ): Promise<DocumentoExportable["genograma"]> {
    const fotografia = datos.documento === "informe" ? datos.fotografia : datos;
    const genograma = (fotografia as Record<string, unknown> | undefined)
      ?.genograma as {
      vigente?: boolean;
      clave?: string;
      sha256?: string;
      nombre?: string;
      tipo?: string;
    } | null;
    if (!genograma?.vigente) return undefined;
    if (!genograma.clave || !genograma.sha256)
      throw new Error("Versión de genograma incompleta");

    // No consulta el vigente: un informe revisado debe conservar su archivo original.
    const archivo = await this.db.transaction(usuarioId, async (client) => {
      const { rows } = await client.query<{
        contenido: Buffer;
        tipo: string;
        nombre: string;
      }>(
        `select contenido, tipo, nombre from public.genograma_archivos
          where clave = $1 and caso_id = $2 and activado_en is not null
            and $2::uuid in (select public.casos_investigacion_autorizados($3::uuid))`,
        [genograma.clave, casoId, usuarioId],
      );
      return rows[0];
    });
    if (
      !archivo ||
      archivo.tipo !== genograma.tipo ||
      createHash("sha256").update(archivo.contenido).digest("hex") !==
        genograma.sha256
    ) {
      throw new Error("No se pudo verificar el genograma seleccionado");
    }
    return {
      nombre: archivo.nombre,
      paginas: await renderizarGenograma(archivo.contenido, archivo.tipo),
    };
  }
}

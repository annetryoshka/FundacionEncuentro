import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const UUID = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const CLAVE_EXPORTACION = new RegExp(`^${UUID}/${UUID}\\.(pdf|docx)$`);

@Injectable()
export class ExportacionesAlmacenService {
  constructor(private readonly config: ConfigService) {}

  private ruta(clave: string): string {
    const raiz = this.config.getOrThrow<string>('EXPORTACIONES_DIR');
    if (!isAbsolute(raiz) || !CLAVE_EXPORTACION.test(clave)) {
      throw new Error('Ruta de almacenamiento de exportación inválida');
    }
    return join(raiz, clave);
  }

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    const destino = this.ruta(clave);
    const temporal = `${destino}.${randomUUID()}.tmp`;

    await mkdir(dirname(destino), { recursive: true, mode: 0o700 });

    try {
      await writeFile(temporal, contenido, { flag: 'wx', mode: 0o600 });
      await rename(temporal, destino);
    } catch (error) {
      await rm(temporal, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  leer(clave: string): Promise<Buffer> {
    return readFile(this.ruta(clave));
  }
}
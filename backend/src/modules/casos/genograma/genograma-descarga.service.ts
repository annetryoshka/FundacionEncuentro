import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Usuario } from '../../../common/types/usuario.js';
import { GenogramaAccesoService } from './genograma-acceso.service.js';

export const GENOGRAMA_ARCHIVOS = Symbol('GENOGRAMA_ARCHIVOS');

export interface GenogramaMetadatos {
  nombre: string;
  tipo: string;
  tamanio: number;
  autorId: string;
  actualizadoEn: string;
}

export interface GenogramaArchivos {
  buscarVigente(
    casoId: string,
  ): Promise<(GenogramaMetadatos & { clave: string }) | null>;

  leer(clave: string): Promise<Buffer>;
}

@Injectable()
export class GenogramaDescargaService {
  constructor(
    private readonly acceso: GenogramaAccesoService,
    @Inject(GENOGRAMA_ARCHIVOS)
    private readonly archivos: GenogramaArchivos,
  ) {}

  async consultar(casoId: string, usuario: Usuario): Promise<GenogramaMetadatos> {
  const genograma = await this.obtenerVigente(casoId, usuario);

  return {
    nombre: genograma.nombre,
    tipo: genograma.tipo,
    tamanio: genograma.tamanio,
    autorId: genograma.autorId,
    actualizadoEn: genograma.actualizadoEn,
  };
}

async descargar(casoId: string, usuario: Usuario) {
  const genograma = await this.obtenerVigente(casoId, usuario);
  const contenido = await this.archivos.leer(genograma.clave);

  return {
    nombre: genograma.nombre,
    tipo: genograma.tipo,
    contenido,
  };
}

private async obtenerVigente(casoId: string, usuario: Usuario) {
  await this.acceso.verificar(casoId, usuario);

  const genograma = await this.archivos.buscarVigente(casoId);
  if (!genograma) {
    throw new NotFoundException('Genograma no encontrado');
  }

  return genograma;
}
}
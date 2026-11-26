import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Usuario } from '../../../common/types/usuario.js';
import { GenogramaAccesoService } from './genograma-acceso.service.js';
import { validarArchivoGenograma } from './genograma-validacion.js';

export const GENOGRAMA_ESCRITURA = Symbol('GENOGRAMA_ESCRITURA');

type ArchivoGenograma = {
  nombre: string;
  tipo: string;
  contenido: Buffer;
};

type VersionGenograma = {
  clave: string;
  nombre: string;
  tipo: string;
  tamanio: number;
};

export interface GenogramaEscritura {
  guardarNuevo(clave: string, contenido: Buffer, tipo: string): Promise<void>;

  // El adaptador comprueba el permiso y cambia la referencia en una transacción.
  activarVersion(
    casoId: string,
    usuario: Usuario,
    version: VersionGenograma,
  ): Promise<void>;
}

@Injectable()
export class GenogramaReemplazoService {
  constructor(
    private readonly acceso: GenogramaAccesoService,
    @Inject(GENOGRAMA_ESCRITURA)
    private readonly escritura: GenogramaEscritura,
  ) {}

  async reemplazar(
    casoId: string,
    usuario: Usuario,
    archivo: ArchivoGenograma | undefined,
    maxBytes: number,
  ): Promise<void> {
    await this.acceso.verificar(casoId, usuario);

    const contenido = archivo?.contenido;
    const nombre = archivo?.nombre ?? 'genograma';
    const { tipo, tamanio } = validarArchivoGenograma(
      contenido,
      archivo?.tipo ?? '',
      maxBytes,
    );

    const clave = `${casoId}/${randomUUID()}`;
    await this.escritura.guardarNuevo(clave, contenido!, tipo);
    await this.escritura.activarVersion(casoId, usuario, {
      clave,
      nombre,
      tipo,
      tamanio,
    });
  }
}
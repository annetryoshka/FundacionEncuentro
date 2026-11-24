import { Inject, Injectable } from '@nestjs/common';
import type { Usuario } from '../../common/types/usuario.js';
import { CasosService } from '../casos/casos.service.js';
import {
  prepararBorrador,
  type EntradaBorrador,
} from './informe-borrador.js';

type AccesoCasos = Pick<CasosService, 'obtenerCarpetaAutorizada'>;
type CarpetaAutorizada = Awaited<
  ReturnType<AccesoCasos['obtenerCarpetaAutorizada']>
>;

@Injectable()
export class InformesService {
  constructor(@Inject(CasosService) private readonly casos: AccesoCasos) {}

  async preparar<TOrigen>(
    casoId: string,
    usuario: Usuario,
    seleccionar: (carpeta: CarpetaAutorizada) => EntradaBorrador<TOrigen>,
  ) {
    const carpeta = await this.casos.obtenerCarpetaAutorizada(casoId, usuario);
    const borrador = prepararBorrador(seleccionar(carpeta));

    return { ...borrador, casoId, generadoPor: usuario.id };
  }
}
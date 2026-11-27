import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { Usuario } from '../../common/types/usuario.js';
import { DatabaseService } from '../../database/database.service.js';
import { CasosService } from '../casos/casos.service.js';
import { prepararBorrador, type EntradaBorrador } from './informe-borrador.js';
import {
  tomarFotografiaInforme,
  type SeleccionInforme,
  type FotografiaInforme,
} from './informe-fotografia.js';
import {
  guardarPrimerBorradorInforme,
  guardarRevisionInforme,
  consultarVersionInforme,
  listarVersionesInforme,
} from './informe-persistencia.js';

type AccesoCasos = Pick<CasosService, 'obtenerCarpetaAutorizada'>;
type CarpetaAutorizada = Awaited<
  ReturnType<AccesoCasos['obtenerCarpetaAutorizada']>
>;
type DatosOrigen = FotografiaInforme;
type PlantillaInforme = Omit<EntradaBorrador<DatosOrigen>, 'origen'>;

@Injectable()
export class InformesService {
  constructor(
    @Inject(CasosService) private readonly casos: AccesoCasos,
    @Inject(DatabaseService)
    private readonly db: Pick<DatabaseService, 'transaction'>,
  ) {}

  async preparar<TOrigen>(
    casoId: string,
    usuario: Usuario,
    seleccionar: (
      carpeta: CarpetaAutorizada,
    ) => EntradaBorrador<TOrigen> | Promise<EntradaBorrador<TOrigen>>,
    client?: PoolClient,
  ) {
    const carpeta = client
      ? await this.casos.obtenerCarpetaAutorizada(casoId, usuario, client)
      : await this.casos.obtenerCarpetaAutorizada(casoId, usuario);

    const borrador = prepararBorrador(await seleccionar(carpeta));

    return { ...borrador, casoId, generadoPor: usuario.id };
  }

    async revisar(
    casoId: string,
    versionId: string,
    usuario: Usuario,
    secciones: readonly { titulo: string; contenido: string }[],
  ) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.casos.obtenerCarpetaAutorizada(casoId, usuario, client);
      return guardarRevisionInforme(client, casoId, versionId, secciones);
    });
  }

  async generar(
    casoId: string,
    usuario: Usuario,
    seleccion: SeleccionInforme,
    definirPlantilla: (origen: Readonly<DatosOrigen>) => PlantillaInforme,
  ) {
    return this.db.transaction(usuario.id, async (client) => {
      const borrador = await this.preparar(
        casoId,
        usuario,
        async () => {
          const origen = await tomarFotografiaInforme(client, casoId, seleccion);
          return { ...definirPlantilla(origen), origen };
        },
        client,
      );

      return guardarPrimerBorradorInforme(client, borrador);
    });
  }

  async listar(casoId: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.casos.obtenerCarpetaAutorizada(casoId, usuario, client);
      return { informes: await listarVersionesInforme(client, casoId) };
    });
  }

  async consultar(casoId: string, versionId: string, usuario: Usuario) {
    return this.db.transaction(usuario.id, async (client) => {
      await this.casos.obtenerCarpetaAutorizada(casoId, usuario, client);
      return consultarVersionInforme(client, casoId, versionId);
    });
  }
}
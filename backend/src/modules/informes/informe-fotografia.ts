import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

export type SeleccionInforme = {
  sesionesIds: readonly string[];
  incluirFamilia: boolean;
  incluirGenograma: boolean;
};

export type FotografiaInforme = Record<string, unknown> & {
  paciente: { nombreCompleto: string };
  responsable: { nombreCompleto: string } | null;
  diagnostico: {
    diagnosticoIngreso: string | null;
    hipotesisRelacional: string | null;
  };
  sesiones: {
    nroSesion: number;
    fecha: string;
    evolucion: string | null;
  }[];
    judicial: {
    juzgado: string | null;
    nroExpediente: string | null;
  } | null;
};

export async function tomarFotografiaInforme(
  client: PoolClient,
  casoId: string,
  seleccion: SeleccionInforme,
): Promise<FotografiaInforme> {
  try {
    const { rows } = await client.query<{ datos: FotografiaInforme }>(
      `select public.fotografia_informe(
        $1::uuid, $2::uuid[], $3::boolean, $4::boolean
      ) as datos`,
      [
        casoId,
        seleccion.sesionesIds,
        seleccion.incluirFamilia,
        seleccion.incluirGenograma,
      ],
    );

    return rows[0].datos;
  } catch (error) {
    const codigo = error instanceof Error && 'code' in error
      ? error.code
      : undefined;

    if (codigo === 'P0002') {
      throw new NotFoundException('Caso no encontrado');
    }

    if (codigo === '23514') {
      throw new BadRequestException(
        'Una o más sesiones seleccionadas no pertenecen al caso.',
      );
    }

    if (codigo === '0A000') {
      throw new ServiceUnavailableException(
        'El genograma todavía no está disponible para generar informes.',
      );
    }

    throw error;
  }
}
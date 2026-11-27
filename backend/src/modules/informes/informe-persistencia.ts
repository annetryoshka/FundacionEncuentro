import type { PoolClient } from 'pg';
import type { EntradaBorrador } from './informe-borrador.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

type BorradorParaGuardar = {
  casoId: string;
  tipo: EntradaBorrador<Record<string, unknown>>['tipo'];
  versionPlantilla: string;
  origen: Record<string, unknown>;
  secciones: readonly { titulo: string; contenido: string }[];
};

type VersionGuardada = {
  id: string;
  informeId: string;
  nroVersion: number;
  estado: 'borrador';
  creadoPor: string;
};

// Usar el mismo cliente de DatabaseService.transaction para ambas escrituras.
export async function guardarPrimerBorradorInforme(
  client: PoolClient,
  borrador: BorradorParaGuardar,
): Promise<VersionGuardada> {
  const { rows: informes } = await client.query<{ id: string }>(
    `insert into public.informes (caso_id, tipo)
     values ($1, $2)
     returning id`,
    [borrador.casoId, borrador.tipo],
  );

  const { rows: versiones } = await client.query<VersionGuardada>(
    `insert into public.informe_versiones
       (informe_id, caso_id, version_plantilla, datos_origen, secciones)
     values ($1, $2, $3, $4::jsonb, $5::jsonb)
     returning id,
               informe_id as "informeId",
               nro_version as "nroVersion",
               estado,
               creado_por as "creadoPor"`,
    [
      informes[0].id,
      borrador.casoId,
      borrador.versionPlantilla,
      JSON.stringify(borrador.origen),
      JSON.stringify(borrador.secciones),
    ],
  );

  return versiones[0];
}

export async function guardarRevisionInforme(
  client: PoolClient,
  casoId: string,
  versionId: string,
  secciones: readonly { titulo: string; contenido: string }[],
) {
  const { rows } = await client.query<{
    id: string;
    estado: 'revisado';
    revisadoPor: string;
    revisadoEn: Date;
  }>(
    `update public.informe_versiones
        set secciones = $3::jsonb, estado = 'revisado'
      where id = $1 and caso_id = $2 and estado = 'borrador'
      returning id, estado,
                revisado_por as "revisadoPor",
                revisado_en as "revisadoEn"`,
    [versionId, casoId, JSON.stringify(secciones)],
  );

  if (rows[0]) return rows[0];

  const existente = await client.query(
    'select id from public.informe_versiones where id = $1 and caso_id = $2',
    [versionId, casoId],
  );

  if (existente.rowCount === 0) {
    throw new NotFoundException('Versión de informe no encontrada');
  }

  throw new ConflictException('Esta versión del informe ya fue revisada');
}

// Cada generación es un informe propio (versión 1); el listado muestra todas las del caso, la más reciente primero.
export async function listarVersionesInforme(client: PoolClient, casoId: string) {
  const { rows } = await client.query(
    `select v.id,
            v.informe_id as "informeId",
            i.tipo,
            v.nro_version as "nroVersion",
            v.estado,
            v.creado_por as "creadoPor",
            v.creado_en as "creadoEn",
            v.revisado_por as "revisadoPor",
            v.revisado_en as "revisadoEn"
       from public.informe_versiones v
       join public.informes i
         on i.id = v.informe_id and i.caso_id = v.caso_id
      where v.caso_id = $1
      order by v.creado_en desc, v.nro_version desc`,
    [casoId],
  );
  return rows;
}

export async function consultarVersionInforme(
  client: PoolClient,
  casoId: string,
  versionId: string,
) {
  const { rows } = await client.query(
    `select v.id,
            v.informe_id as "informeId",
            i.tipo,
            v.nro_version as "nroVersion",
            v.version_plantilla as "versionPlantilla",
            v.estado,
            v.secciones,
            v.creado_por as "creadoPor",
            v.creado_en as "creadoEn",
            v.revisado_por as "revisadoPor",
            v.revisado_en as "revisadoEn"
       from public.informe_versiones v
       join public.informes i
         on i.id = v.informe_id and i.caso_id = v.caso_id
      where v.id = $1 and v.caso_id = $2`,
    [versionId, casoId],
  );

  if (!rows[0]) {
    throw new NotFoundException('Versión de informe no encontrada');
  }

  return rows[0];
}
import { NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { FamiliarEntradaDto } from './dto/guardar-familia.dto.js';

const CAMPOS = {
  parentesco: 'parentesco',
  parentescoDetalle: 'parentesco_detalle',
  nombreCompleto: 'nombre_completo',
  fechaNacimiento: 'fecha_nacimiento',
  edadReferida: 'edad_referida',
  fechaReferencia: 'fecha_referencia',
  ocupacion: 'ocupacion',
  lugarTrabajoEstudio: 'lugar_trabajo_estudio',
  conviveConPaciente: 'convive_con_paciente',
  observaciones: 'observaciones',
} as const;

export async function guardarIntegrante(
  client: PoolClient,
  casoId: string,
  familiar: FamiliarEntradaDto,
): Promise<void> {
  const columnas: string[] = [];
  const valores: unknown[] = [];

  for (const campo of Object.keys(CAMPOS) as (keyof typeof CAMPOS)[]) {
    const valor = familiar[campo];
    if (valor === undefined) continue;

    columnas.push(CAMPOS[campo]);
    valores.push(typeof valor === 'string' ? valor.trim() || null : valor);
  }

  if (!familiar.id) {
    const parametros = columnas.map((_, i) => `$${i + 2}`);

    await client.query(
      `insert into public.familiares (caso_id, ${columnas.join(', ')})
       values ($1, ${parametros.join(', ')})`,
      [casoId, ...valores],
    );
    return;
  }

  const cambios = columnas.map((columna, i) => `${columna} = $${i + 3}`);

  const resultado = await client.query(
    `update public.familiares
        set ${cambios.join(', ')}
      where caso_id = $1 and id = $2 and deleted_at is null`,
    [casoId, familiar.id, ...valores],
  );

  if (resultado.rowCount === 0) {
    throw new NotFoundException('Familiar no encontrado en el caso');
  }
}
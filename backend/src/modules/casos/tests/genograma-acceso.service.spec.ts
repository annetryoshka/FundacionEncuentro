import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../../common/types/usuario.js';
import type { DatabaseService } from '../../../database/database.service.js';
import { GenogramaAccesoService } from '../genograma/genograma-acceso.service.js';
import { GenogramaDescargaService } from '../genograma/genograma-descarga.service.js';

describe('GenogramaAccesoService', () => {
  const casoId = '00000000-0000-4000-8000-000000000001';
  const terapeuta = {
    id: '00000000-0000-4000-8000-000000000002',
    rol: 'terapeuta',
  } as Usuario;

  function preparar(rows: Array<{ id: string }>) {
    const query = vi.fn().mockResolvedValue({ rows });
    const servicio = new GenogramaAccesoService({
      query,
    } as unknown as DatabaseService);

    return { servicio, query };
  }

  it('permite continuar cuando la consulta encuentra un caso accesible', async () => {
    const { servicio, query } = preparar([{ id: casoId }]);

    await expect(servicio.verificar(casoId, terapeuta)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      casoId,
      terapeuta.rol,
      terapeuta.id,
    ]);
  });

  it('devuelve 404 cuando la consulta no encuentra un caso accesible', async () => {
    const { servicio } = preparar([]);

    await expect(servicio.verificar(casoId, terapeuta)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UsuariosService } from './usuarios.service.js';
import type { DatabaseService } from '../../database/database.service.js';
import type { SupabaseAdminClient } from './supabase-admin.client.js';

describe('FE-29 - Listado y filtros de usuarios', () => {
  const crearServicio = () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'usuario-1',
          email: 'ana@test.com',
          nombre_completo: 'Ana Pérez',
          rol: 'terapeuta',
          activo: true,
          creado_en: new Date('2026-10-22'),
        },
      ],
    });

    const db = { query } as unknown as DatabaseService;
    const admin = {} as SupabaseAdminClient;

    return {
      servicio: new UsuariosService(db, admin),
      query,
    };
  };

  it('lista usuarios sin filtros', async () => {
    const { servicio, query } = crearServicio();

    const resultado = await servicio.listar();

    expect(resultado).toHaveLength(1);
    expect(resultado[0].nombreCompleto).toBe('Ana Pérez');

    const [sql, parametros] = query.mock.calls[0];

    expect(sql).not.toContain(' where ');
    expect(parametros).toEqual([]);
  });

  it('filtra por rol terapeuta', async () => {
    const { servicio, query } = crearServicio();

    await servicio.listar({ rol: 'terapeuta' });

    const [sql, parametros] = query.mock.calls[0];

    expect(sql).toContain('p.rol = $1');
    expect(parametros).toEqual(['terapeuta']);
  });

  it('filtra usuarios activos', async () => {
    const { servicio, query } = crearServicio();

    await servicio.listar({ activo: true });

    const [sql, parametros] = query.mock.calls[0];

    expect(sql).toContain('p.activo = $1');
    expect(parametros).toEqual([true]);
  });

  it('combina los filtros de rol y activo', async () => {
    const { servicio, query } = crearServicio();

    await servicio.listar({
      rol: 'terapeuta',
      activo: true,
    });

    const [sql, parametros] = query.mock.calls[0];

    expect(sql).toContain('p.rol = $1');
    expect(sql).toContain('p.activo = $2');
    expect(parametros).toEqual(['terapeuta', true]);
  });

  it('ordena los usuarios alfabéticamente', async () => {
    const { servicio, query } = crearServicio();

    await servicio.listar();

    const [sql] = query.mock.calls[0];

    expect(sql).toContain('order by p.nombre_completo asc');
  });
});


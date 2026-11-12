import { SesionesService } from '../sesiones.service.js';
import { RegistrarSesionDto } from '../dto/registrar-sesion.dto.js';
import type { DatabaseService } from '../../../database/database.service.js';
import type { Usuario } from '../../../common/types/usuario.js';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';

const casoId = '10000000-0000-4000-8000-000000000013';
const sesionId = '30000000-0000-4000-8000-000000000001';
const responsableId = 'c98a4a84-0bfc-47af-9f91-f207e4c971ed';

const terapeuta: Usuario = {
  id: responsableId,
  nombreCompleto: 'Terapeuta QA',
  rol: 'terapeuta',
};

const admin: Usuario = {
  id: 'a7d176ae-e95a-4f4d-8506-f33201d57016',
  nombreCompleto: 'Administración QA',
  rol: 'administrador',
};

const datos = (): RegistrarSesionDto => ({
  fecha: '2026-11-12',
  evolucion: 'Evolución ficticia para QA.',
});

const fila = () => ({
  id: sesionId,
  caso_id: casoId,
  nro_sesion: 1,
  fecha: '2026-11-12',
  evolucion: 'Evolución ficticia para QA.',
  responsable_id: responsableId,
  responsable_nombre: 'Terapeuta QA',
  creado_por: terapeuta.id,
  creado_en: new Date('2026-11-12T12:00:00Z'),
  actualizado_por: terapeuta.id,
  actualizado_en: new Date('2026-11-12T12:00:00Z'),
});

describe('FE-73: servicio de sesiones', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: SesionesService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(
      async (_actor, ejecutar) => ejecutar({ query }),
    );
    servicio = new SesionesService({
      transaction,
    } as unknown as DatabaseService);
  });

  function permitirAcceso() {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [{ permitido: 1 }] });
  }

  const operaciones = {
    listar: () => servicio.listar(casoId, terapeuta),
    obtener: () => servicio.obtener(casoId, sesionId, terapeuta),
    registrar: () => servicio.registrar(casoId, datos(), terapeuta),
  };

  for (const [nombre, ejecutar] of Object.entries(operaciones)) {
    it(`${nombre}: rechaza caso inexistente antes de operar`, async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(1);
    });

    it(`${nombre}: rechaza acceso ajeno antes de operar`, async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: casoId }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(2);
    });
  }

  it('devuelve una lista vacía si no hay sesiones', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.listar(casoId, terapeuta))
      .resolves.toEqual({ sesiones: [] });
  });

  it('el listado devuelve resumen sin evolución clínica', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.listar(casoId, terapeuta);

    expect(resultado.sesiones).toHaveLength(1);
    expect(resultado.sesiones[0]).toMatchObject({
      id: sesionId,
      casoId,
      numero: 1,
      responsable: { id: responsableId },
    });
    expect(resultado.sesiones[0]).not.toHaveProperty('evolucion');
  });

  it('el detalle devuelve la evolución de la sesión', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.obtener(
      casoId, sesionId, terapeuta,
    );

    expect(resultado.sesion).toMatchObject({
      id: sesionId,
      casoId,
      evolucion: datos().evolucion,
      responsable: { id: responsableId },
    });
  });

  it('rechaza una sesión inexistente o de otro caso', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      servicio.obtener(casoId, sesionId, terapeuta),
    ).rejects.toThrow('Sesión no encontrada');

    // La consulta debe exigir ambos identificadores.
    const [sql, parametros] = query.mock.calls[2];
    expect(sql).toMatch(/s\.id = \$1 and s\.caso_id = \$2/);
    expect(parametros).toEqual([sesionId, casoId]);
  });

  it('registra texto normalizado y devuelve el identificador estable', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.registrar(casoId, {
      fecha: '2026-11-12',
      evolucion: '  Evolución ficticia para QA.  ',
    }, terapeuta);

    expect(resultado.sesion.id).toBe(sesionId);
    expect(query.mock.calls[3][1]).toEqual([
      casoId,
      '2026-11-12',
      'Evolución ficticia para QA.',
      responsableId,
      terapeuta.id,
    ]);
    expect(transaction.mock.calls[0][0]).toBe(terapeuta.id);
  });

  it('distingue al administrador autor de la terapeuta responsable', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({
        rows: [{
          ...fila(),
          creado_por: admin.id,
          actualizado_por: admin.id,
        }],
      });

    const resultado = await servicio.registrar(
      casoId, datos(), admin,
    );

    expect(resultado.sesion.creadoPor).toBe(admin.id);
    expect(resultado.sesion.responsable.id).toBe(responsableId);
    expect(query.mock.calls[3][1]).toEqual([
      casoId,
      datos().fecha,
      datos().evolucion,
      responsableId,
      admin.id,
    ]);
    expect(transaction.mock.calls[0][0]).toBe(admin.id);
  });

  it('no inserta cuando no hay responsable activa', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      servicio.registrar(casoId, datos(), admin),
    ).rejects.toThrow('terapeuta activa asignada');

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('rechaza múltiples responsables antes de insertar', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({
      rows: [{ id: responsableId }, { id: admin.id }],
    });

    await expect(
      servicio.registrar(casoId, datos(), admin),
    ).rejects.toThrow('terapeuta activa asignada');

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('propaga un fallo de inserción sin devolver éxito', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockRejectedValueOnce(new Error('Fallo INSERT simulado'));

    await expect(
      servicio.registrar(casoId, datos(), terapeuta),
    ).rejects.toThrow('Fallo INSERT simulado');
  });

  it('propaga el fallo de lectura posterior dentro de la transacción', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockRejectedValueOnce(new Error('Fallo SELECT simulado'));

    await expect(
      servicio.registrar(casoId, datos(), terapeuta),
    ).rejects.toThrow('Fallo SELECT simulado');
  });

  it('rechaza si no recupera la sesión recién creada', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      servicio.registrar(casoId, datos(), terapeuta),
    ).rejects.toThrow('No se pudo recuperar la sesión creada');
  });

  it('admite el número 17 devuelto por la base', async () => {
    permitirAcceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: responsableId }] })
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({
        rows: [{ ...fila(), nro_sesion: 17 }],
      });

    const resultado = await servicio.registrar(
      casoId, datos(), terapeuta,
    );

    expect(resultado.sesion.numero).toBe(17);
  });

  it('no convierte un fallo de carga en lista vacía', async () => {
    permitirAcceso();
    query.mockRejectedValueOnce(new Error('Base no disponible'));

    await expect(servicio.listar(casoId, terapeuta))
      .rejects.toThrow('Base no disponible');
  });
});

describe('FE-73: validación de sesión', () => {
  async function errores(cambios: Record<string, unknown>) {
    const dto = Object.assign(
      new RegistrarSesionDto(), datos(), cambios,
    );
    return validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('acepta fecha y evolución válidas', async () => {
    expect(await errores({})).toHaveLength(0);
  });

  for (const evolucion of [undefined, null, '', '   ', 123]) {
    it(`rechaza evolución inválida: ${String(evolucion)}`, async () => {
      expect((await errores({ evolucion })).length).toBeGreaterThan(0);
    });
  }

  for (const fecha of [
    undefined, null, '2026-02-30', '12/11/2026',
    '2026-11-12T10:00:00Z',
  ]) {
    it(`rechaza fecha inválida: ${String(fecha)}`, async () => {
      expect((await errores({ fecha })).length).toBeGreaterThan(0);
    });
  }

  it('rechaza evolución de más de 10000 caracteres', async () => {
    expect((await errores({
      evolucion: 'a'.repeat(10001),
    })).length).toBeGreaterThan(0);
  });

  for (const campo of [
    'casoId', 'responsableId', 'creadoPor', 'numero',
  ]) {
    it(`rechaza el campo manipulable ${campo}`, async () => {
      const resultado = await errores({ [campo]: 'valor-inyectado' });
      expect(resultado.some((error) => error.property === campo)).toBe(true);
    });
  }
});
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { TareasService } from '../tareas.service.js';
import { CrearTareaDto } from '../dto/crear-tarea.dto.js';
import { ActualizarCumplimientoDto } from '../dto/actualizar-cumplimiento.dto.js';
import type { DatabaseService } from '../../../database/database.service.js';
import type { Usuario } from '../../../common/types/usuario.js';

const casoId = '10000000-0000-4000-8000-000000000013';
const sesionId = 'ae29f859-bab1-42c9-83ce-7194c12a46d6';
const tareaId = 'e27eddb9-06e2-45ec-b402-d83aaaeb7068';

const usuario: Usuario = {
  id: 'c98a4a84-0bfc-47af-9f91-f207e4c971ed',
  nombreCompleto: 'Terapeuta QA',
  rol: 'terapeuta',
};

const datos = () => ({
  sesionId,
  descripcion: 'Actividad ficticia.',
});

const fila = () => ({
  id: tareaId,
  caso_id: casoId,
  sesion_id: sesionId,
  nro_sesion: 1,
  descripcion: 'Actividad ficticia.',
  completada: false,
  fecha_asignada: '2026-11-12',
  perfil_id: usuario.id,
  creado_en: new Date('2026-11-12T12:00:00Z'),
  cumplimiento_actualizado_por: null,
  cumplimiento_actualizado_en: null,
});

describe('FE-78: servicio de tareas', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: TareasService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(
      async (_actor, ejecutar) => ejecutar({ query }),
    );
    servicio = new TareasService({
      transaction,
    } as unknown as DatabaseService);
  });

  function acceso() {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [{ permitido: 1 }] });
  }

  const operaciones = {
    crear: () => servicio.crear(casoId, datos(), usuario),
    listar: () => servicio.listar(casoId, usuario),
    actualizar: () => servicio.actualizarCumplimiento(
      casoId, tareaId, { estado: 'realizada' }, usuario,
    ),
  };

  for (const [nombre, ejecutar] of Object.entries(operaciones)) {
    it(`${nombre}: rechaza caso inexistente`, async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(1);
    });

    it(`${nombre}: rechaza caso ajeno antes de operar`, async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: casoId }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(2);
    });
  }

  it('rechaza una sesión inexistente o de otro caso sin insertar', async () => {
    acceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.crear(casoId, datos(), usuario))
      .rejects.toThrow('La sesión no existe o no pertenece al caso');

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][1]).toEqual([sesionId, casoId]);
  });

  it('crea pendiente con descripción normalizada y autor autenticado', async () => {
    acceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({ rows: [{ id: tareaId }] })
      .mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.crear(casoId, {
      sesionId,
      descripcion: '  Actividad ficticia.  ',
    }, usuario);

    expect(resultado.tarea).toMatchObject({
      id: tareaId,
      casoId,
      sesionId,
      estado: 'pendiente',
      creadoPor: usuario.id,
    });
    expect(query.mock.calls[3][1]).toEqual([
      casoId, sesionId, 'Actividad ficticia.', usuario.id,
    ]);
    expect(transaction.mock.calls[0][0]).toBe(usuario.id);
  });

  it('devuelve lista vacía cuando no hay tareas', async () => {
    acceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.listar(casoId, usuario))
      .resolves.toEqual({ tareas: [] });
  });

  it('devuelve sesión, estado y trazabilidad en el listado', async () => {
    acceso();
    query.mockResolvedValueOnce({ rows: [fila()] });

    const resultado = await servicio.listar(casoId, usuario);

    expect(resultado.tareas[0]).toMatchObject({
      id: tareaId,
      sesionId,
      numeroSesion: 1,
      estado: 'pendiente',
      creadoPor: usuario.id,
      cumplimientoActualizadoPor: null,
    });
  });

  it('rechaza modificar una tarea que no pertenece al caso', async () => {
    acceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.actualizarCumplimiento(
      casoId, tareaId, { estado: 'realizada' }, usuario,
    )).rejects.toThrow('Tarea no encontrada');

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][1]).toEqual([tareaId, casoId]);
  });

  for (const [estado, completada] of [
    ['realizada', true],
    ['pendiente', false],
  ] as const) {
    it(`actualiza a ${estado} y devuelve la trazabilidad de la base`, async () => {
      acceso();
      const momento = new Date('2026-11-12T13:00:00Z');
      query
        .mockResolvedValueOnce({ rows: [{ id: tareaId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            ...fila(),
            completada,
            cumplimiento_actualizado_por: usuario.id,
            cumplimiento_actualizado_en: momento,
          }],
        });

      const resultado = await servicio.actualizarCumplimiento(
        casoId, tareaId, { estado }, usuario,
      );

      expect(query.mock.calls[3][1]).toEqual([
        completada, tareaId, casoId,
      ]);
      expect(resultado.tarea).toMatchObject({
        id: tareaId,
        estado,
        creadoPor: usuario.id,
        creadoEn: fila().creado_en,
        cumplimientoActualizadoPor: usuario.id,
        cumplimientoActualizadoEn: momento,
      });
    });
  }

  it('propaga el error al insertar sin devolver éxito', async () => {
    acceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockRejectedValueOnce(new Error('Fallo INSERT'));

    await expect(servicio.crear(casoId, datos(), usuario))
      .rejects.toThrow('Fallo INSERT');
  });

  it('propaga un fallo de lectura posterior al alta', async () => {
    acceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: sesionId }] })
      .mockResolvedValueOnce({ rows: [{ id: tareaId }] })
      .mockRejectedValueOnce(new Error('Fallo SELECT'));

    await expect(servicio.crear(casoId, datos(), usuario))
      .rejects.toThrow('Fallo SELECT');
  });

  it('propaga un fallo al actualizar cumplimiento', async () => {
    acceso();
    query
      .mockResolvedValueOnce({ rows: [{ id: tareaId }] })
      .mockRejectedValueOnce(new Error('Fallo UPDATE'));

    await expect(servicio.actualizarCumplimiento(
      casoId, tareaId, { estado: 'realizada' }, usuario,
    )).rejects.toThrow('Fallo UPDATE');
  });

  it('no presenta un error de carga como lista vacía', async () => {
    acceso();
    query.mockRejectedValueOnce(new Error('Base no disponible'));

    await expect(servicio.listar(casoId, usuario))
      .rejects.toThrow('Base no disponible');
  });
});

describe('FE-78: validación de DTO', () => {
  async function validarCreacion(cambios: Record<string, unknown>) {
    return validate(
      Object.assign(new CrearTareaDto(), datos(), cambios),
      { whitelist: true, forbidNonWhitelisted: true },
    );
  }

  it('acepta una tarea válida', async () => {
    expect(await validarCreacion({})).toHaveLength(0);
  });

  for (const descripcion of [undefined, null, '', '   ', 123]) {
    it(`rechaza descripción inválida: ${String(descripcion)}`, async () => {
      expect((await validarCreacion({ descripcion })).length)
        .toBeGreaterThan(0);
    });
  }

  it('rechaza descripción demasiado larga', async () => {
    expect((await validarCreacion({
      descripcion: 'a'.repeat(10001),
    })).length).toBeGreaterThan(0);
  });

  for (const valor of [undefined, null, 'no-es-uuid']) {
    it(`rechaza sesión inválida: ${String(valor)}`, async () => {
      expect((await validarCreacion({ sesionId: valor })).length)
        .toBeGreaterThan(0);
    });
  }

  for (const campo of ['casoId', 'creadoPor', 'estado', 'completada']) {
    it(`rechaza ${campo} enviado al crear`, async () => {
      const errores = await validarCreacion({ [campo]: 'inyectado' });
      expect(errores.some((error) => error.property === campo)).toBe(true);
    });
  }

  for (const estado of ['pendiente', 'realizada']) {
    it(`acepta cumplimiento ${estado}`, async () => {
      const dto = Object.assign(new ActualizarCumplimientoDto(), { estado });
      expect(await validate(dto)).toHaveLength(0);
    });
  }

  for (const estado of [undefined, null, 'inventado', true]) {
    it(`rechaza cumplimiento inválido: ${String(estado)}`, async () => {
      const dto = Object.assign(new ActualizarCumplimientoDto(), { estado });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    });
  }

  it('rechaza cambiar sesión mediante el DTO de cumplimiento', async () => {
    const dto = Object.assign(new ActualizarCumplimientoDto(), {
      estado: 'realizada',
      sesionId,
    });
    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errores.some((error) => error.property === 'sesionId')).toBe(true);
  });
});
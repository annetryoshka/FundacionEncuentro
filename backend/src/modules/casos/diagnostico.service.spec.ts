import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { DiagnosticoService } from './diagnostico.service.js';
import { GuardarDiagnosticoDto } from './dto/guardar-diagnostico.dto.js';
import type { DatabaseService } from '../../database/database.service.js';
import type { Usuario } from '../../common/types/usuario.js';

const terapeuta: Usuario = {
  id: 'c98a4a84-0bfc-47af-9f91-f207e4c971ed',
  nombreCompleto: 'Terapeuta QA',
  rol: 'terapeuta',
};

const casoId = '10000000-0000-4000-8000-000000000013';

const datos = (): GuardarDiagnosticoDto => ({
  fecha: '2026-11-11',
  diagnosticoIngreso: 'Evaluación ficticia de QA.',
  hipotesisRelacional: null,
  comentariosClinicos: null,
});

const ficha = () => ({
  id: '25fffbf4-5c9c-43e5-a2cc-05ea787f2f3a',
  caso_id: casoId,
  fecha: '2026-11-11',
  contenido: {
    diagnosticoIngreso: 'Evaluación ficticia de QA.',
    hipotesisRelacional: null,
    comentariosClinicos: null,
  },
  creado_por: terapeuta.id,
  creado_en: new Date('2026-11-11T12:00:00Z'),
  actualizado_por: terapeuta.id,
  actualizado_en: new Date('2026-11-11T13:00:00Z'),
});

describe('FE-68: servicio de diagnóstico', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: DiagnosticoService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(
      async (_actor, ejecutar) => ejecutar({ query }),
    );
    servicio = new DiagnosticoService({
      transaction,
    } as unknown as DatabaseService);
  });

  function permitirAcceso() {
    query
      .mockResolvedValueOnce({ rows: [{ id: casoId }] })
      .mockResolvedValueOnce({ rows: [{ permitido: 1 }] });
  }

  it('devuelve null cuando el caso autorizado no tiene ficha', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(servicio.obtener(casoId, terapeuta))
      .resolves.toEqual({ diagnostico: null });

    expect(transaction.mock.calls[0][0]).toBe(terapeuta.id);
  });

  it('consulta la ficha autorizada y transforma sus campos', async () => {
    permitirAcceso();
    const registro = ficha();
    query.mockResolvedValueOnce({ rows: [registro] });

    const resultado = await servicio.obtener(casoId, terapeuta);

    expect(resultado.diagnostico).toMatchObject({
      id: registro.id,
      casoId,
      fecha: '2026-11-11',
      diagnosticoIngreso: registro.contenido.diagnosticoIngreso,
      creadoPor: terapeuta.id,
      actualizadoPor: terapeuta.id,
    });
  });

  for (const operacion of ['obtener', 'guardar'] as const) {
    it(`${operacion}: caso inexistente no consulta ni guarda ficha`, async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const ejecutar = () => operacion === 'obtener'
        ? servicio.obtener(casoId, terapeuta)
        : servicio.guardar(casoId, datos(), terapeuta);

      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(1);
    });

    it(`${operacion}: acceso denegado no consulta ni guarda ficha`, async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: casoId }] })
        .mockResolvedValueOnce({ rows: [] });

      const ejecutar = () => operacion === 'obtener'
        ? servicio.obtener(casoId, terapeuta)
        : servicio.guardar(casoId, datos(), terapeuta);

      await expect(ejecutar()).rejects.toThrow('Caso no encontrado');
      expect(query).toHaveBeenCalledTimes(2);
    });
  }

  it('guarda texto normalizado y asocia el actor de auditoría', async () => {
    permitirAcceso();
    query.mockResolvedValueOnce({ rows: [ficha()] });

    await servicio.guardar(casoId, {
      ...datos(),
      diagnosticoIngreso: '  Evaluación ficticia de QA.  ',
      hipotesisRelacional: '   ',
      comentariosClinicos: '  Comentario ficticio.  ',
    }, terapeuta);

    const parametros = query.mock.calls[2][1];

    expect(parametros[0]).toBe(casoId);
    expect(parametros[1]).toBe('2026-11-11');
    expect(JSON.parse(parametros[2])).toEqual({
      diagnosticoIngreso: 'Evaluación ficticia de QA.',
      hipotesisRelacional: null,
      comentariosClinicos: 'Comentario ficticio.',
    });
    expect(parametros[3]).toBe(terapeuta.id);
    expect(transaction.mock.calls[0][0]).toBe(terapeuta.id);
  });

  it('devuelve la identidad y creadora originales al editar como admin', async () => {
    const admin: Usuario = {
      id: 'a7d176ae-e95a-4f4d-8506-f33201d57016',
      nombreCompleto: 'Administración QA',
      rol: 'administrador',
    };
    permitirAcceso();
    const registro = {
      ...ficha(),
      actualizado_por: admin.id,
    };
    query.mockResolvedValueOnce({ rows: [registro] });

    const resultado = await servicio.guardar(casoId, datos(), admin);

    expect(resultado.diagnostico).toMatchObject({
      id: registro.id,
      creadoPor: terapeuta.id,
      creadoEn: registro.creado_en,
      actualizadoPor: admin.id,
    });
    expect(transaction.mock.calls[0][0]).toBe(admin.id);
  });

  it('propaga un fallo SQL sin devolver un guardado exitoso', async () => {
    permitirAcceso();
    query.mockRejectedValueOnce(new Error('Fallo SQL simulado'));

    await expect(servicio.guardar(casoId, datos(), terapeuta))
      .rejects.toThrow('Fallo SQL simulado');
  });
});

describe('FE-68: validación de diagnóstico', () => {
  async function errores(cambios: Record<string, unknown>) {
    const dto = Object.assign(
      new GuardarDiagnosticoDto(),
      datos(),
      cambios,
    );
    return validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('acepta datos válidos con campos opcionales nulos', async () => {
    expect(await errores({})).toHaveLength(0);
  });

  it('acepta omitir campos opcionales', async () => {
    expect(await errores({
      hipotesisRelacional: undefined,
      comentariosClinicos: undefined,
    })).toHaveLength(0);
  });

  for (const diagnosticoIngreso of [undefined, null, '', '   ', 123]) {
    it(`rechaza diagnóstico inválido: ${String(diagnosticoIngreso)}`, async () => {
      expect((await errores({ diagnosticoIngreso })).length)
        .toBeGreaterThan(0);
    });
  }

  for (const fecha of [undefined, null, '2026-02-30', '11/11/2026']) {
    it(`rechaza fecha inválida: ${String(fecha)}`, async () => {
      expect((await errores({ fecha })).length).toBeGreaterThan(0);
    });
  }

  it('rechaza campos fuera del contrato', async () => {
    const resultado = await errores({ casoId: 'caso-manipulado' });
    expect(resultado.some((error) => error.property === 'casoId')).toBe(true);
  });

  for (const campo of [
    'diagnosticoIngreso', 'hipotesisRelacional', 'comentariosClinicos',
  ]) {
    it(`rechaza ${campo} con más de 10000 caracteres`, async () => {
      expect((await errores({ [campo]: 'a'.repeat(10001) })).length)
        .toBeGreaterThan(0);
    });
  }
});
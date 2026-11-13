import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarConstanciaDto } from '../dto/actualizar-constancia.dto.js';

async function errores(contextoJudicial: unknown) {
  const dto = plainToInstance(ActualizarConstanciaDto, {
    origenJudicial: true,
    estado: 'pendiente',
    contextoJudicial,
  });

  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('FE-63: contexto judicial', () => {
  it('acepta juzgado con opcionales nulos', async () => {
    expect(await errores({
      juzgado: 'Juzgado ficticio',
      nroExpediente: null,
      fechaDerivacion: null,
      observaciones: null,
    })).toHaveLength(0);
  });

  it('acepta una fecha calendario válida', async () => {
    expect(await errores({
      juzgado: 'Juzgado ficticio',
      fechaDerivacion: '2026-10-05',
    })).toHaveLength(0);
  });

  for (const contexto of [undefined, null, 'texto', []]) {
    it(`rechaza contexto inválido: ${JSON.stringify(contexto)}`, async () => {
      expect((await errores(contexto)).length).toBeGreaterThan(0);
    });
  }

  for (const juzgado of [undefined, null, '', '   ', 'a'.repeat(201)]) {
    it(`rechaza juzgado inválido: ${String(juzgado).slice(0, 20)}`, async () => {
      expect((await errores({ juzgado })).length).toBeGreaterThan(0);
    });
  }

  for (const fecha of ['2026-02-30', '05/10/2026', '2026-10-05T00:00:00Z']) {
    it(`rechaza fecha de derivación: ${fecha}`, async () => {
      expect((await errores({
        juzgado: 'Juzgado ficticio',
        fechaDerivacion: fecha,
      })).length).toBeGreaterThan(0);
    });
  }

  it('rechaza expediente demasiado largo', async () => {
    expect((await errores({
      juzgado: 'Juzgado ficticio',
      nroExpediente: 'a'.repeat(101),
    })).length).toBeGreaterThan(0);
  });

  it('rechaza observaciones demasiado largas', async () => {
    expect((await errores({
      juzgado: 'Juzgado ficticio',
      observaciones: 'a'.repeat(1001),
    })).length).toBeGreaterThan(0);
  });

  it('rechaza campos adicionales dentro del contexto', async () => {
    expect((await errores({
      juzgado: 'Juzgado ficticio',
      casoId: 'caso-inyectado',
    })).length).toBeGreaterThan(0);
  });
});
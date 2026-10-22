
import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AsignarTerapeutaDto } from './asignar-terapeuta.dto.js';

describe('FE-37 - Validación del DTO de asignación', () => {
  async function validar(perfilId: string) {
    const dto = plainToInstance(AsignarTerapeutaDto, { perfilId });
    return validate(dto);
  }

  it('acepta un UUID válido', async () => {
    const errores = await validar('4ae401a2-068a-4506-bd4e-5402e903444c');

    expect(errores).toHaveLength(0);
  });

  it('rechaza un UUID inválido', async () => {
    const errores = await validar('terapeuta-invalido');

    expect(errores).toHaveLength(1);
    expect(errores[0].constraints?.isUuid).toBe(
      'perfilId no es un id válido',
    );
  });

  it('rechaza un perfilId vacío', async () => {
    const errores = await validar('');

    expect(errores).toHaveLength(1);
  });
});

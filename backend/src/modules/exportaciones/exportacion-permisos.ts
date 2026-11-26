import { ForbiddenException } from '@nestjs/common';
import type { Usuario } from '../../common/types/usuario.js';

export function verificarPermisoPagos(
  usuario: Pick<Usuario, 'rol'>,
  incluirPagos: boolean,
): void {
  if (incluirPagos && usuario.rol !== 'administrador') {
    throw new ForbiddenException(
      'Solo administración puede exportar datos de pagos.',
    );
  }
}
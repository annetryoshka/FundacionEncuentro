import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestConUsuario } from '../types/usuario.js';

/** Entrega el token de acceso de la petición actual: @TokenActual() token */
export const TokenActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<RequestConUsuario>().token,
);

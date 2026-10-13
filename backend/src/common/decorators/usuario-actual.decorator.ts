import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestConUsuario, Usuario } from '../types/usuario.js';

/** Entrega el usuario autenticado dentro de un controlador: @UsuarioActual() usuario */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Usuario | undefined =>
    ctx.switchToHttp().getRequest<RequestConUsuario>().usuario,
);

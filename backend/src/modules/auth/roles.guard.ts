import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import type { RequestConUsuario, Rol } from '../../common/types/usuario.js';

/** Corre DESPUÉS de AuthGuard: revisa que el rol del usuario esté permitido. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permitidos || permitidos.length === 0) return true;

    const { usuario } = context.switchToHttp().getRequest<RequestConUsuario>();
    if (!usuario || !permitidos.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }
    return true;
  }
}

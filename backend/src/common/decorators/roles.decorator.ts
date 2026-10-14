import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../types/usuario.js';

export const ROLES_KEY = 'roles';

/**
 * Limita una ruta (o un controlador completo) a ciertos roles.
 * Sin esta marca, cualquier usuario con sesión iniciada puede entrar.
 * Ejemplo: @Roles('administrador')
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICA = 'esPublica';

/**
 * Por defecto TODAS las rutas exigen sesión iniciada.
 * Esta marca deja una ruta abierta (login, refresh, health).
 */
export const Public = () => SetMetadata(ES_PUBLICA, true);

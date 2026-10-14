import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICA = 'esPublica';

/*Por defecto TODAS las rutas exigen sesión iniciada.*/
export const Public = () => SetMetadata(ES_PUBLICA, true);

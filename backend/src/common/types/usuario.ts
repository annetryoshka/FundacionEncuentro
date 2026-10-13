export type Rol = 'administrador' | 'terapeuta' | 'marketing';

/** Usuario autenticado, tal como se guarda en la tabla "perfiles". */
export interface Usuario {
  id: string;
  nombreCompleto: string;
  rol: Rol;
}

/** Petición HTTP después de pasar por el guard de autenticación. */
export interface RequestConUsuario {
  headers: Record<string, string | string[] | undefined>;
  usuario?: Usuario;
  token?: string;
}

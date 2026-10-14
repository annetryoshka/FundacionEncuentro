const REQUERIDAS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/** Valida el .env al arrancar*/
export function validarEnv(config: Record<string, unknown>) {
  const faltan = REQUERIDAS.filter((k) => !String(config[k] ?? '').trim());
  if (faltan.length > 0) {
    throw new Error(`Faltan variables en el archivo .env: ${faltan.join(', ')}`);
  }

  if (String(config.DATABASE_URL).includes('[YOUR-PASSWORD]')) {
    throw new Error(
      'DATABASE_URL todavía tiene [YOUR-PASSWORD]. Reemplázalo (con los corchetes) por la contraseña de tu base de datos.',
    );
  }

  return {
    ...config,
    PORT: Number(config.PORT ?? 3000),
    FRONTEND_URL: String(config.FRONTEND_URL ?? 'http://localhost:5173'),
  };
}

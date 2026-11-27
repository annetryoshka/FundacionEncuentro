// Mismos nombres que muestra la interfaz (frontend: carpetas/tipos.ts, familia/familia.ts, expediente/tipos.ts).
const NOMBRES = {
  tipo: { voluntario: 'Voluntario', derivado: 'Derivado' },
  estado: { iniciado: 'Iniciado', en_proceso: 'En proceso', concluido: 'En conclusión' },
  clasificacion: { social: 'Social', privado: 'Privado' },
  parentesco: {
    madre: 'Madre',
    padre: 'Padre',
    hermano: 'Hermano',
    hermana: 'Hermana',
    hijo: 'Hijo',
    hija: 'Hija',
    abuelo_materno: 'Abuelo materno',
    abuela_materna: 'Abuela materna',
    abuelo_paterno: 'Abuelo paterno',
    abuela_paterna: 'Abuela paterna',
    tio: 'Tío',
    tia: 'Tía',
    pareja: 'Pareja',
    tutor: 'Tutor',
    tutora: 'Tutora',
    otro: 'Otro parentesco',
  },
  moneda: { BOB: 'Bs', USD: 'USD' },
  metodo: { qr: 'QR', transferencia: 'Transferencia', efectivo: 'Efectivo' },
} as const satisfies Record<string, Record<string, string>>;

export type Catalogo = keyof typeof NOMBRES;

/** Un código desconocido se muestra tal cual para no perder el dato. */
export function nombrar(catalogo: Catalogo, codigo: string): string {
  return (NOMBRES[catalogo] as Record<string, string>)[codigo] ?? codigo;
}

/** 2026-03-12 → 12/03/2026. Otro texto se deja igual. */
export function formatearFecha(valor: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}

import { validarMinimosInforme } from './informe-minimos.js';

type SeccionInforme = {
  titulo: string;
  contenido: string;
};

export type EntradaBorrador<TOrigen> = {
  tipo: 'intervencion_sistemica' | 'judicial';
  versionPlantilla: string;
  origen: TOrigen;
  comprobaciones: Parameters<typeof validarMinimosInforme>[0];
  generarSecciones: (origen: Readonly<TOrigen>) => SeccionInforme[];
};

export function prepararBorrador<TOrigen>(entrada: EntradaBorrador<TOrigen>) {
  validarMinimosInforme(entrada.comprobaciones);

  const origen = structuredClone(entrada.origen);

  return {
    tipo: entrada.tipo,
    versionPlantilla: entrada.versionPlantilla,
    origen,
    secciones: entrada.generarSecciones(origen),
  };
}
import { Insignia } from '../../componentes/ui'
import {
  NOMBRE_CLASIFICACION,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  SIN_CLASIFICAR,
  type Clasificacion,
  type EstadoCaso,
  type TipoCaso,
} from './tipos'

export function EtiquetaEstado({ estado }: { estado: EstadoCaso }) {
  const color = estado === 'concluido' ? 'gris' : estado === 'en_proceso' ? 'verde' : 'naranja'
  return <Insignia color={color}>{NOMBRE_ESTADO[estado]}</Insignia>
}

export function EtiquetaTipo({ tipo }: { tipo: TipoCaso }) {
  return <Insignia>{NOMBRE_TIPO[tipo]}</Insignia>
}

/** La clasificación se lee en el texto, no solo en el color: «Sin clasificar» también se escribe. */
export function EtiquetaClasificacion({ clasificacion }: { clasificacion: Clasificacion | null }) {
  if (!clasificacion) return <Insignia color="naranja">{SIN_CLASIFICAR}</Insignia>
  return <Insignia>{NOMBRE_CLASIFICACION[clasificacion]}</Insignia>
}

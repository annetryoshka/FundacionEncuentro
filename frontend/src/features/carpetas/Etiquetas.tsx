import { Insignia } from '../../componentes/ui'
import { NOMBRE_ESTADO, NOMBRE_TIPO, type EstadoCaso, type TipoCaso } from './tipos'

export function EtiquetaEstado({ estado }: { estado: EstadoCaso }) {
  const color = estado === 'concluido' ? 'gris' : estado === 'en_proceso' ? 'verde' : 'naranja'
  return <Insignia color={color}>{NOMBRE_ESTADO[estado]}</Insignia>
}

export function EtiquetaTipo({ tipo }: { tipo: TipoCaso }) {
  return <Insignia>{NOMBRE_TIPO[tipo]}</Insignia>
}

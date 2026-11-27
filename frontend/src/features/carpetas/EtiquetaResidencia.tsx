import { Insignia } from '../../componentes/ui'
import { textoResidencia, type DatosResidencia } from './residencia'

/**
 * Residencia del paciente. «Sin registrar» (pacientes antiguos) se escribe y se distingue por color:
 * no se adivina el domicilio de quien no lo tiene anotado.
 */
export function EtiquetaResidencia({ ciudadResidencia, otraLocalidad }: DatosResidencia) {
  const texto = textoResidencia({ ciudadResidencia, otraLocalidad })
  return <Insignia color={ciudadResidencia ? 'gris' : 'naranja'}>{texto}</Insignia>
}

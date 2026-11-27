import type { InvestigacionPublica } from './investigaciones'
import { TarjetaInvestigacion } from './TarjetaInvestigacion'
import { VacioPublico } from './VacioPublico'

interface Props {
  investigaciones: InvestigacionPublica[]
  /** Ruta del detalle público de cada investigación. */
  rutaDetalle: (id: string) => string
}

/**
 * Listado de investigaciones publicadas. Conserva el orden de la API. Sin artículos muestra un vacío;
 * un fallo de carga se presenta aparte con `ErrorDeCarga`.
 */
export function ListadoInvestigaciones({ investigaciones, rutaDetalle }: Props) {
  if (investigaciones.length === 0) {
    return <VacioPublico mensaje="Por ahora no hay investigaciones publicadas." />
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {investigaciones.map((investigacion) => (
        <li key={investigacion.id}>
          <TarjetaInvestigacion investigacion={investigacion} aDetalle={rutaDetalle(investigacion.id)} />
        </li>
      ))}
    </ul>
  )
}

import { Link } from 'react-router'
import { Insignia } from '../../componentes/ui'
import { ImagenPublica } from './ImagenPublica'
import { ETIQUETA_INVESTIGACION, type InvestigacionPublica } from './investigaciones'
import { formatearFecha } from './publicaciones'

interface Props {
  investigacion: InvestigacionPublica
  /** Ruta del detalle público de esta investigación. */
  aDetalle: string
}

/** Tarjeta de un artículo de investigación publicado. Solo texto; sin datos clínicos ni comentarios. */
export function TarjetaInvestigacion({ investigacion, aDetalle }: Props) {
  const { titulo, resumen, autor, imagen, fechaPublicacion } = investigacion
  const fecha = formatearFecha(fechaPublicacion)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-linea bg-white">
      {imagen && <ImagenPublica imagen={imagen} />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Insignia color="verde">{ETIQUETA_INVESTIGACION}</Insignia>
        </div>
        <h3 className="text-lg font-semibold text-verde-oscuro">
          <Link
            to={aDetalle}
            className="rounded-md underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            {titulo}
          </Link>
        </h3>
        <p className="text-texto">{resumen}</p>
        {(autor || fecha) && (
          <p className="mt-auto text-sm text-suave">
            {[autor && `Por ${autor}`, fecha && `Publicado el ${fecha}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </article>
  )
}

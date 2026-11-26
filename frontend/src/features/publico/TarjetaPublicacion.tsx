import { Link } from 'react-router'
import { Icono } from '../../componentes/iconos'
import { Insignia } from '../../componentes/ui'
import { ImagenPublica } from './ImagenPublica'
import {
  NOMBRE_MODALIDAD,
  NOMBRE_TIPO_PUBLICACION,
  esUrlHttp,
  textoFechas,
  type PublicacionPublica,
} from './publicaciones'

interface Props {
  publicacion: PublicacionPublica
  /** Ruta del detalle público de esta publicación. */
  aDetalle: string
}

/**
 * Tarjeta de una campaña, actividad o curso publicados. Muestra solo texto: nada se interpreta como HTML.
 * Si la imagen falla, el texto se conserva y se avisa con claridad (contrato FE-140, criterio 5).
 */
export function TarjetaPublicacion({ publicacion, aDetalle }: Props) {
  const { tipo, titulo, resumen, imagen, fechaInicio, fechaFin, modalidad, lugar, contactoUrl } = publicacion
  const fechas = textoFechas(fechaInicio, fechaFin)
  const donde = [modalidad && NOMBRE_MODALIDAD[modalidad], lugar].filter(Boolean).join(' · ')

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-linea bg-white">
      {imagen && <ImagenPublica imagen={imagen} />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Insignia color={tipo === 'campana' ? 'naranja' : 'verde'}>{NOMBRE_TIPO_PUBLICACION[tipo]}</Insignia>
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
        <dl className="mt-auto grid gap-1.5 text-sm text-suave">
          {fechas && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Fecha</dt>
              <Icono nombre="calendario" className="mt-0.5 size-4 shrink-0 text-verde" />
              <dd>{fechas}</dd>
            </div>
          )}
          {donde && (
            <div className="flex items-start gap-2">
              <dt className="font-semibold">Modalidad y lugar:</dt>
              <dd>{donde}</dd>
            </div>
          )}
        </dl>
        {esUrlHttp(contactoUrl) && (
          <a
            href={contactoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            Contactar<span className="sr-only"> sobre {titulo} (se abre en otra pestaña)</span>
          </a>
        )}
      </div>
    </article>
  )
}

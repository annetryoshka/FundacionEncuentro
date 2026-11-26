import { Link, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Cargando, EnlaceVolver, Insignia } from '../../componentes/ui'
import { obtenerPublicada } from '../difusion/difusion'
import { ImagenPublica } from './ImagenPublica'
import { NOMBRE_MODALIDAD, NOMBRE_TIPO_PUBLICACION, esUrlHttp, textoFechas } from './publicaciones'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * FE-149 · Detalle público. Un borrador, una publicación retirada o un id inexistente responden 404 y se
 * muestran igual: no se revela si existe. El contenido se muestra como texto, nunca como HTML.
 */
export function PaginaDetallePublicacion() {
  const { id = '' } = useParams()
  const valido = UUID.test(id)
  const { datos, error, recargar } = useCarga(
    () => (valido ? obtenerPublicada(id) : Promise.reject(new ErrorApi(404, 'Publicación no encontrada'))),
    [id],
  )

  if (error !== undefined) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) return <PublicacionNoDisponible />
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir la publicación." />
  }
  if (!datos) return <Cargando texto="Abriendo publicación…" />

  const fechas = textoFechas(datos.fechaInicio, datos.fechaFin)
  const donde = [datos.modalidad && NOMBRE_MODALIDAD[datos.modalidad], datos.lugar].filter(Boolean).join(' · ')

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <EnlaceVolver a="/publicaciones">Ver todas las publicaciones</EnlaceVolver>
      <header className="space-y-3">
        <Insignia color={datos.tipo === 'campana' ? 'naranja' : 'verde'}>
          {NOMBRE_TIPO_PUBLICACION[datos.tipo]}
        </Insignia>
        <h1 className="text-3xl font-semibold break-words text-verde-oscuro">{datos.titulo}</h1>
        {datos.resumen && <p className="text-lg text-texto">{datos.resumen}</p>}
      </header>
      {datos.imagen && (
        <div className="overflow-hidden rounded-3xl border border-linea [&_img]:h-auto [&_img]:max-h-[28rem]">
          <ImagenPublica imagen={datos.imagen} />
        </div>
      )}
      {(fechas || donde) && (
        <dl className="grid gap-2 rounded-2xl bg-crema px-5 py-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
          {fechas && (
            <>
              <dt className="font-semibold text-suave">Fecha</dt>
              <dd className="text-texto">{fechas}</dd>
            </>
          )}
          {donde && (
            <>
              <dt className="font-semibold text-suave">Modalidad y lugar</dt>
              <dd className="text-texto">{donde}</dd>
            </>
          )}
        </dl>
      )}
      {datos.contenido && (
        <div className="max-w-prose leading-relaxed whitespace-pre-line text-texto">{datos.contenido}</div>
      )}
      {esUrlHttp(datos.contactoUrl) && (
        <a
          href={datos.contactoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-verde px-5 py-3 font-semibold text-white hover:bg-verde-oscuro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          Contactar o inscribirse<span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      )}
    </article>
  )
}

export function PublicacionNoDisponible() {
  return (
    <div className="mx-auto max-w-prose space-y-4 text-center">
      <h1 className="text-2xl font-semibold text-verde-oscuro">Esta publicación no está disponible</h1>
      <p className="text-suave">Puede que el enlace no sea correcto o que la publicación ya no esté vigente.</p>
      <Link to="/publicaciones" className="font-semibold text-naranja-texto underline underline-offset-4">
        Ver las publicaciones vigentes
      </Link>
    </div>
  )
}

export function PaginaPublicaNoEncontrada() {
  return (
    <div className="mx-auto max-w-prose space-y-4 text-center">
      <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos esta página</h1>
      <Link to="/publicaciones" className="font-semibold text-naranja-texto underline underline-offset-4">
        Ir a las publicaciones
      </Link>
    </div>
  )
}

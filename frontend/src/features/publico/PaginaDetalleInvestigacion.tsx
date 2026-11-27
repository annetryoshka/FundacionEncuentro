import { Link, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Cargando, EnlaceVolver, Insignia } from '../../componentes/ui'
import { obtenerInvestigacionPublica } from '../articulos/articulos'
import { ImagenPublica } from './ImagenPublica'
import { ETIQUETA_INVESTIGACION } from './investigaciones'
import { formatearFecha } from './publicaciones'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * FE-187 · Detalle público de un artículo. Borrador, retirado o id inexistente se ven igual («no disponible»):
 * no se revela si existe. El contenido se muestra como texto. Sin comentarios (FE-182).
 */
export function PaginaDetalleInvestigacion() {
  const { id = '' } = useParams()
  const { datos, error, recargar } = useCarga(
    () =>
      UUID.test(id)
        ? obtenerInvestigacionPublica(id)
        : Promise.reject(new ErrorApi(404, 'Investigación no encontrada')),
    [id],
  )

  if (error !== undefined) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) {
      return (
        <div className="mx-auto max-w-prose space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-verde-oscuro">Esta investigación no está disponible</h1>
          <p className="text-suave">Puede que el enlace no sea correcto o que el artículo ya no esté publicado.</p>
          <Link to="/investigaciones" className="font-semibold text-naranja-texto underline underline-offset-4">
            Ver las investigaciones publicadas
          </Link>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir la investigación." />
  }
  if (!datos) return <Cargando texto="Abriendo investigación…" />

  const fecha = formatearFecha(datos.fechaPublicacion)
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <EnlaceVolver a="/investigaciones">Ver todas las investigaciones</EnlaceVolver>
      <header className="space-y-3">
        <Insignia color="verde">{ETIQUETA_INVESTIGACION}</Insignia>
        <h1 className="text-3xl font-semibold break-words text-verde-oscuro">{datos.titulo}</h1>
        {datos.resumen && <p className="text-lg text-texto">{datos.resumen}</p>}
        {(datos.autor || fecha) && (
          <p className="text-sm text-suave">
            {[datos.autor && `Por ${datos.autor}`, fecha && `Publicado el ${fecha}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>
      {datos.imagen && (
        <div className="overflow-hidden rounded-3xl border border-linea [&_img]:h-auto [&_img]:max-h-[28rem]">
          <ImagenPublica imagen={datos.imagen} />
        </div>
      )}
      <div className="max-w-prose leading-relaxed whitespace-pre-line text-texto">{datos.contenido}</div>
    </article>
  )
}

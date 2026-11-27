import { useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Boton, Cargando } from '../../componentes/ui'
import { Icono } from '../../componentes/iconos'
import { OndaSuperior } from '../../componentes/marca'
import { listarPublicadas } from '../difusion/difusion'
import { IconoInicio } from './iconosInicio'
import { ENLACE_WHATSAPP } from './institucional'
import { CategoriasPublicaciones, ListadoPublicaciones } from './ListadoPublicaciones'
import { esTipoPublicacion } from './publicaciones'

/** FE-149 · Portal público: campañas, actividades y cursos publicados (API FE-143, tarjetas de FE-148). */
export function PaginaPublicaciones() {
  const [parametros, setParametros] = useSearchParams()
  const tipoUrl = parametros.get('tipo') ?? ''
  const tipo = esTipoPublicacion(tipoUrl) ? tipoUrl : ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const { datos, error, cargando, recargar } = useCarga(() => listarPublicadas({ tipo, pagina }), [tipo, pagina])

  const ir = (nuevoTipo: typeof tipo, nuevaPagina = 1) => {
    const p = new URLSearchParams()
    if (nuevoTipo) p.set('tipo', nuevoTipo)
    if (nuevaPagina > 1) p.set('pagina', String(nuevaPagina))
    setParametros(p)
  }
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1

  return (
    <>
      <section aria-labelledby="titulo-publicaciones" className="relative overflow-hidden bg-crema">
        <OndaSuperior className="pointer-events-none absolute -top-2 right-0 h-24 w-40 sm:h-36 sm:w-64" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-8 sm:pt-16">
          <p className="text-sm font-semibold tracking-[0.18em] text-naranja-texto uppercase">Comunidad</p>
          <h1 id="titulo-publicaciones" className="mt-2 text-3xl font-semibold text-verde-oscuro sm:text-4xl">
            Campañas, actividades y cursos
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-texto">
            Lo que la Fundación Encuentro organiza para la comunidad: espacios para aprender, participar y cuidar
            nuestra salud mental en familia.
          </p>
          <div className="mt-8">
            <CategoriasPublicaciones valor={tipo} alCambiar={(t) => ir(t)} />
          </div>
        </div>
      </section>

      <section aria-label="Publicaciones" className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">{contenido()}</div>
      </section>

      <section aria-labelledby="titulo-participar" className="bg-naranja-pie text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="titulo-participar" className="text-2xl font-semibold sm:text-3xl">
              ¿Quieres participar o tienes dudas?
            </h2>
            <p className="mt-2 text-white/90">Escríbenos y te contamos cómo inscribirte en la próxima actividad.</p>
          </div>
          <a
            href={ENLACE_WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-naranja-pie transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <IconoInicio nombre="mensaje" />
            Escríbenos por WhatsApp
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </div>
      </section>
    </>
  )

  function contenido() {
    return error !== undefined ? (
      <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar las publicaciones." />
    ) : !datos ? (
      <Cargando texto="Cargando publicaciones…" />
    ) : (
      <div aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
        <ListadoPublicaciones
          publicaciones={datos.publicaciones}
          rutaDetalle={(id) => `/publicaciones/${id}`}
          tipo={tipo}
        />
        {totalPaginas > 1 && (
          <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-3">
            <Boton variante="secundario" icono="anterior" disabled={pagina <= 1} onClick={() => ir(tipo, pagina - 1)}>
              Anterior
            </Boton>
            <p className="text-sm text-suave">
              Página {datos.pagina} de {totalPaginas}
            </p>
            <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => ir(tipo, pagina + 1)}>
              Siguiente
              <Icono nombre="siguiente" className="size-[1.125rem]" />
            </Boton>
          </nav>
        )}
      </div>
    )
  }
}

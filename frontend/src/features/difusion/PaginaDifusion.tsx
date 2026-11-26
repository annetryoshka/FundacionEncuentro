import { Link, useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { claseBoton } from '../../componentes/estilos'
import { Icono } from '../../componentes/iconos'
import { Boton, CampoSeleccion, Cargando, EncabezadoPagina, Insignia } from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import { NOMBRE_TIPO_PUBLICACION, esTipoPublicacion, textoFechas, type TipoPublicacion } from '../publico/publicaciones'
import { NOMBRE_ESTADO_PUBLICACION, listarPublicacionesAdmin, type EstadoPublicacion } from './difusion'

const esEstado = (v: string): v is EstadoPublicacion => v in NOMBRE_ESTADO_PUBLICACION

export function EtiquetaEstadoPublicacion({ estado }: { estado: EstadoPublicacion }) {
  return (
    <Insignia color={estado === 'publicado' ? 'verde' : estado === 'borrador' ? 'naranja' : 'gris'}>
      {NOMBRE_ESTADO_PUBLICACION[estado]}
    </Insignia>
  )
}

/**
 * FE-144 · Publicaciones de difusión (campañas, actividades y cursos) para marketing y administración.
 * Filtros y página en la URL, como el listado de carpetas.
 */
export function PaginaDifusion() {
  const [parametros, setParametros] = useSearchParams()
  const estadoUrl = parametros.get('estado') ?? ''
  const tipoUrl = parametros.get('tipo') ?? ''
  const estado = esEstado(estadoUrl) ? estadoUrl : ''
  const tipo = esTipoPublicacion(tipoUrl) ? tipoUrl : ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)

  const { datos, error, cargando, recargar } = useCarga(
    () => listarPublicacionesAdmin({ estado, tipo, pagina }),
    [estado, tipo, pagina],
  )

  const ir = (cambio: { estado?: EstadoPublicacion | ''; tipo?: TipoPublicacion | ''; pagina?: number }) => {
    const siguiente = { estado, tipo, pagina: 1, ...cambio }
    const p = new URLSearchParams()
    if (siguiente.estado) p.set('estado', siguiente.estado)
    if (siguiente.tipo) p.set('tipo', siguiente.tipo)
    if (siguiente.pagina > 1) p.set('pagina', String(siguiente.pagina))
    setParametros(p)
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Difusión"
        descripcion="Campañas, actividades y cursos de la Fundación. Solo lo publicado se ve en el portal público."
        accion={
          <Link to="/difusion/nueva" className={claseBoton()}>
            <Icono nombre="mas" className="size-[1.125rem]" />
            Nueva publicación
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
        <CampoSeleccion
          etiqueta="Estado"
          value={estado}
          onChange={(e) => ir({ estado: esEstado(e.target.value) ? e.target.value : '' })}
        >
          <option value="">Todos</option>
          {Object.entries(NOMBRE_ESTADO_PUBLICACION).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </CampoSeleccion>
        <CampoSeleccion
          etiqueta="Tipo"
          value={tipo}
          onChange={(e) => ir({ tipo: esTipoPublicacion(e.target.value) ? e.target.value : '' })}
        >
          <option value="">Todos</option>
          {Object.entries(NOMBRE_TIPO_PUBLICACION).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </CampoSeleccion>
      </div>

      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar las publicaciones." />
      ) : !datos ? (
        <Cargando texto="Cargando publicaciones…" />
      ) : datos.total === 0 ? (
        <div
          role="status"
          className="rounded-3xl border border-dashed border-naranja/50 bg-white px-6 py-10 text-center"
        >
          <p className="text-lg font-semibold text-verde-oscuro">
            {estado || tipo ? 'No hay publicaciones con ese filtro' : 'Todavía no hay publicaciones'}
          </p>
          <p className="mt-1 text-suave">
            {estado || tipo ? 'Prueba con otro estado o tipo.' : 'Crea la primera campaña, actividad o curso.'}
          </p>
        </div>
      ) : (
        <div aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
          <p role="status" className="mb-3 text-sm text-suave">
            {datos.total} {datos.total === 1 ? 'publicación' : 'publicaciones'}
          </p>
          <ul className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white">
            {datos.publicaciones.map((p) => {
              const fechas = textoFechas(p.fechaInicio, p.fechaFin)
              return (
                <li key={p.id}>
                  <Link
                    to={`/difusion/${p.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-naranja sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-naranja-texto">
                        {NOMBRE_TIPO_PUBLICACION[p.tipo]}
                      </span>
                      <span className="block font-semibold break-words text-texto">{p.titulo}</span>
                      <span className="block text-sm text-suave">
                        {fechas ?? 'Sin fecha de actividad'}
                        {p.publicadoEn && ` · Publicada el ${fechaCorta(p.publicadoEn)}`}
                      </span>
                    </span>
                    <EtiquetaEstadoPublicacion estado={p.estado} />
                  </Link>
                </li>
              )
            })}
          </ul>
          {totalPaginas > 1 && (
            <nav aria-label="Paginación" className="mt-5 flex items-center justify-between gap-3">
              <Boton
                variante="secundario"
                icono="anterior"
                disabled={pagina <= 1}
                onClick={() => ir({ pagina: pagina - 1 })}
              >
                Anterior
              </Boton>
              <p className="text-sm text-suave">
                Página {datos.pagina} de {totalPaginas}
              </p>
              <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => ir({ pagina: pagina + 1 })}>
                Siguiente
                <Icono nombre="siguiente" className="size-[1.125rem]" />
              </Boton>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

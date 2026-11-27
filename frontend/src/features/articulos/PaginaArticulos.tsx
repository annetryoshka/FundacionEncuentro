import { Link, useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { claseBoton } from '../../componentes/estilos'
import { Icono } from '../../componentes/iconos'
import { Boton, CampoSeleccion, Cargando, EncabezadoPagina, Insignia } from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import { NOMBRE_ESTADO_ARTICULO, listarArticulos, type EstadoArticulo } from './articulos'

const esEstado = (v: string): v is EstadoArticulo => v in NOMBRE_ESTADO_ARTICULO

export function EtiquetaEstadoArticulo({ estado }: { estado: EstadoArticulo }) {
  return (
    <Insignia color={estado === 'publicado' ? 'verde' : estado === 'borrador' ? 'naranja' : 'gris'}>
      {NOMBRE_ESTADO_ARTICULO[estado]}
    </Insignia>
  )
}

/** FE-187 · Artículos de investigación para el portal público (administración y marketing). */
export function PaginaArticulos() {
  const [parametros, setParametros] = useSearchParams()
  const estadoUrl = parametros.get('estado') ?? ''
  const estado = esEstado(estadoUrl) ? estadoUrl : ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const { datos, error, cargando, recargar } = useCarga(() => listarArticulos({ estado, pagina }), [estado, pagina])

  const ir = (nuevoEstado: EstadoArticulo | '', nuevaPagina = 1) => {
    const p = new URLSearchParams()
    if (nuevoEstado) p.set('estado', nuevoEstado)
    if (nuevaPagina > 1) p.set('pagina', String(nuevaPagina))
    setParametros(p)
  }
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Artículos de investigación"
        descripcion="Artículos autorizados por la Fundación para la sección «Investigaciones» del portal público. No llevan datos de pacientes ni comentarios."
        accion={
          <Link to="/articulos/nuevo" className={claseBoton()} data-recorrido="nuevo-articulo">
            <Icono nombre="mas" className="size-[1.125rem]" />
            Nuevo artículo
          </Link>
        }
      />
      <div className="sm:max-w-xs" data-recorrido="filtro-articulos">
        <CampoSeleccion
          etiqueta="Estado"
          value={estado}
          onChange={(e) => ir(esEstado(e.target.value) ? e.target.value : '')}
        >
          <option value="">Todos</option>
          {Object.entries(NOMBRE_ESTADO_ARTICULO).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </CampoSeleccion>
      </div>

      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar los artículos." />
      ) : !datos ? (
        <Cargando texto="Cargando artículos…" />
      ) : datos.total === 0 ? (
        <div
          role="status"
          className="rounded-3xl border border-dashed border-naranja/50 bg-white px-6 py-10 text-center"
        >
          <p className="text-lg font-semibold text-verde-oscuro">
            {estado ? 'No hay artículos con ese estado' : 'Todavía no hay artículos'}
          </p>
          <p className="mt-1 text-suave">
            {estado ? 'Prueba con otro estado.' : 'Crea el primero con «Nuevo artículo».'}
          </p>
        </div>
      ) : (
        <div aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
          <p role="status" className="mb-3 text-sm text-suave">
            {datos.total} {datos.total === 1 ? 'artículo' : 'artículos'}
          </p>
          <ul
            className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white"
            data-recorrido="lista-articulos"
          >
            {datos.articulos.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/articulos/${a.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-naranja sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold break-words text-texto">{a.titulo}</span>
                    <span className="block text-sm text-suave">
                      {a.autorVisible ? `Por ${a.autorVisible}` : 'Sin autor visible'}
                      {a.publicadoEn && ` · Publicado el ${fechaCorta(a.publicadoEn)}`}
                    </span>
                  </span>
                  <EtiquetaEstadoArticulo estado={a.estado} />
                </Link>
              </li>
            ))}
          </ul>
          {totalPaginas > 1 && (
            <nav
              aria-label="Paginación"
              className="mt-5 flex items-center justify-between gap-3"
              data-recorrido="paginacion"
            >
              <Boton
                variante="secundario"
                icono="anterior"
                disabled={pagina <= 1}
                onClick={() => ir(estado, pagina - 1)}
              >
                Anterior
              </Boton>
              <p className="text-sm text-suave">
                Página {datos.pagina} de {totalPaginas}
              </p>
              <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => ir(estado, pagina + 1)}>
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

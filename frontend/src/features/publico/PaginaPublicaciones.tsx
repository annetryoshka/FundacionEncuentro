import { useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Boton, Cargando } from '../../componentes/ui'
import { Icono } from '../../componentes/iconos'
import { listarPublicadas } from '../difusion/difusion'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Campañas, actividades y cursos</h1>
        <p className="mt-1.5 max-w-prose text-suave">Lo que la Fundación Encuentro organiza para la comunidad.</p>
      </div>
      <CategoriasPublicaciones valor={tipo} alCambiar={(t) => ir(t)} />
      {error !== undefined ? (
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
      )}
    </div>
  )
}

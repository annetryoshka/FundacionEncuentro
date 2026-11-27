import { useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Icono } from '../../componentes/iconos'
import { Boton, Cargando } from '../../componentes/ui'
import { listarInvestigacionesPublicas } from '../articulos/articulos'
import { ListadoInvestigaciones } from './ListadoInvestigaciones'

/** FE-187 · Investigaciones del portal público, con el listado y las tarjetas de FE-186 (API FE-184). */
export function PaginaInvestigaciones() {
  const [parametros, setParametros] = useSearchParams()
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const { datos, error, cargando, recargar } = useCarga(() => listarInvestigacionesPublicas(pagina), [pagina])
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1
  const ir = (n: number) => setParametros(n > 1 ? { pagina: String(n) } : {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Investigaciones</h1>
        <p className="mt-1.5 max-w-prose text-suave">
          Artículos que la Fundación Encuentro comparte con la comunidad. No contienen datos de pacientes.
        </p>
      </div>
      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar las investigaciones." />
      ) : !datos ? (
        <Cargando texto="Cargando investigaciones…" />
      ) : (
        <div aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
          <ListadoInvestigaciones
            investigaciones={datos.investigaciones}
            rutaDetalle={(id) => `/investigaciones/${id}`}
          />
          {totalPaginas > 1 && (
            <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-3">
              <Boton variante="secundario" icono="anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>
                Anterior
              </Boton>
              <p className="text-sm text-suave">
                Página {datos.pagina} de {totalPaginas}
              </p>
              <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => ir(pagina + 1)}>
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

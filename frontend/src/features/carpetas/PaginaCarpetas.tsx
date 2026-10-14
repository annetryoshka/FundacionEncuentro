import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { claseCampo } from '../../componentes/estilos'
import { Boton, Cargando, EncabezadoPagina } from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { buscarCarpetas } from './carpetasApi'
import { EtiquetaEstado, EtiquetaTipo } from './Etiquetas'
import { numeroCarpeta, type PaginaCarpetas as Resultado } from './tipos'

/**
 * FE-39 · Listado y búsqueda de carpetas (historia FE-16).
 * La búsqueda y la página viven en la URL (?q=…&pagina=…) para que Atrás y recargar funcionen.
 * El backend solo devuelve las carpetas que la persona puede consultar.
 */
export function PaginaCarpetas() {
  const { tieneRol } = useSesion()
  const esAdmin = tieneRol('administrador')
  const [parametros, setParametros] = useSearchParams()
  const q = parametros.get('q') ?? ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)

  const { datos, error, cargando, recargar } = useCarga(() => buscarCarpetas(q, pagina), [q, pagina])

  const irA = (nuevaQ: string, nuevaPagina = 1) => {
    const siguientes = new URLSearchParams()
    if (nuevaQ.trim()) siguientes.set('q', nuevaQ.trim())
    if (nuevaPagina > 1) siguientes.set('pagina', String(nuevaPagina))
    setParametros(siguientes)
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={esAdmin ? 'Carpetas' : 'Mis carpetas'}
        descripcion={esAdmin ? 'Todas las carpetas del centro.' : 'Solo ves las carpetas que la dirección te asignó.'}
        accion={
          esAdmin && (
            <Link
              to="/carpetas/nueva"
              className="inline-flex items-center justify-center rounded-full bg-verde px-5 py-3 font-semibold text-white hover:bg-verde-oscuro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              Registrar paciente
            </Link>
          )
        }
      />

      {/* key={q}: si la URL cambia (Atrás, Limpiar), el campo muestra la búsqueda vigente. */}
      <FormularioBusqueda key={q} inicial={q} alBuscar={(texto) => irA(texto)} alLimpiar={() => irA('')} />

      <Resultados
        datos={datos}
        error={error}
        cargando={cargando}
        q={q}
        esAdmin={esAdmin}
        recargar={recargar}
        alCambiarPagina={(p) => irA(q, p)}
      />
    </div>
  )
}

function FormularioBusqueda({
  inicial,
  alBuscar,
  alLimpiar,
}: {
  inicial: string
  alBuscar: (texto: string) => void
  alLimpiar: () => void
}) {
  const [texto, setTexto] = useState(inicial)
  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    alBuscar(texto)
  }
  return (
    <form role="search" onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="busqueda-carpetas" className="block text-sm font-semibold text-texto">
          Buscar por nombre o número de carpeta
        </label>
        <input
          id="busqueda-carpetas"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: Mamani o 12"
          autoComplete="off"
          className={claseCampo(false)}
        />
      </div>
      <div className="flex gap-2">
        <Boton type="submit" className="flex-1 sm:flex-none">
          Buscar
        </Boton>
        {inicial && (
          <Boton variante="secundario" onClick={alLimpiar}>
            Limpiar
          </Boton>
        )}
      </div>
    </form>
  )
}

interface PropsResultados {
  datos: Resultado | undefined
  error: unknown
  cargando: boolean
  q: string
  esAdmin: boolean
  recargar: () => void
  alCambiarPagina: (pagina: number) => void
}

function Resultados({ datos, error, cargando, q, esAdmin, recargar, alCambiarPagina }: PropsResultados) {
  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} />
  }
  if (!datos) return <Cargando texto="Buscando carpetas…" />

  const totalPaginas = Math.max(1, Math.ceil(datos.total / datos.tamano))

  if (datos.total === 0) {
    return (
      <div role="status" className="rounded-3xl border border-dashed border-naranja/50 bg-white px-6 py-10 text-center">
        {q ? (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">No encontramos carpetas para «{q}»</p>
            <p className="mt-1 text-suave">Revisa cómo está escrito el nombre o busca por número de carpeta.</p>
          </>
        ) : esAdmin ? (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">Todavía no hay carpetas</p>
            <p className="mt-1 text-suave">Registra al primer paciente para abrir su carpeta digital.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">Aún no tienes carpetas asignadas</p>
            <p className="mt-1 text-suave">La dirección te asigna cada caso desde su carpeta.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={cargando ? 'opacity-60 transition-opacity' : undefined} aria-busy={cargando}>
      <p role="status" className="mb-3 text-sm text-suave">
        {q
          ? `${datos.total} ${datos.total === 1 ? 'resultado' : 'resultados'} para «${q}»`
          : `${datos.total} ${datos.total === 1 ? 'carpeta' : 'carpetas'}`}
      </p>

      <ul className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white">
        {datos.carpetas.map((c) => (
          <li key={c.id}>
            <Link
              to={`/carpetas/${c.id}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-naranja sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="row-span-2 sm:row-span-1">
                <span className="block text-lg font-semibold text-naranja-texto">{numeroCarpeta(c.numero)}</span>
                <EtiquetaTipo tipo={c.tipo} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-texto">{c.paciente.nombreCompleto}</span>
                <span className="block text-sm text-suave">Ingreso {fechaCorta(c.fechaIngreso)}</span>
                {esAdmin &&
                  (c.terapeuta ? (
                    <span className="block text-sm text-suave">Responsable: {c.terapeuta.nombreCompleto}</span>
                  ) : (
                    <span className="block text-sm font-medium text-naranja-texto">Sin terapeuta asignada</span>
                  ))}
              </span>
              <span className="sm:justify-self-end">
                <EtiquetaEstado estado={c.estado} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {totalPaginas > 1 && (
        <nav aria-label="Paginación" className="mt-5 flex items-center justify-between gap-3">
          <Boton variante="secundario" disabled={datos.pagina <= 1} onClick={() => alCambiarPagina(datos.pagina - 1)}>
            Anterior
          </Boton>
          <p className="text-sm text-suave">
            Página {datos.pagina} de {totalPaginas}
          </p>
          <Boton
            variante="secundario"
            disabled={datos.pagina >= totalPaginas}
            onClick={() => alCambiarPagina(datos.pagina + 1)}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </div>
  )
}

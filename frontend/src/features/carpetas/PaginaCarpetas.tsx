import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { claseCampo } from '../../componentes/estilos'
import { Aviso, Boton, Cargando, EncabezadoPagina } from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { buscarCarpetas, TAMANO_PAGINA } from './carpetasApi'
import { EtiquetaEstado, EtiquetaTipo } from './Etiquetas'
import {
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  numeroCarpeta,
  type EstadoCaso,
  type ListadoCarpetas as Resultado,
  type TipoCaso,
} from './tipos'

interface Filtros {
  q: string
  tipo: TipoCaso | ''
  estado: EstadoCaso | ''
}

const leerTipo = (v: string | null): TipoCaso | '' => (v && v in NOMBRE_TIPO ? (v as TipoCaso) : '')
const leerEstado = (v: string | null): EstadoCaso | '' => (v && v in NOMBRE_ESTADO ? (v as EstadoCaso) : '')

/**
 * FE-39 · Listado y búsqueda de carpetas (historia FE-16), con GET /api/casos (FE-32).
 * Búsqueda, filtros y página viven en la URL (?q=…&tipo=…&estado=…&pagina=…) para que Atrás y recargar funcionen.
 */
export function PaginaCarpetas() {
  const { tieneRol } = useSesion()
  const esAdmin = tieneRol('administrador')
  const [parametros, setParametros] = useSearchParams()
  const filtros: Filtros = {
    q: parametros.get('q') ?? '',
    tipo: leerTipo(parametros.get('tipo')),
    estado: leerEstado(parametros.get('estado')),
  }
  const { q, tipo, estado } = filtros
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)

  const { datos, error, cargando, recargar } = useCarga(
    () => buscarCarpetas({ q, tipo, estado, pagina }),
    [q, tipo, estado, pagina],
  )

  const irA = (nuevos: Filtros, nuevaPagina = 1) => {
    const siguientes = new URLSearchParams()
    if (nuevos.q.trim()) siguientes.set('q', nuevos.q.trim())
    if (nuevos.tipo) siguientes.set('tipo', nuevos.tipo)
    if (nuevos.estado) siguientes.set('estado', nuevos.estado)
    if (nuevaPagina > 1) siguientes.set('pagina', String(nuevaPagina))
    setParametros(siguientes)
  }
  const hayFiltros = Boolean(q || tipo || estado)
  // Hoy GET /api/casos es solo para administración; el acceso de terapeutas llega con FE-37.
  const sinAccesoTodavia = !esAdmin && error instanceof ErrorApi && error.estado === 403

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

      {/* key: si la URL cambia (Atrás, Limpiar), el formulario muestra la búsqueda vigente. */}
      {!sinAccesoTodavia && (
        <FormularioBusqueda
          key={`${q}|${tipo}|${estado}`}
          inicial={filtros}
          hayFiltros={hayFiltros}
          alBuscar={(nuevos) => irA(nuevos)}
          alLimpiar={() => irA({ q: '', tipo: '', estado: '' })}
        />
      )}

      <Resultados
        datos={datos}
        error={error}
        cargando={cargando}
        hayFiltros={hayFiltros}
        q={q}
        pagina={pagina}
        esAdmin={esAdmin}
        recargar={recargar}
        alCambiarPagina={(p) => irA(filtros, p)}
      />
    </div>
  )
}

function FormularioBusqueda({
  inicial,
  hayFiltros,
  alBuscar,
  alLimpiar,
}: {
  inicial: Filtros
  hayFiltros: boolean
  alBuscar: (filtros: Filtros) => void
  alLimpiar: () => void
}) {
  const [filtros, setFiltros] = useState(inicial)
  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    alBuscar(filtros)
  }
  // Los filtros de lista se aplican al elegirlos; el texto, al pulsar Buscar.
  const elegir = (cambio: Partial<Filtros>) => {
    const siguientes = { ...filtros, ...cambio }
    setFiltros(siguientes)
    alBuscar(siguientes)
  }
  return (
    <form
      role="search"
      onSubmit={buscar}
      className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] sm:items-end"
    >
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="busqueda-carpetas" className="block text-sm font-semibold text-texto">
          Buscar por nombre del paciente
        </label>
        <input
          id="busqueda-carpetas"
          type="search"
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
          placeholder="Ej.: Mamani"
          autoComplete="off"
          maxLength={100}
          className={claseCampo(false)}
        />
      </div>
      <div>
        <label htmlFor="filtro-tipo" className="block text-sm font-semibold text-texto">
          Tipo
        </label>
        <select
          id="filtro-tipo"
          value={filtros.tipo}
          onChange={(e) => elegir({ tipo: leerTipo(e.target.value) })}
          className={claseCampo(false)}
        >
          <option value="">Todos</option>
          {Object.entries(NOMBRE_TIPO).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filtro-estado" className="block text-sm font-semibold text-texto">
          Estado
        </label>
        <select
          id="filtro-estado"
          value={filtros.estado}
          onChange={(e) => elegir({ estado: leerEstado(e.target.value) })}
          className={claseCampo(false)}
        >
          <option value="">Todos</option>
          {Object.entries(NOMBRE_ESTADO).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <Boton type="submit" className="flex-1 sm:flex-none">
          Buscar
        </Boton>
        {hayFiltros && (
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
  hayFiltros: boolean
  q: string
  pagina: number
  esAdmin: boolean
  recargar: () => void
  alCambiarPagina: (pagina: number) => void
}

function Resultados({
  datos,
  error,
  cargando,
  hayFiltros,
  q,
  pagina,
  esAdmin,
  recargar,
  alCambiarPagina,
}: PropsResultados) {
  if (error !== undefined) {
    // Hoy GET /api/casos es solo para administración; el acceso de terapeutas llega con FE-37.
    if (!esAdmin && error instanceof ErrorApi && error.estado === 403) {
      return (
        <Aviso tipo="info">
          Pronto verás aquí las carpetas que la dirección te asigne. Esta parte del servidor todavía se está terminando.
        </Aviso>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} />
  }
  if (!datos) return <Cargando texto="Buscando carpetas…" />

  const totalPaginas = Math.max(1, Math.ceil(datos.total / (datos.limite || TAMANO_PAGINA)))

  if (datos.datos.length === 0) {
    return (
      <div role="status" className="rounded-3xl border border-dashed border-naranja/50 bg-white px-6 py-10 text-center">
        {datos.total > 0 ? (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">Esta página ya no tiene carpetas</p>
            <Boton variante="texto" onClick={() => alCambiarPagina(1)}>
              Volver a la primera página
            </Boton>
          </>
        ) : hayFiltros ? (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">
              {q ? `No encontramos carpetas para «${q}»` : 'No hay carpetas con esos filtros'}
            </p>
            <p className="mt-1 text-suave">Revisa cómo está escrito el nombre (con sus tildes) o quita los filtros.</p>
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
        {datos.datos.map((c) => (
          <li key={c.id}>
            <Link
              to={`/carpetas/${c.id}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-crema focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-naranja sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="row-span-2 sm:row-span-1">
                <span className="block text-lg font-semibold text-naranja-texto">
                  {numeroCarpeta(c.numeroCorrelativo)}
                </span>
                <EtiquetaTipo tipo={c.tipo} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-texto">{c.paciente.nombreCompleto}</span>
                <span className="block text-sm text-suave">Ingreso {fechaCorta(c.fechaIngreso)}</span>
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
          <Boton variante="secundario" disabled={pagina <= 1} onClick={() => alCambiarPagina(pagina - 1)}>
            Anterior
          </Boton>
          <p className="text-sm text-suave">
            Página {pagina} de {totalPaginas}
          </p>
          <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => alCambiarPagina(pagina + 1)}>
            Siguiente
          </Boton>
        </nav>
      )}
    </div>
  )
}

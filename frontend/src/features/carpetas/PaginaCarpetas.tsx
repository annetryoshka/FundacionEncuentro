import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { claseBoton, claseCampo } from '../../componentes/estilos'
import { Icono } from '../../componentes/iconos'
import { Boton, Cargando, EncabezadoPagina } from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import { useSesion } from '../auth/sesion'
import { buscarCarpetas } from './carpetasApi'
import { EtiquetaClasificacion, EtiquetaEstado, EtiquetaTipo } from './Etiquetas'
import { EtiquetaResidencia } from './EtiquetaResidencia'
import {
  FILTRO_SIN_REGISTRAR,
  NOMBRE_RESIDENCIA,
  SIN_REGISTRAR,
  esFiltroResidencia,
  type FiltroResidencia,
} from './residencia'
import { FiltroResidenciaCarpetas } from './SelectorResidencia'
import {
  NOMBRE_CLASIFICACION,
  NOMBRE_ESTADO,
  esClasificacion,
  esEstado,
  numeroCarpeta,
  type Clasificacion,
  type EstadoCaso,
  type PaginaCarpetas as Resultado,
} from './tipos'

/** Lo que la persona eligió para acotar el listado. Vacío = «Todos». */
interface Criterios {
  q: string
  clasificacion: Clasificacion | ''
  estado: EstadoCaso | ''
  residencia: FiltroResidencia
}

const SIN_CRITERIOS: Criterios = { q: '', clasificacion: '', estado: '', residencia: '' }

/**
 * FE-39 · Listado y búsqueda de carpetas (historia FE-16).
 * FE-47 · Filtros por clasificación y estado combinados con la búsqueda (historia FE-14).
 * FE-138 · Filtro por ciudad de residencia (?residencia=la_paz|el_alto|otra|sin_registrar).
 * Búsqueda, filtros y página viven en la URL (?q=…&clasificacion=…&estado=…&residencia=…&pagina=…) para que
 * Atrás, recargar y compartir el enlace conserven lo elegido. Un valor desconocido en la URL se ignora.
 * El backend solo devuelve las carpetas que la persona puede consultar.
 */
export function PaginaCarpetas() {
  const { tieneRol } = useSesion()
  const esAdmin = tieneRol('administrador')
  const [parametros, setParametros] = useSearchParams()
  const q = parametros.get('q') ?? ''
  const clasificacionUrl = parametros.get('clasificacion')
  const estadoUrl = parametros.get('estado')
  const clasificacion = esClasificacion(clasificacionUrl) ? clasificacionUrl : ''
  const estado = esEstado(estadoUrl) ? estadoUrl : ''
  const residenciaUrl = parametros.get('residencia') ?? ''
  const residencia = esFiltroResidencia(residenciaUrl) ? residenciaUrl : ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const criterios: Criterios = { q, clasificacion, estado, residencia }
  const hayFiltros = Boolean(clasificacion || estado || residencia)

  const { datos, error, cargando, recargar } = useCarga(
    () => buscarCarpetas({ busqueda: q, clasificacion, estado, residencia, pagina }),
    [q, clasificacion, estado, residencia, pagina],
  )

  // Al cambiar la búsqueda o un filtro se vuelve a la página 1 (FE-59).
  const irA = (nuevos: Criterios, nuevaPagina = 1) => {
    const siguientes = new URLSearchParams()
    if (nuevos.q.trim()) siguientes.set('q', nuevos.q.trim())
    if (nuevos.clasificacion) siguientes.set('clasificacion', nuevos.clasificacion)
    if (nuevos.estado) siguientes.set('estado', nuevos.estado)
    if (nuevos.residencia) siguientes.set('residencia', nuevos.residencia)
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
            <Link to="/carpetas/nueva" className={claseBoton()} data-recorrido="registrar-paciente">
              <Icono nombre="pacienteNuevo" className="size-[1.125rem]" />
              Registrar paciente
            </Link>
          )
        }
      />

      {/* key: si la URL cambia (Atrás, Limpiar), el formulario muestra la búsqueda y los filtros vigentes. */}
      <FormularioBusqueda
        key={`${q}|${clasificacion}|${estado}|${residencia}`}
        inicial={criterios}
        alBuscar={(nuevos) => irA(nuevos)}
        alLimpiar={() => irA(SIN_CRITERIOS)}
      />

      <Resultados
        datos={datos}
        error={error}
        cargando={cargando}
        criterios={criterios}
        hayFiltros={hayFiltros}
        esAdmin={esAdmin}
        recargar={recargar}
        alCambiarPagina={(p) => irA(criterios, p)}
        alQuitarFiltros={() => irA({ ...SIN_CRITERIOS, q })}
      />
    </div>
  )
}

function FormularioBusqueda({
  inicial,
  alBuscar,
  alLimpiar,
}: {
  inicial: Criterios
  alBuscar: (criterios: Criterios) => void
  alLimpiar: () => void
}) {
  const [texto, setTexto] = useState(inicial.q)
  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    alBuscar({ ...inicial, q: texto })
  }
  // Un filtro se aplica al elegirlo y se combina con lo que ya esté escrito en la búsqueda.
  const filtrar = (cambio: Partial<Criterios>) => alBuscar({ ...inicial, q: texto, ...cambio })
  const hayAlgo = Boolean(inicial.q || inicial.clasificacion || inicial.estado || inicial.residencia)

  return (
    <form
      role="search"
      onSubmit={buscar}
      className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem_auto] lg:items-end"
    >
      <div className="col-span-2 lg:col-span-1" data-recorrido="buscar-carpetas">
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
      <div className="min-w-0" data-recorrido="filtros-carpetas">
        <label htmlFor="filtro-clasificacion" className="block text-sm font-semibold text-texto">
          Clasificación
        </label>
        <select
          id="filtro-clasificacion"
          value={inicial.clasificacion}
          onChange={(e) => filtrar({ clasificacion: esClasificacion(e.target.value) ? e.target.value : '' })}
          className={claseCampo(false)}
        >
          <option value="">Todas</option>
          {Object.entries(NOMBRE_CLASIFICACION).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0" data-recorrido="filtros-carpetas">
        <label htmlFor="filtro-estado" className="block text-sm font-semibold text-texto">
          Estado
        </label>
        <select
          id="filtro-estado"
          value={inicial.estado}
          onChange={(e) => filtrar({ estado: esEstado(e.target.value) ? e.target.value : '' })}
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
      <div className="col-span-2 lg:col-span-1" data-recorrido="filtros-carpetas">
        <FiltroResidenciaCarpetas valor={inicial.residencia} alCambiar={(residencia) => filtrar({ residencia })} />
      </div>
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <Boton type="submit" icono="buscar" className="flex-1 lg:flex-none">
          Buscar
        </Boton>
        {hayAlgo && (
          <Boton variante="secundario" icono="cerrar" onClick={alLimpiar}>
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
  criterios: Criterios
  hayFiltros: boolean
  esAdmin: boolean
  recargar: () => void
  alCambiarPagina: (pagina: number) => void
  alQuitarFiltros: () => void
}

/** «Social · En proceso»: los filtros activos, en palabras, para el contador y el mensaje vacío. */
function describirFiltros({ clasificacion, estado, residencia }: Criterios) {
  return [
    clasificacion && NOMBRE_CLASIFICACION[clasificacion],
    estado && NOMBRE_ESTADO[estado],
    residencia && `Residencia: ${residencia === FILTRO_SIN_REGISTRAR ? SIN_REGISTRAR : NOMBRE_RESIDENCIA[residencia]}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function Resultados({
  datos,
  error,
  cargando,
  criterios,
  hayFiltros,
  esAdmin,
  recargar,
  alCambiarPagina,
  alQuitarFiltros,
}: PropsResultados) {
  const { q } = criterios
  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} />
  }
  if (!datos) return <Cargando texto="Buscando carpetas…" />

  const totalPaginas = Math.max(1, Math.ceil(datos.total / datos.tamano))
  const filtros = describirFiltros(criterios)

  if (datos.total === 0) {
    return (
      <div role="status" className="rounded-3xl border border-dashed border-naranja/50 bg-white px-6 py-10 text-center">
        {hayFiltros ? (
          <>
            <p className="text-lg font-semibold text-verde-oscuro">
              {q
                ? `No encontramos carpetas para «${q}» con el filtro ${filtros}`
                : `No hay carpetas con el filtro ${filtros}`}
            </p>
            <p className="mt-1 text-suave">Prueba con otra combinación o quita los filtros.</p>
            <Boton variante="texto" icono="cerrar" className="mt-2" onClick={alQuitarFiltros}>
              Quitar filtros
            </Boton>
          </>
        ) : q ? (
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
        {hayFiltros && ` · Filtro: ${filtros}`}
      </p>

      <ul
        data-recorrido="lista-carpetas"
        className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white"
      >
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
              <span className="flex flex-wrap gap-1.5 sm:justify-end">
                <EtiquetaClasificacion clasificacion={c.clasificacion} />
                <EtiquetaEstado estado={c.estado} />
                <EtiquetaResidencia
                  ciudadResidencia={c.paciente.ciudadResidencia ?? null}
                  otraLocalidad={c.paciente.otraLocalidad ?? null}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginación"
          data-recorrido="paginacion"
          className="mt-5 flex items-center justify-between gap-3"
        >
          <Boton
            variante="secundario"
            icono="anterior"
            disabled={datos.pagina <= 1}
            onClick={() => alCambiarPagina(datos.pagina - 1)}
          >
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
            <Icono nombre="siguiente" className="size-[1.125rem]" />
          </Boton>
        </nav>
      )}
    </div>
  )
}

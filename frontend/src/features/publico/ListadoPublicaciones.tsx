import { NOMBRE_TIPO_PLURAL, type PublicacionPublica, type TipoPublicacion } from './publicaciones'
import { TarjetaPublicacion } from './TarjetaPublicacion'
import { VacioPublico } from './VacioPublico'

interface PropsCategorias {
  /** `''` = todas. */
  valor: TipoPublicacion | ''
  alCambiar: (valor: TipoPublicacion | '') => void
}

const OPCIONES: { valor: TipoPublicacion | ''; nombre: string }[] = [
  { valor: '', nombre: 'Todas' },
  ...(Object.entries(NOMBRE_TIPO_PLURAL) as [TipoPublicacion, string][]).map(([valor, nombre]) => ({ valor, nombre })),
]

/** Filtro por tipo del portal público. El servidor filtra y pagina: aquí solo se elige el tipo. */
export function CategoriasPublicaciones({ valor, alCambiar }: PropsCategorias) {
  return (
    <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
      {OPCIONES.map((opcion) => {
        const activa = opcion.valor === valor
        return (
          <button
            key={opcion.valor || 'todas'}
            type="button"
            aria-pressed={activa}
            onClick={() => alCambiar(opcion.valor)}
            className={`inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja ${
              activa ? 'border-verde bg-verde text-white' : 'border-linea bg-white text-verde hover:border-verde'
            }`}
          >
            {opcion.nombre}
          </button>
        )
      })}
    </div>
  )
}

interface PropsListado {
  publicaciones: PublicacionPublica[]
  /** Ruta del detalle público de cada publicación. */
  rutaDetalle: (id: string) => string
  /** Tipo filtrado, para decir «no hay campañas» en vez de un vacío genérico. */
  tipo?: TipoPublicacion | ''
}

/**
 * Listado de tarjetas. Conserva el orden que entrega la API. Sin publicaciones muestra un estado vacío,
 * no un error: un fallo de carga se presenta aparte con `ErrorDeCarga`, nunca como lista vacía.
 */
export function ListadoPublicaciones({ publicaciones, rutaDetalle, tipo = '' }: PropsListado) {
  if (publicaciones.length === 0) {
    return (
      <VacioPublico
        mensaje={
          tipo
            ? `Por ahora no hay ${NOMBRE_TIPO_PLURAL[tipo].toLowerCase()} publicadas.`
            : 'Por ahora no hay publicaciones. Vuelve pronto.'
        }
      />
    )
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {publicaciones.map((publicacion) => (
        <li key={publicacion.id}>
          <TarjetaPublicacion publicacion={publicacion} aDetalle={rutaDetalle(publicacion.id)} />
        </li>
      ))}
    </ul>
  )
}

import { Link } from 'react-router'
import { INSTITUCIONAL } from './institucional'

/** FE-146 · Presentación, servicios y contacto públicos, separados del expediente. */
export function PaginaFundacion() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="titulo-fundacion" className="max-w-3xl space-y-4">
        <p className="font-semibold text-naranja-texto">Personas, parejas y familias</p>
        <h1 id="titulo-fundacion" className="text-3xl font-semibold text-verde-oscuro sm:text-4xl">
          {INSTITUCIONAL.nombre}
        </h1>
        <p className="text-lg leading-relaxed text-texto">{INSTITUCIONAL.descripcion}</p>
        <Link
          to="/publicaciones"
          className="inline-flex rounded-full bg-verde px-5 py-3 font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          Conocer campañas, actividades y cursos
        </Link>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="titulo-servicios" className="rounded-3xl border border-linea bg-white p-6">
          <h2 id="titulo-servicios" className="text-xl font-semibold text-verde-oscuro">
            Atención psicológica
          </h2>
          <p className="mt-3 text-texto">Intervención con enfoque sistémico para personas, parejas y familias.</p>
          <p className="mt-3 text-suave">Consulta con la Fundación para recibir información sobre la atención.</p>
        </section>
        <section aria-labelledby="titulo-contacto" className="min-w-0 rounded-3xl border border-linea bg-white p-6">
          <h2 id="titulo-contacto" className="text-xl font-semibold text-verde-oscuro">
            Contacto
          </h2>
          <address className="mt-3 space-y-3 break-words not-italic text-texto">
            <p>
              <a
                href={`tel:${INSTITUCIONAL.telefono.replace(/\s/g, '')}`}
                className="font-semibold text-naranja-texto underline underline-offset-4"
              >
                Llamar al {INSTITUCIONAL.telefono}
              </a>
            </p>
            <p>{INSTITUCIONAL.direccion}</p>
            <p>La Paz, Bolivia</p>
          </address>
        </section>
      </div>
    </div>
  )
}

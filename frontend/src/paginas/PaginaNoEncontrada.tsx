import { Link } from 'react-router'

export function PaginaNoEncontrada() {
  return (
    <div className="max-w-prose py-6">
      <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">No encontramos esta página</h1>
      <p className="mt-3 text-suave">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
      <Link
        to="/inicio"
        className="mt-6 inline-block font-semibold text-naranja-texto underline-offset-4 hover:underline"
      >
        Volver al inicio
      </Link>
    </div>
  )
}

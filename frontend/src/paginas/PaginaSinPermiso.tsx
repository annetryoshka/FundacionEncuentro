import { Link } from 'react-router'

export function PaginaSinPermiso() {
  return (
    <div className="max-w-prose py-6">
      <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">
        Esta sección no está disponible para tu cuenta
      </h1>
      <p className="mt-3 text-suave">
        Tu rol no tiene permiso para ver esta información. Si crees que deberías tenerlo, pídeselo a la dirección del
        centro.
      </p>
      <Link
        to="/inicio"
        className="mt-6 inline-block font-semibold text-naranja-texto underline-offset-4 hover:underline"
      >
        Volver al inicio
      </Link>
    </div>
  )
}

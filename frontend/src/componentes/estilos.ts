/** Clases de Tailwind compartidas (fuera de los .tsx para no romper Fast Refresh). */

export function claseCampo(conError: boolean) {
  const base =
    'mt-1.5 block w-full rounded-xl border bg-white px-4 py-3 text-base text-texto transition-colors focus:outline-3 focus:outline-offset-0 disabled:bg-crema'
  return conError
    ? `${base} border-error focus:outline-error/20`
    : `${base} border-linea hover:border-suave focus:border-verde focus:outline-verde/20`
}

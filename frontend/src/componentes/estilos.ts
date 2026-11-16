/** Clases de Tailwind compartidas (fuera de los .tsx para no romper Fast Refresh). */

export function claseCampo(conError: boolean) {
  const base =
    'mt-1.5 block w-full rounded-xl border bg-white px-4 py-3 text-base text-texto transition-colors focus:outline-3 focus:outline-offset-0 disabled:bg-crema'
  return conError
    ? `${base} border-error focus:outline-error/20`
    : `${base} border-linea hover:border-suave focus:border-verde focus:outline-verde/20`
}

export type VarianteBoton = 'primario' | 'secundario' | 'texto'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-verde text-white hover:bg-verde-oscuro px-5 py-3',
  secundario: 'border border-verde bg-white text-verde hover:bg-verde hover:text-white px-5 py-2.5',
  texto: 'text-naranja-texto hover:text-naranja px-2 py-1.5 underline-offset-4 hover:underline',
}

/** Aspecto de botón, también para enlaces que llevan a una acción (p. ej. «Registrar paciente»). */
export function claseBoton(variante: VarianteBoton = 'primario') {
  return `inline-flex items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja disabled:cursor-not-allowed disabled:opacity-70 ${ESTILO_BOTON[variante]}`
}

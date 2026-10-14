/**
 * Piezas de la identidad visual de Fundación Encuentro, tomadas del afiche
 * "Encuentro con tu Bienestar": logo, ondas naranja/verde y corazón de trazo.
 */
import logo from '../assets/logo-fundacion-encuentro.webp'

export const TELEFONO = '+591 77263336'
export const DIRECCION = 'Calle 11 de Obrajes Nº 169, frente al colegio "Linderman"'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="Fundación Encuentro, «Jiwasanaka» para el buen camino"
      width={400}
      height={400}
      className={`rounded-full ${className}`}
    />
  )
}

/** Franja naranja de la esquina superior del afiche. */
export function OndaSuperior({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 170" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M70 0H320V165C262 78 176 24 70 0Z" fill="var(--color-naranja)" />
      <path d="M38 0H64C170 22 258 74 320 160V172C252 84 160 26 38 0Z" fill="var(--color-verde)" />
    </svg>
  )
}

/** Ola verde con borde naranja de la parte baja del afiche. */
export function OndaInferior({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 90" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 30C170 -6 360 58 600 8V20C360 70 170 6 0 42Z" fill="var(--color-naranja)" />
      <path d="M0 42C170 6 360 70 600 20V90H0Z" fill="var(--color-verde)" />
    </svg>
  )
}

export function Corazon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
      />
    </svg>
  )
}

/** Franja de contacto del pie del afiche. */
export function PieContacto() {
  return (
    <footer className="bg-naranja-pie px-4 py-3 text-sm text-white sm:px-8">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
        <p className="flex items-start gap-2">
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          {DIRECCION}
        </p>
        <span className="hidden h-5 w-px bg-white/50 sm:block" aria-hidden="true" />
        <p className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
          </svg>
          <a href={`tel:${TELEFONO.replace(/\s/g, '')}`} className="font-semibold underline-offset-2 hover:underline">
            {TELEFONO}
          </a>
        </p>
      </div>
    </footer>
  )
}

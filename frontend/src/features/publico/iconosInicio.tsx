/** Iconos de trazo de la página de inicio pública (mismo estilo que componentes/iconos). */
const TRAZOS = {
  mensaje: <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" />,
  telefono: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  externo: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  hablar: (
    <>
      <circle cx="8" cy="7" r="3" />
      <circle cx="16" cy="7" r="3" />
      <path d="M2.5 19a5.5 5.5 0 0 1 9.5-3.8A5.5 5.5 0 0 1 21.5 19" />
      <path d="M12 21s-2.5-1.5-2.5-3.2a1.3 1.3 0 0 1 2.5-.6 1.3 1.3 0 0 1 2.5.6C14.5 19.5 12 21 12 21Z" />
    </>
  ),
  comprender: (
    <>
      <path d="M15 21v-3.5h2.5a1.5 1.5 0 0 0 1.5-1.5v-2.5l1.6-.7a.6.6 0 0 0 .2-.9L19 9.5A7 7 0 1 0 8 15.3V21" />
      <path d="M12.5 12.5s-2.5-1.5-2.5-3.2a1.3 1.3 0 0 1 2.5-.6 1.3 1.3 0 0 1 2.5.6c0 1.7-2.5 3.2-2.5 3.2Z" />
    </>
  ),
  vinculos: (
    <>
      <path d="M12 9s-2.5-1.5-2.5-3.2a1.3 1.3 0 0 1 2.5-.6 1.3 1.3 0 0 1 2.5.6C14.5 7.5 12 9 12 9Z" />
      <path d="M2 14l3.5-1.5a2 2 0 0 1 1.6 0L11 14.5a1.2 1.2 0 0 1-1 2.2L7.5 16" />
      <path d="M2 19h3l5 1.5 5-2 6.5-4a1.4 1.4 0 0 0-1.6-2.3L15 14.5" />
    </>
  ),
  familia: (
    <>
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <circle cx="12" cy="11.5" r="2" />
      <path d="M3 20v-5a4 4 0 0 1 6.5-3.1M21 20v-5a4 4 0 0 0-6.5-3.1M8.5 20v-2.5a3.5 3.5 0 0 1 7 0V20" />
    </>
  ),
  formacion: (
    <>
      <path d="m2 9 10-5 10 5-10 5-10-5Z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6" />
    </>
  ),
  instituciones: (
    <>
      <path d="M3 21h18M4 10h16M12 3l8 5H4l8-5Z" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
    </>
  ),
  hoja: (
    <>
      <path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Z" />
      <path d="M5 19c3-4 6-7 10-9" />
    </>
  ),
}

export type NombreIconoInicio = keyof typeof TRAZOS

export function IconoInicio({ nombre, className = 'size-5' }: { nombre: NombreIconoInicio; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}

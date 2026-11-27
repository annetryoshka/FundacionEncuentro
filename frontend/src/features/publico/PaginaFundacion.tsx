import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useCarga } from '../../api/useCarga'
import familia from '../../assets/inicio-familia.webp'
import trayectoria from '../../assets/inicio-trayectoria.webp'
import { Corazon, Logo, OndaSuperior } from '../../componentes/marca'
import { listarPublicadas } from '../difusion/difusion'
import { IconoInicio, type NombreIconoInicio } from './iconosInicio'
import { ENLACE_TELEFONO, ENLACE_WHATSAPP, INSTITUCIONAL } from './institucional'
import { TarjetaPublicacion } from './TarjetaPublicacion'

const ENFOQUE = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja'
const BOTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-colors ${ENFOQUE}`

const NECESIDADES: { icono: NombreIconoInicio; antes: string; resalte: string; color: 'naranja' | 'verde' }[] = [
  { icono: 'hablar', antes: 'A veces necesitamos', resalte: 'hablar', color: 'naranja' },
  { icono: 'comprender', antes: 'A veces necesitamos', resalte: 'comprender lo que estamos viviendo', color: 'verde' },
  {
    icono: 'vinculos',
    antes: 'A veces necesitamos',
    resalte: 'ayuda para reconstruir nuestros vínculos',
    color: 'naranja',
  },
]

const SERVICIOS: { icono: NombreIconoInicio; titulo: string; para: string; texto: string }[] = [
  {
    icono: 'familia',
    titulo: 'Terapia familiar sistémica',
    para: 'Personas, parejas y familias',
    texto:
      'Atención psicológica que mira a la persona junto a sus vínculos: acompañamos crisis, conflictos y cambios para que cada familia encuentre su propio camino.',
  },
  {
    icono: 'formacion',
    titulo: 'Formación de profesionales',
    para: 'Profesionales de la salud, lo social y la educación',
    texto:
      'Especialización en intervención sistémica contra la violencia y por la vida, para quienes trabajan con niñas, niños, adolescentes y familias.',
  },
  {
    icono: 'instituciones',
    titulo: 'Programas para instituciones',
    para: 'Instituciones y comunidades',
    texto:
      'Programas de promoción de la salud mental y prevención del maltrato y la violencia, como el desarrollado en El Alto.',
  },
]

const TRAYECTORIA = [
  'Servicio de Terapia Familiar «Encuentro» en Obrajes, La Paz.',
  'Especialidad en «Intervención sistémica contra la violencia y por la vida».',
  'Programa de promoción de salud mental y prevención del maltrato y la violencia en El Alto.',
  'Formación de posgrado en intervención social sistémica intercultural con niñas, niños, adolescentes y familias.',
]

/** Página de inicio pública de la Fundación: presentación, servicios, actividades y contacto. */
export function PaginaFundacion() {
  const { hash } = useLocation()

  // Los enlaces del encabezado (p. ej. «/#contacto») llevan a la sección al venir de otra página.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.()
  }, [hash])

  return (
    <>
      <Portada />
      <Necesidades />
      <Servicios />
      <Trayectoria />
      <Actividades />
      <Contacto />
    </>
  )
}

function Portada() {
  return (
    <section aria-labelledby="titulo-inicio" className="relative overflow-hidden bg-crema">
      <OndaSuperior className="pointer-events-none absolute -top-2 right-0 h-28 w-44 sm:h-40 sm:w-72 lg:h-52 lg:w-96" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-16 lg:pb-24">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-naranja-texto uppercase">Salud mental · La Paz</p>
          <h1 id="titulo-inicio" className="mt-3 font-script leading-[0.95]">
            <span className="block text-6xl text-naranja sm:text-7xl">Encuentro</span>{' '}
            <span className="block pl-10 text-4xl text-verde sm:text-5xl">con tu</span>{' '}
            <span className="block text-6xl text-verde-oscuro sm:text-7xl">Bienestar</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-texto">{INSTITUCIONAL.descripcion}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={ENLACE_WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className={`${BOTON} bg-verde text-white hover:bg-verde-oscuro`}
            >
              <IconoInicio nombre="mensaje" />
              Escríbenos por WhatsApp
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
            <a
              href={ENLACE_TELEFONO}
              className={`${BOTON} border-2 border-verde bg-white text-verde hover:bg-verde hover:text-white`}
            >
              <IconoInicio nombre="telefono" />
              Llamar al {INSTITUCIONAL.telefono}
            </a>
          </div>
          <ul className="mt-8 flex flex-col gap-3 text-sm text-suave sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li className="flex items-center gap-2">
              <IconoInicio nombre="reloj" className="size-5 text-verde" />
              {INSTITUCIONAL.horario}
            </li>
            <li className="flex items-center gap-2">
              <IconoInicio nombre="ubicacion" className="size-5 text-verde" />
              {INSTITUCIONAL.zona}
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute -inset-3 -rotate-2 rounded-[2.5rem] bg-naranja/15" aria-hidden="true" />
          <img
            src={familia}
            alt="Una terapeuta conversa con una familia sonriente en un consultorio"
            width={905}
            height={422}
            className="relative aspect-[4/3] w-full rounded-[2rem] object-cover object-[60%_center] shadow-lg sm:aspect-[905/422] lg:aspect-[4/3.4]"
          />
          <div className="relative -mt-10 ml-4 flex w-fit items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-md sm:ml-8">
            <Logo className="size-11 shrink-0" />
            <p className="font-script text-xl text-verde-oscuro">{INSTITUCIONAL.lema}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Necesidades() {
  return (
    <section aria-labelledby="titulo-necesidades" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <h2 id="titulo-necesidades" className="sr-only">
          Por qué acudir a terapia
        </h2>
        <ul className="grid gap-14 md:grid-cols-3 md:gap-5">
          {NECESIDADES.map(({ icono, antes, resalte, color }) => (
            <li
              key={resalte}
              className={`flex flex-col items-center rounded-3xl border-2 px-6 pt-10 pb-8 text-center ${color === 'naranja' ? 'border-naranja/40' : 'border-verde/40'}`}
            >
              <span
                className={`-mt-16 mb-5 grid size-16 place-items-center rounded-full text-white shadow-md ring-8 ring-white ${color === 'naranja' ? 'bg-naranja-pie' : 'bg-verde'}`}
              >
                <IconoInicio nombre={icono} className="size-8" />
              </span>
              <p className="text-lg text-texto">
                {antes}{' '}
                <strong
                  className={`block font-semibold ${color === 'naranja' ? 'text-naranja-texto' : 'text-verde-oscuro'}`}
                >
                  {resalte}
                </strong>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-center font-script text-3xl sm:text-4xl">
          <span className="text-verde-oscuro">Escuchamos</span>
          <span className="text-naranja-texto">Comprendemos</span>
          <span className="text-verde-oscuro">Acompañamos</span>
          <Corazon className="size-7 text-naranja" />
        </p>
      </div>
    </section>
  )
}

function Servicios() {
  return (
    <section id="servicios" aria-labelledby="titulo-servicios" className="scroll-mt-24 bg-crema py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <Encabezado
          id="titulo-servicios"
          antetitulo="Lo que hacemos"
          titulo="Servicios para familias, profesionales e instituciones"
        />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {SERVICIOS.map(({ icono, titulo, para, texto }) => (
            <li key={titulo} className="flex flex-col rounded-3xl border border-linea bg-white p-7">
              <span className="grid size-14 place-items-center rounded-2xl bg-verde/10 text-verde">
                <IconoInicio nombre={icono} className="size-7" />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-verde-oscuro">{titulo}</h3>
              <p className="mt-1 text-sm font-semibold text-naranja-texto">{para}</p>
              <p className="mt-3 leading-relaxed text-texto">{texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Trayectoria() {
  return (
    <section
      id="nosotros"
      aria-labelledby="titulo-nosotros"
      className="scroll-mt-24 bg-verde-oscuro py-16 text-white sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:gap-14">
        <figure>
          <img
            src={trayectoria}
            alt="Folletos de la Fundación: Servicio de Terapia Familiar «Encuentro», especialidad en intervención sistémica contra la violencia y programa «Alto a la violencia» en El Alto"
            width={960}
            height={720}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-xl"
          />
          <figcaption className="mt-3 text-sm text-white/85">
            Materiales de formación y programas de la Fundación.
          </figcaption>
        </figure>
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-white/85 uppercase">Quiénes somos</p>
          <h2 id="titulo-nosotros" className="mt-3 text-3xl font-semibold sm:text-4xl">
            <span className="font-script text-4xl font-normal sm:text-5xl">“Jiwasanaka”</span>, para el buen camino
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/95">
            <em>Jiwasanaka</em> significa «nosotros» en aymara. Así entendemos la salud mental: como algo que se
            construye en familia y en comunidad. Somos un centro de atención terapéutica que trabaja con enfoque
            sistémico.
          </p>
          <h3 className="mt-8 font-semibold">Nuestro recorrido incluye</h3>
          <ul className="mt-3 space-y-3">
            {TRAYECTORIA.map((linea) => (
              <li key={linea} className="flex gap-3 text-white/95">
                <IconoInicio nombre="hoja" className="mt-0.5 size-5 shrink-0 text-verde-claro" />
                {linea}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Actividades() {
  const { datos, error } = useCarga(() => listarPublicadas({ tipo: '', pagina: 1 }), [])
  const recientes = datos?.publicaciones.slice(0, 3) ?? []

  return (
    <section id="actividades" aria-labelledby="titulo-actividades" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Encabezado id="titulo-actividades" antetitulo="Comunidad" titulo="Campañas, actividades y cursos" />
          <Link
            to="/publicaciones"
            className={`${BOTON} shrink-0 border-2 border-verde text-verde hover:bg-verde hover:text-white`}
          >
            Ver todas
            <IconoInicio nombre="flecha" />
          </Link>
        </div>
        {recientes.length > 0 ? (
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {recientes.map((p) => (
              <li key={p.id}>
                <TarjetaPublicacion publicacion={p} aDetalle={`/publicaciones/${p.id}`} />
              </li>
            ))}
          </ul>
        ) : (
          (datos || error !== undefined) && (
            <p className="mt-8 rounded-3xl bg-crema px-6 py-8 text-center text-suave">
              Pronto compartiremos nuevas actividades. Mientras tanto, escríbenos para conocer los próximos cursos.
            </p>
          )
        )}
      </div>
    </section>
  )
}

function Contacto() {
  return (
    <section id="contacto" aria-labelledby="titulo-contacto" className="scroll-mt-24 bg-crema py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <Encabezado id="titulo-contacto" antetitulo="Visítanos" titulo="Contacto y ubicación" />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col rounded-3xl border border-linea bg-white p-7">
            <address className="space-y-5 not-italic">
              <DatoContacto icono="ubicacion" titulo="Dirección">
                {INSTITUCIONAL.direccion}
                <span className="block text-suave">{INSTITUCIONAL.zona}</span>
                <a
                  href={INSTITUCIONAL.comoLlegar}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-1 inline-flex items-center gap-1 rounded font-semibold text-naranja-texto underline underline-offset-4 ${ENFOQUE}`}
                >
                  Cómo llegar
                  <IconoInicio nombre="externo" className="size-4" />
                  <span className="sr-only">(se abre en otra pestaña)</span>
                </a>
              </DatoContacto>
              <DatoContacto icono="telefono" titulo="Teléfono y WhatsApp">
                <a
                  href={ENLACE_TELEFONO}
                  className={`rounded font-semibold text-verde-oscuro underline underline-offset-4 ${ENFOQUE}`}
                >
                  {INSTITUCIONAL.telefono}
                </a>
              </DatoContacto>
              <DatoContacto icono="correo" titulo="Correo">
                <a
                  href={`mailto:${INSTITUCIONAL.correo}`}
                  className={`rounded break-all text-verde-oscuro underline underline-offset-4 ${ENFOQUE}`}
                >
                  {INSTITUCIONAL.correo}
                </a>
              </DatoContacto>
              <DatoContacto icono="reloj" titulo="Horario de atención">
                {INSTITUCIONAL.horario}
              </DatoContacto>
            </address>
            <a
              href={ENLACE_WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className={`${BOTON} mt-8 bg-verde text-white hover:bg-verde-oscuro`}
            >
              <IconoInicio nombre="mensaje" />
              Agenda tu consulta
              <span className="sr-only">por WhatsApp (se abre en otra pestaña)</span>
            </a>
          </div>
          <div className="min-h-80 overflow-hidden rounded-3xl border border-linea bg-white">
            <iframe
              src={INSTITUCIONAL.mapaEmbed}
              title="Mapa: ubicación de la Fundación Encuentro en Obrajes, La Paz"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="block h-full min-h-80 w-full border-0"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function Encabezado({ id, antetitulo, titulo }: { id: string; antetitulo: string; titulo: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-naranja-texto uppercase">{antetitulo}</p>
      <h2 id={id} className="mt-2 text-3xl font-semibold text-verde-oscuro sm:text-4xl">
        {titulo}
      </h2>
    </div>
  )
}

function DatoContacto({ icono, titulo, children }: { icono: NombreIconoInicio; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-naranja/10 text-naranja-texto">
        <IconoInicio nombre={icono} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-suave">{titulo}</p>
        <p className="text-texto">{children}</p>
      </div>
    </div>
  )
}

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Corazon, Logo, OndaInferior, OndaSuperior, PieContacto } from '../../componentes/marca'
import { iniciarSesion, mensajeErrorLogin } from './authApi'
import { useSesion } from './sesion'
import { hayErrores, validarLogin, type ErroresLogin } from './validacion'

/** FE-21 · Formulario de acceso (historia FE-20). */
export function PaginaLogin() {
  const { usuario, recuperando, guardarSesion, avisoSalida } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/inicio'

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [errores, setErrores] = useState<ErroresLogin>({})
  const [intentoEnvio, setIntentoEnvio] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mayusculas, setMayusculas] = useState(false)

  const refCorreo = useRef<HTMLInputElement>(null)
  const refContrasena = useRef<HTMLInputElement>(null)
  const refErrorServidor = useRef<HTMLDivElement>(null)
  const id = useId()

  if (usuario) return <Navigate to={destino} replace />
  if (recuperando) return null

  // Tras el primer intento, los errores se corrigen mientras la persona escribe.
  const revalidar = (siguiente: { correo: string; contrasena: string }) => {
    if (intentoEnvio) setErrores(validarLogin(siguiente))
  }

  const detectarMayusculas = (evento: KeyboardEvent<HTMLInputElement>) => {
    setMayusculas(evento.getModifierState?.('CapsLock') ?? false)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (cargando) return

    setIntentoEnvio(true)
    setErrorServidor(null)
    const encontrados = validarLogin({ correo, contrasena })
    setErrores(encontrados)
    if (hayErrores(encontrados)) {
      ;(encontrados.correo ? refCorreo : refContrasena).current?.focus()
      return
    }

    setCargando(true)
    try {
      const respuesta = await iniciarSesion({ email: correo.trim(), password: contrasena })
      guardarSesion(respuesta)
      navegar(destino, { replace: true })
    } catch (error) {
      // La contraseña no se conserva tras un intento fallido.
      setContrasena('')
      setVerContrasena(false)
      setErrorServidor(mensajeErrorLogin(error))
      setCargando(false)
      requestAnimationFrame(() => refErrorServidor.current?.focus())
    }
  }

  const idErrorCorreo = `${id}-error-correo`
  const idErrorContrasena = `${id}-error-contrasena`
  const idAvisoMayus = `${id}-mayus`

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1 lg:grid lg:grid-cols-2">
        {/* Panel de marca: como el afiche "Encuentro con tu Bienestar" */}
        <aside className="relative flex flex-col overflow-hidden bg-white">
          <OndaSuperior className="absolute top-0 right-0 h-20 w-36 sm:h-24 sm:w-44 lg:h-44 lg:w-80" />

          <div className="relative flex flex-1 flex-col items-center px-4 pt-6 pb-4 text-center sm:px-8 lg:items-start lg:justify-center lg:px-14 lg:pt-12 lg:pb-8 lg:text-left xl:px-20">
            <Logo className="size-24 sm:size-28 lg:size-40" />

            <p className="mt-3 -rotate-2 font-script leading-none lg:mt-8">
              <span className="text-4xl text-naranja sm:text-5xl lg:block lg:text-7xl">Encuentro</span>{' '}
              <span className="text-2xl text-verde sm:text-3xl lg:mt-1 lg:block lg:pl-24 lg:text-4xl">con tu</span>{' '}
              <span className="text-4xl text-verde-oscuro sm:text-5xl lg:block lg:text-7xl">Bienestar</span>
            </p>

            <p className="mt-10 hidden items-center gap-3 font-script text-2xl lg:flex xl:text-3xl">
              <span className="text-verde">Escuchamos</span>
              <span className="text-naranja">Comprendemos</span>
              <span className="text-verde-oscuro">Acompañamos</span>
              <Corazon className="size-6 text-naranja" />
            </p>
          </div>

          <div className="relative">
            <OndaInferior className="block h-10 w-full sm:h-12 lg:h-20" />
            <div className="hidden bg-verde px-14 pt-1 pb-10 text-white lg:block xl:px-20">
              <p className="font-script text-3xl">Terapia familiar sistémica</p>
              <p className="mt-2 max-w-md text-white/90">
                Acompañamos a tu familia en el camino hacia una vida más sana y en armonía.
              </p>
            </div>
          </div>
        </aside>

        {/* Formulario */}
        <main className="flex justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-md rounded-3xl border border-linea bg-white px-5 py-7 shadow-[0_12px_40px_-24px_rgb(14_120_54/0.35)] sm:px-9 sm:py-10">
            <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Iniciar sesión</h1>
            <p className="mt-2 text-suave">Usa el correo y la contraseña que te dio la dirección.</p>

            {avisoSalida && !errorServidor && (
              <p
                role="status"
                className="mt-5 rounded-xl border-l-4 border-naranja bg-naranja/8 px-4 py-3 text-sm text-texto"
              >
                {avisoSalida}
              </p>
            )}

            <form noValidate onSubmit={enviar} className="mt-7" aria-busy={cargando}>
              <fieldset disabled={cargando} className="space-y-5">
                <legend className="sr-only">Datos de acceso</legend>

                {/* Correo */}
                <div>
                  <label htmlFor={`${id}-correo`} className="block text-sm font-semibold text-texto">
                    Correo electrónico
                  </label>
                  <input
                    ref={refCorreo}
                    id={`${id}-correo`}
                    name="correo"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={correo}
                    onChange={(e) => {
                      setCorreo(e.target.value)
                      revalidar({ correo: e.target.value, contrasena })
                    }}
                    aria-invalid={errores.correo ? true : undefined}
                    aria-describedby={errores.correo ? idErrorCorreo : undefined}
                    className={claseCampo(Boolean(errores.correo))}
                  />
                  {errores.correo && (
                    <p id={idErrorCorreo} className="mt-1.5 text-sm text-error">
                      {errores.correo}
                    </p>
                  )}
                </div>

                {/* Contraseña */}
                <div>
                  <label htmlFor={`${id}-contrasena`} className="block text-sm font-semibold text-texto">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      ref={refContrasena}
                      id={`${id}-contrasena`}
                      name="contrasena"
                      type={verContrasena ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={contrasena}
                      onChange={(e) => {
                        setContrasena(e.target.value)
                        revalidar({ correo, contrasena: e.target.value })
                      }}
                      onKeyUp={detectarMayusculas}
                      onKeyDown={detectarMayusculas}
                      onBlur={() => setMayusculas(false)}
                      aria-invalid={errores.contrasena ? true : undefined}
                      aria-describedby={
                        [errores.contrasena && idErrorContrasena, mayusculas && idAvisoMayus]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      className={`${claseCampo(Boolean(errores.contrasena))} pr-24`}
                    />
                    <button
                      type="button"
                      onClick={() => setVerContrasena((v) => !v)}
                      aria-controls={`${id}-contrasena`}
                      aria-pressed={verContrasena}
                      className="absolute inset-y-0 right-0 mt-1.5 rounded-r-xl px-4 text-sm font-semibold text-naranja-texto hover:text-naranja focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verde"
                    >
                      {verContrasena ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {errores.contrasena && (
                    <p id={idErrorContrasena} className="mt-1.5 text-sm text-error">
                      {errores.contrasena}
                    </p>
                  )}
                  {mayusculas && (
                    <p id={idAvisoMayus} className="mt-1.5 text-sm text-suave">
                      Bloq Mayús está activado.
                    </p>
                  )}
                </div>

                {errorServidor && (
                  <div
                    ref={refErrorServidor}
                    role="alert"
                    tabIndex={-1}
                    className="rounded-xl border-l-4 border-error bg-error-fondo px-4 py-3 text-sm text-error focus:outline-none"
                  >
                    {errorServidor}
                  </div>
                )}

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-full bg-verde px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-verde-oscuro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja disabled:cursor-wait disabled:opacity-80"
                >
                  {cargando && <Indicador />}
                  {cargando ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>
              </fieldset>
            </form>

            <p className="mt-7 border-t border-linea pt-5 text-sm text-suave">
              ¿Olvidaste tu contraseña o necesitas una cuenta? Pídesela a la dirección del centro.
            </p>
          </div>
        </main>
      </div>

      <PieContacto />
    </div>
  )
}

function claseCampo(conError: boolean) {
  const base =
    'mt-1.5 block w-full rounded-xl border bg-white px-4 py-3 text-base text-texto transition-colors focus:outline-3 focus:outline-offset-0 disabled:bg-crema'
  return conError
    ? `${base} border-error focus:outline-error/20`
    : `${base} border-linea hover:border-suave focus:border-verde focus:outline-verde/20`
}

function Indicador() {
  return (
    <svg className="size-4 animate-spin motion-reduce:hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorApi } from '../../../api/cliente'
import { useCarga } from '../../../api/useCarga'
import { ErrorDeCarga } from '../../../componentes/ErrorDeCarga'
import { AreaTexto, Aviso, Boton, Cargando, GrupoOpciones, Insignia, Tarjeta } from '../../../componentes/ui'
import { fechaLarga } from '../../../utilidades/fechas'
import { useSesion } from '../../auth/sesion'
import type { CarpetaDetalle } from '../../carpetas/tipos'
import { crearNombrador } from '../autoria'
import { mensajeNoGuardado } from '../errores'
import { listarSesiones } from '../expedienteApi'
import { SeccionCarpeta } from '../SeccionCarpeta'
import { CAMPO_FALTANTE, NOMBRE_TIPO_INFORME, generarInforme, listarInformes, type TipoInforme } from './informes'

const TIPOS: { valor: TipoInforme; nombre: string; descripcion: string }[] = [
  {
    valor: 'intervencion_sistemica',
    nombre: NOMBRE_TIPO_INFORME.intervencion_sistemica,
    descripcion: 'Evaluación, intervención y evolución del caso.',
  },
  {
    valor: 'judicial',
    nombre: NOMBRE_TIPO_INFORME.judicial,
    descripcion: 'Para el juzgado que derivó el caso. Necesita el juzgado y el objeto del informe.',
  },
]

/** FE-154 · Elegir plantilla y datos, y generar el borrador del informe. */
export function PaginaInformes() {
  return <SeccionCarpeta titulo="Informes">{(carpeta) => <GenerarInforme carpeta={carpeta} />}</SeccionCarpeta>
}

function GenerarInforme({ carpeta }: { carpeta: CarpetaDetalle }) {
  const navegar = useNavigate()
  const sesiones = useCarga(() => listarSesiones(carpeta.id), [carpeta.id])
  const [tipo, setTipo] = useState<TipoInforme | ''>('')
  const [elegidas, setElegidas] = useState<string[] | null>(null)
  const [incluirFamilia, setIncluirFamilia] = useState(true)
  const [incluirGenograma, setIncluirGenograma] = useState(false)
  const [objeto, setObjeto] = useState('')
  const [errores, setErrores] = useState<{ tipo?: string; objeto?: string }>({})
  const [generando, setGenerando] = useState(false)
  const [fallo, setFallo] = useState<{ texto: string; faltan?: string[] } | null>(null)
  const refObjeto = useRef<HTMLTextAreaElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)

  // Por defecto se incluyen todas las sesiones, en orden.
  const lista = sesiones.datos ?? []
  const seleccion = elegidas ?? lista.map((s) => s.id)

  async function generar(evento: FormEvent) {
    evento.preventDefault()
    if (generando) return
    const e: typeof errores = {}
    if (!tipo) e.tipo = 'Elige la plantilla del informe.'
    if (tipo === 'judicial' && !objeto.trim()) e.objeto = 'Escribe qué solicitó el juzgado (objeto del informe).'
    setErrores(e)
    setFallo(null)
    if (e.tipo) return
    if (e.objeto) return refObjeto.current?.focus()

    setGenerando(true)
    try {
      const version = await generarInforme(carpeta.id, {
        tipo: tipo as TipoInforme,
        sesionesIds: lista.filter((s) => seleccion.includes(s.id)).map((s) => s.id),
        incluirFamilia,
        incluirGenograma,
        ...(tipo === 'judicial' ? { objeto: objeto.trim() } : {}),
      })
      navegar(`/carpetas/${carpeta.id}/informes/${version.id}`, { state: { recienGenerado: true } })
    } catch (error) {
      setGenerando(false)
      if (error instanceof ErrorApi && error.estado === 422) {
        const faltan = Array.isArray(error.datos.camposFaltantes) ? (error.datos.camposFaltantes as string[]) : []
        setFallo({ texto: 'Faltan datos para generar el informe:', faltan })
        if (faltan.includes('objeto')) setErrores({ objeto: 'Escribe el objeto del informe.' })
      } else {
        setFallo({ texto: mensajeNoGuardado(error).replace('No se guardó', 'No se generó') })
      }
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-suave">
        El sistema arma un borrador con los datos del caso; después lo revisas y corriges antes de usarlo. El borrador
        conserva los datos del momento en que se generó.
      </p>
      <Tarjeta>
        <form noValidate onSubmit={generar}>
          <fieldset disabled={generando} className="space-y-5">
            <legend className="text-lg font-semibold text-verde-oscuro">Generar informe</legend>
            <GrupoOpciones
              leyenda="Plantilla"
              nombre="tipo-informe"
              opciones={TIPOS}
              valor={tipo}
              alCambiar={setTipo}
              error={errores.tipo}
            />

            {tipo === 'judicial' && (
              <AreaTexto
                ref={refObjeto}
                etiqueta="Objeto del informe"
                rows={3}
                value={objeto}
                error={errores.objeto}
                ayuda="Lo que el juzgado solicitó informar."
                onChange={(e) => setObjeto(e.target.value)}
              />
            )}

            <fieldset>
              <legend className="text-sm font-semibold text-texto">Sesiones que se incluyen</legend>
              {sesiones.error !== undefined ? (
                <ErrorDeCarga
                  error={sesiones.error}
                  alReintentar={sesiones.recargar}
                  contexto="No se pudieron cargar las sesiones."
                  className="mt-2"
                />
              ) : !sesiones.datos ? (
                <Cargando texto="Cargando sesiones…" />
              ) : lista.length === 0 ? (
                <p className="mt-1.5 text-sm text-suave">
                  El caso todavía no tiene sesiones: el informe saldrá sin seguimiento.
                </p>
              ) : (
                <div className="mt-1.5 grid gap-2">
                  {lista.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 text-texto">
                      <input
                        type="checkbox"
                        className="size-4 accent-verde"
                        checked={seleccion.includes(s.id)}
                        onChange={(e) =>
                          setElegidas(e.target.checked ? [...seleccion, s.id] : seleccion.filter((x) => x !== s.id))
                        }
                      />
                      Sesión {s.numero} · {fechaLarga(s.fecha)}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-texto">Otros datos</legend>
              <div className="mt-1.5 grid gap-2">
                <label className="flex items-center gap-3 text-texto">
                  <input
                    type="checkbox"
                    className="size-4 accent-verde"
                    checked={incluirFamilia}
                    onChange={(e) => setIncluirFamilia(e.target.checked)}
                  />
                  Composición familiar
                </label>
                <label className="flex items-center gap-3 text-texto">
                  <input
                    type="checkbox"
                    className="size-4 accent-verde"
                    checked={incluirGenograma}
                    onChange={(e) => setIncluirGenograma(e.target.checked)}
                  />
                  Referencia al genograma
                </label>
              </div>
            </fieldset>

            {fallo && (
              <Aviso ref={refFallo} tipo="error">
                <p>{fallo.texto}</p>
                {fallo.faltan && fallo.faltan.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {fallo.faltan.map((c) => {
                      const info = CAMPO_FALTANTE[c] ?? { texto: c }
                      return (
                        <li key={c}>
                          Falta {info.texto}
                          {info.apartado !== undefined && (
                            <>
                              {' · '}
                              <Link
                                to={`/carpetas/${carpeta.id}/${info.apartado}`}
                                className="font-semibold underline underline-offset-2"
                              >
                                completarlo
                              </Link>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Aviso>
            )}

            <Boton type="submit" icono="informe" cargando={generando} textoCargando="Generando borrador…">
              Generar borrador
            </Boton>
          </fieldset>
        </form>
      </Tarjeta>
      <InformesDelCaso carpeta={carpeta} />
    </div>
  )
}

/** Borradores y versiones revisadas ya generados, para volver a abrirlos. */
function InformesDelCaso({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => listarInformes(carpeta.id), [carpeta.id])
  const nombre = crearNombrador(carpeta, usuario)

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Informes del caso</h2>
      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar los informes." className="mt-2" />
      ) : !datos ? (
        <Cargando texto="Cargando informes…" />
      ) : datos.length === 0 ? (
        <p className="mt-1.5 text-sm text-suave">Todavía no se generó ningún informe para este caso.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linea">
          {datos.map((i) => {
            const esBorrador = i.estado === 'borrador'
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-texto">{NOMBRE_TIPO_INFORME[i.tipo]}</span>
                    <Insignia color={esBorrador ? 'naranja' : 'verde'}>{esBorrador ? 'Borrador' : 'Revisado'}</Insignia>
                  </div>
                  <p className="mt-0.5 text-sm text-suave">
                    Generado por {nombre(i.creadoPor)} el {fechaLarga(i.creadoEn)}
                    {i.revisadoEn && ` · revisado el ${fechaLarga(i.revisadoEn)}`}
                  </p>
                </div>
                <Link
                  to={`/carpetas/${carpeta.id}/informes/${i.id}`}
                  aria-label={`${esBorrador ? 'Revisar borrador' : 'Abrir'}: ${NOMBRE_TIPO_INFORME[i.tipo]} del ${fechaLarga(i.creadoEn)}`}
                  className="inline-flex min-h-11 items-center font-semibold text-naranja-texto underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
                >
                  {esBorrador ? 'Revisar borrador' : 'Abrir'}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}

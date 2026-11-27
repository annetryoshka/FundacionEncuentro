import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import {
  AreaTexto,
  Aviso,
  Boton,
  CampoSeleccion,
  CampoTexto,
  Cargando,
  EnlaceVolver,
  GrupoOpciones,
  Tarjeta,
} from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import { enfocarPrimerError, mensajeNoGuardado } from '../expediente/errores'
import { mensajeErrorImagen, validarTextoImagen } from '../publico/imagenes'
import { ElegirImagenNueva, ImagenPortada, type SeleccionImagen } from '../publico/ImagenPortada'
import {
  NOMBRE_MODALIDAD,
  NOMBRE_TIPO_PUBLICACION,
  type Modalidad,
  type TipoPublicacion,
} from '../publico/publicaciones'
import { TarjetaPublicacion } from '../publico/TarjetaPublicacion'
import {
  LIMITES_PUBLICACION,
  NOMBRE_CAMPO_PUBLICACION,
  SIGUIENTE_ESTADO,
  aDatos,
  aFormulario,
  cambiarEstadoPublicacion,
  crearPublicacion,
  editarPublicacion,
  formularioVacio,
  imagenPublicacion,
  obtenerPublicacionAdmin,
  validarPublicacion,
  type ErroresPublicacion,
  type FormularioPublicacion,
  type PublicacionAdmin,
} from './difusion'
import { EtiquetaEstadoPublicacion } from './PaginaDifusion'

const TIPOS = (Object.entries(NOMBRE_TIPO_PUBLICACION) as [TipoPublicacion, string][]).map(([valor, nombre]) => ({
  valor,
  nombre,
}))

/** FE-144 · Crear una publicación nueva (queda en borrador). */
export function PaginaNuevaPublicacion() {
  const navegar = useNavigate()
  return (
    <div className="space-y-6">
      <EnlaceVolver a="/difusion">Volver a difusión</EnlaceVolver>
      <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Nueva publicación</h1>
      <Editor
        publicacion={null}
        alGuardar={(p, errorImagen) =>
          navegar(`/difusion/${p.id}`, { replace: true, state: { creada: true, errorImagen } })
        }
      />
    </div>
  )
}

/** FE-144 · Editar, publicar, retirar y gestionar la imagen de una publicación. */
export function PaginaEditarPublicacion() {
  const { id = '' } = useParams()
  const ubicacion = useLocation()
  const estadoNavegacion = ubicacion.state as { creada?: boolean; errorImagen?: string } | null
  const creada = Boolean(estadoNavegacion?.creada)
  const { datos, error, recargar } = useCarga(() => obtenerPublicacionAdmin(id), [id])
  const [actual, setActual] = useState<PublicacionAdmin | null>(null)
  const publicacion = actual && actual.id === datos?.id ? actual : datos

  if (error !== undefined && !publicacion) {
    if (error instanceof ErrorApi && error.estado === 404) {
      return (
        <div className="max-w-prose space-y-4">
          <EnlaceVolver a="/difusion">Volver a difusión</EnlaceVolver>
          <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos esta publicación</h1>
          <p className="text-suave">Puede que el enlace no sea correcto.</p>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir la publicación." />
  }
  if (!publicacion) return <Cargando texto="Abriendo publicación…" />

  return (
    <div className="space-y-6">
      <EnlaceVolver a="/difusion">Volver a difusión</EnlaceVolver>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold break-words text-verde-oscuro sm:text-3xl">{publicacion.titulo}</h1>
        <EtiquetaEstadoPublicacion estado={publicacion.estado} />
      </div>
      {creada && !actual && (
        <Aviso tipo="exito">
          <p>Publicación guardada como borrador. Todavía no se ve en el portal.</p>
        </Aviso>
      )}
      <Editor
        key={publicacion.id}
        publicacion={publicacion}
        errorImagenAlCrear={creada ? estadoNavegacion?.errorImagen : undefined}
        // PUT y PATCH de estado no devuelven la imagen: se conserva la que ya se tenía.
        alGuardar={(p) => setActual({ ...p, imagen: p.imagen === undefined ? publicacion.imagen : p.imagen })}
        alRecargar={() => {
          setActual(null)
          recargar()
        }}
      />
    </div>
  )
}

function Editor({
  publicacion,
  errorImagenAlCrear,
  alGuardar,
  alRecargar,
}: {
  publicacion: PublicacionAdmin | null
  errorImagenAlCrear?: string
  /** `errorImagen`: al crear, el borrador se guardó pero la imagen elegida no se pudo subir. */
  alGuardar: (p: PublicacionAdmin, errorImagen?: string) => void
  alRecargar?: () => void
}) {
  // Nueva: la imagen elegida se sube después de crear el borrador. Guardada: se gestiona en su tarjeta.
  const [seleccion, setSeleccion] = useState<SeleccionImagen | null>(null)
  const [errorTextoImagen, setErrorTextoImagen] = useState<string>()
  const [urlVista, setUrlVista] = useState<string | null>(null)
  const idPublicacion = publicacion?.id
  const acciones = useMemo(() => (idPublicacion ? imagenPublicacion(idPublicacion) : null), [idPublicacion])
  const [form, setForm] = useState<FormularioPublicacion>(() =>
    publicacion ? aFormulario(publicacion) : formularioVacio(),
  )
  const [guardadoBase, setGuardadoBase] = useState(() =>
    JSON.stringify(publicacion ? aFormulario(publicacion) : formularioVacio()),
  )
  const [errores, setErrores] = useState<ErroresPublicacion>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  const refMensaje = useRef<HTMLDivElement>(null)
  const sinGuardar = JSON.stringify(form) !== guardadoBase

  const avisar = (tipo: 'exito' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    requestAnimationFrame(() => refMensaje.current?.focus())
  }

  const cambiar = <K extends keyof FormularioPublicacion>(campo: K, valor: FormularioPublicacion[K]) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    if (intento) setErrores(validarPublicacion(siguiente))
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setMensaje(null)
    const encontrados = validarPublicacion(form)
    const errorImagen = seleccion ? validarTextoImagen(seleccion.textoAlternativo) : null
    setErrores(encontrados)
    setErrorTextoImagen(errorImagen ?? undefined)
    if (Object.keys(encontrados).length || errorImagen) return enfocarPrimerError(refForm.current)
    setGuardando(true)
    try {
      const datos = aDatos(form)
      const guardada = publicacion ? await editarPublicacion(publicacion.id, datos) : await crearPublicacion(datos)
      setGuardadoBase(JSON.stringify(form))
      if (publicacion) {
        alGuardar(guardada)
        avisar('exito', 'Cambios guardados.')
        return
      }
      let fallo: string | undefined
      if (seleccion) {
        try {
          guardada.imagen = await imagenPublicacion(guardada.id).subir(seleccion.archivo, seleccion.textoAlternativo)
        } catch (error) {
          fallo = `La publicación se guardó, pero la imagen no se pudo subir. ${mensajeErrorImagen(error)} Puedes intentarlo de nuevo aquí abajo.`
        }
      }
      alGuardar(guardada, fallo)
    } catch (error) {
      // El formulario se conserva tal cual: nada de lo escrito se pierde.
      avisar('error', mensajeNoGuardado(error))
    } finally {
      setGuardando(false)
    }
  }

  const vista = {
    id: publicacion?.id ?? 'nueva',
    tipo: (form.tipo || 'campana') as TipoPublicacion,
    titulo: form.titulo.trim() || 'Título de la publicación',
    resumen: form.resumen.trim() || 'Sin resumen: hace falta para publicar.',
    imagen: urlVista
      ? { url: urlVista, textoAlternativo: publicacion?.imagen?.textoAlternativo ?? seleccion?.textoAlternativo ?? '' }
      : null,
    fechaInicio: form.fechaInicio || null,
    fechaFin: form.fechaFin || null,
    modalidad: form.modalidad || null,
    lugar: form.lugar.trim() || null,
    contactoUrl: form.contactoUrl.trim() || null,
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {publicacion && (
          <CambioEstado
            publicacion={publicacion}
            sinGuardar={sinGuardar}
            alCambiar={(p) => {
              alGuardar(p)
              avisar(
                'exito',
                p.estado === 'publicado'
                  ? 'Publicada: ya se ve en el portal.'
                  : p.estado === 'retirado'
                    ? 'Retirada del portal.'
                    : 'Volvió a borrador.',
              )
            }}
            alFaltar={(campos) => {
              setIntento(true)
              setErrores({
                ...validarPublicacion(form),
                ...(campos.includes('resumen') ? { resumen: 'Escribe un resumen para poder publicar.' } : {}),
              })
              enfocarPrimerError(refForm.current)
            }}
            alRecargar={alRecargar}
          />
        )}

        {mensaje && (
          <Aviso ref={refMensaje} tipo={mensaje.tipo}>
            <p>{mensaje.texto}</p>
          </Aviso>
        )}

        <Tarjeta>
          <form ref={refForm} noValidate onSubmit={guardar}>
            <fieldset disabled={guardando} className="space-y-5">
              <legend className="text-lg font-semibold text-verde-oscuro">Contenido</legend>
              <GrupoOpciones
                leyenda="Tipo"
                nombre="tipo"
                opciones={TIPOS}
                valor={form.tipo}
                alCambiar={(tipo) => cambiar('tipo', tipo)}
                error={errores.tipo}
              />
              <CampoTexto
                etiqueta="Título"
                value={form.titulo}
                maxLength={LIMITES_PUBLICACION.titulo}
                error={errores.titulo}
                onChange={(e) => cambiar('titulo', e.target.value)}
              />
              <AreaTexto
                etiqueta="Resumen"
                rows={3}
                value={form.resumen}
                maxLength={LIMITES_PUBLICACION.resumen}
                error={errores.resumen}
                ayuda={`Se muestra en la tarjeta del portal. Obligatorio para publicar. ${form.resumen.length}/${LIMITES_PUBLICACION.resumen}`}
                onChange={(e) => cambiar('resumen', e.target.value)}
              />
              <AreaTexto
                etiqueta="Contenido"
                rows={8}
                value={form.contenido}
                maxLength={LIMITES_PUBLICACION.contenido}
                error={errores.contenido}
                ayuda="Texto completo del detalle. Se muestra como texto: no admite HTML. No incluyas datos de pacientes."
                onChange={(e) => cambiar('contenido', e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoTexto
                  etiqueta="Fecha de inicio"
                  type="date"
                  value={form.fechaInicio}
                  error={errores.fechaInicio}
                  onChange={(e) => cambiar('fechaInicio', e.target.value)}
                />
                <CampoTexto
                  etiqueta="Fecha de fin"
                  type="date"
                  min={form.fechaInicio || undefined}
                  value={form.fechaFin}
                  error={errores.fechaFin}
                  onChange={(e) => cambiar('fechaFin', e.target.value)}
                />
                <CampoSeleccion
                  etiqueta="Modalidad"
                  value={form.modalidad}
                  onChange={(e) => cambiar('modalidad', e.target.value as Modalidad | '')}
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(NOMBRE_MODALIDAD).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </CampoSeleccion>
                <CampoTexto
                  etiqueta="Lugar"
                  value={form.lugar}
                  maxLength={LIMITES_PUBLICACION.lugar}
                  error={errores.lugar}
                  onChange={(e) => cambiar('lugar', e.target.value)}
                />
              </div>
              <CampoTexto
                etiqueta="Enlace de contacto o inscripción"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={form.contactoUrl}
                maxLength={LIMITES_PUBLICACION.contactoUrl}
                error={errores.contactoUrl}
                ayuda="Solo canales institucionales verificados."
                onChange={(e) => cambiar('contactoUrl', e.target.value)}
              />
              {!publicacion && (
                <ElegirImagenNueva
                  seleccion={seleccion}
                  errorTexto={errorTextoImagen}
                  alSeleccionar={(s) => {
                    setSeleccion(s)
                    if (errorTextoImagen && s) setErrorTextoImagen(validarTextoImagen(s.textoAlternativo) ?? undefined)
                    if (!s) setErrorTextoImagen(undefined)
                  }}
                  alVistaPrevia={setUrlVista}
                />
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {publicacion && sinGuardar && <p className="text-sm text-naranja-texto">Hay cambios sin guardar.</p>}
                <Link
                  to="/difusion"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 font-semibold text-suave hover:text-texto"
                >
                  {publicacion ? 'Volver sin guardar' : 'Cancelar'}
                </Link>
                <Boton
                  type="submit"
                  icono="guardar"
                  cargando={guardando}
                  textoCargando={!publicacion && seleccion ? 'Guardando y subiendo la imagen…' : 'Guardando…'}
                >
                  {publicacion ? 'Guardar cambios' : 'Guardar borrador'}
                </Boton>
              </div>
            </fieldset>
          </form>
        </Tarjeta>

        {publicacion && acciones && (
          <ImagenPortada
            imagen={publicacion.imagen ?? null}
            acciones={acciones}
            publicado={publicacion.estado === 'publicado'}
            avisoInicial={errorImagenAlCrear}
            alCambiar={(imagen) => alGuardar({ ...publicacion, imagen })}
            alVistaPrevia={setUrlVista}
          />
        )}
      </div>

      <aside aria-labelledby="titulo-vista-previa" className="space-y-2 lg:sticky lg:top-4" id="vista-previa">
        <h2 id="titulo-vista-previa" className="text-lg font-semibold text-verde-oscuro">
          Vista previa
        </h2>
        <p className="text-sm text-suave">Así se verá la tarjeta en el portal.</p>
        <TarjetaPublicacion publicacion={vista} aDetalle="#vista-previa" />
      </aside>
    </div>
  )
}

function CambioEstado({
  publicacion,
  sinGuardar,
  alCambiar,
  alFaltar,
  alRecargar,
}: {
  publicacion: PublicacionAdmin
  sinGuardar: boolean
  alCambiar: (p: PublicacionAdmin) => void
  alFaltar: (campos: string[]) => void
  alRecargar?: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<{ texto: string; recargar: boolean } | null>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const siguiente = SIGUIENTE_ESTADO[publicacion.estado]

  async function cambiar() {
    if (enviando) return
    setFallo(null)
    setEnviando(true)
    try {
      alCambiar(await cambiarEstadoPublicacion(publicacion.id, siguiente.estado))
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 422) {
        const campos = Array.isArray(error.datos.camposFaltantes) ? (error.datos.camposFaltantes as string[]) : []
        setFallo({
          texto: `Para publicar falta: ${campos.map((c) => NOMBRE_CAMPO_PUBLICACION[c] ?? c).join(', ') || 'completar datos'}.`,
          recargar: false,
        })
        // El foco va al campo que falta (alFaltar), no al aviso.
        alFaltar(campos)
        return
      } else if (error instanceof ErrorApi && error.estado === 409) {
        setFallo({ texto: 'El estado de esta publicación cambió en otra sesión.', recargar: true })
      } else {
        setFallo({ texto: mensajeNoGuardado(error), recargar: false })
      }
      requestAnimationFrame(() => refFallo.current?.focus())
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Estado</h2>
      <p className="mt-1 text-sm text-suave">
        {publicacion.estado === 'publicado' && publicacion.publicadoEn
          ? `Publicada el ${fechaLarga(publicacion.publicadoEn)}.`
          : publicacion.estado === 'retirado' && publicacion.retiradoEn
            ? `Retirada el ${fechaLarga(publicacion.retiradoEn)}.`
            : 'Borrador: no se ve en el portal.'}{' '}
        {siguiente.ayuda}
      </p>
      {fallo && (
        <Aviso ref={refFallo} tipo="error" className="mt-3">
          <p>{fallo.texto}</p>
          {fallo.recargar && alRecargar && (
            <Boton variante="texto" className="-ml-2" onClick={alRecargar}>
              Ver el estado actual
            </Boton>
          )}
        </Aviso>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Boton
          variante={publicacion.estado === 'borrador' ? 'primario' : 'secundario'}
          icono={publicacion.estado === 'borrador' ? 'megafono' : undefined}
          cargando={enviando}
          textoCargando="Cambiando…"
          disabled={sinGuardar}
          onClick={cambiar}
        >
          {siguiente.accion}
        </Boton>
        {sinGuardar && <p className="text-sm text-naranja-texto">Guarda los cambios antes de cambiar el estado.</p>}
        {publicacion.estado === 'publicado' && (
          <Link
            to={`/publicaciones/${publicacion.id}`}
            className="text-sm font-semibold text-naranja-texto underline underline-offset-4"
          >
            Ver en el portal
          </Link>
        )}
      </div>
    </Tarjeta>
  )
}

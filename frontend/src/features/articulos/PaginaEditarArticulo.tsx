import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { AreaTexto, Aviso, Boton, CampoTexto, Cargando, EnlaceVolver, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import { urlImagenDifusion } from '../difusion/difusion'
import { enfocarPrimerError, mensajeNoGuardado } from '../expediente/errores'
import { TarjetaInvestigacion } from '../publico/TarjetaInvestigacion'
import {
  LIMITES_ARTICULO,
  SIGUIENTE_ESTADO_ARTICULO,
  aDatos,
  aFormulario,
  cambiarEstadoArticulo,
  crearArticulo,
  editarArticulo,
  eliminarArticulo,
  formularioVacio,
  obtenerArticulo,
  validarArticulo,
  type Articulo,
  type ErroresArticulo,
  type FormularioArticulo,
} from './articulos'
import { EtiquetaEstadoArticulo } from './PaginaArticulos'

/** FE-187 · Crear un artículo (queda en borrador). */
export function PaginaNuevoArticulo() {
  const navegar = useNavigate()
  return (
    <div className="space-y-6">
      <EnlaceVolver a="/articulos">Volver a artículos</EnlaceVolver>
      <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Nuevo artículo</h1>
      <Editor
        articulo={null}
        alGuardar={(a) => navegar(`/articulos/${a.id}`, { replace: true, state: { creado: true } })}
      />
    </div>
  )
}

/** FE-187 · Editar, publicar, retirar o eliminar (si nunca se publicó) un artículo. */
export function PaginaEditarArticulo() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const creado = Boolean((ubicacion.state as { creado?: boolean } | null)?.creado)
  const { datos, error, recargar } = useCarga(() => obtenerArticulo(id), [id])
  const [actual, setActual] = useState<Articulo | null>(null)
  const articulo = actual && actual.id === datos?.id ? actual : datos

  if (error !== undefined && !articulo) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) {
      return (
        <div className="max-w-prose space-y-4">
          <EnlaceVolver a="/articulos">Volver a artículos</EnlaceVolver>
          <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos este artículo</h1>
          <p className="text-suave">Puede que el enlace no sea correcto o que se haya eliminado.</p>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir el artículo." />
  }
  if (!articulo) return <Cargando texto="Abriendo artículo…" />

  return (
    <div className="space-y-6">
      <EnlaceVolver a="/articulos">Volver a artículos</EnlaceVolver>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold break-words text-verde-oscuro sm:text-3xl">{articulo.titulo}</h1>
        <EtiquetaEstadoArticulo estado={articulo.estado} />
      </div>
      {creado && !actual && (
        <Aviso tipo="exito">
          <p>Artículo guardado como borrador. Todavía no se ve en el portal.</p>
        </Aviso>
      )}
      <Editor
        key={articulo.id}
        articulo={articulo}
        alGuardar={setActual}
        alRecargar={() => {
          setActual(null)
          recargar()
        }}
        alEliminar={() => navegar('/articulos', { replace: true })}
      />
    </div>
  )
}

function Editor({
  articulo,
  alGuardar,
  alRecargar,
  alEliminar,
}: {
  articulo: Articulo | null
  alGuardar: (a: Articulo) => void
  alRecargar?: () => void
  alEliminar?: () => void
}) {
  const inicial = articulo ? aFormulario(articulo) : formularioVacio()
  const [form, setForm] = useState<FormularioArticulo>(inicial)
  const [base, setBase] = useState(JSON.stringify(inicial))
  const [errores, setErrores] = useState<ErroresArticulo>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  const refMensaje = useRef<HTMLDivElement>(null)
  const sinGuardar = JSON.stringify(form) !== base

  const avisar = (tipo: 'exito' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    requestAnimationFrame(() => refMensaje.current?.focus())
  }

  const cambiar = <K extends keyof FormularioArticulo>(campo: K, valor: string) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    if (intento) setErrores(validarArticulo(siguiente))
  }

  const faltaResumen = () => {
    setIntento(true)
    setErrores({ ...validarArticulo(form), resumen: 'Escribe un resumen: es obligatorio para publicar.' })
    enfocarPrimerError(refForm.current)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setMensaje(null)
    const encontrados = validarArticulo(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return enfocarPrimerError(refForm.current)
    setGuardando(true)
    try {
      const datos = aDatos(form)
      const guardado = articulo ? await editarArticulo(articulo.id, datos) : await crearArticulo(datos)
      setBase(JSON.stringify(form))
      alGuardar(guardado)
      if (articulo) avisar('exito', 'Cambios guardados.')
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 422) {
        setGuardando(false)
        return faltaResumen()
      }
      avisar('error', mensajeNoGuardado(error))
    } finally {
      setGuardando(false)
    }
  }

  const vista = {
    id: articulo?.id ?? 'nuevo',
    titulo: form.titulo.trim() || 'Título del artículo',
    resumen: form.resumen.trim() || 'Sin resumen: hace falta para publicar.',
    autor: form.autorVisible.trim() || null,
    fechaPublicacion: articulo?.publicadoEn?.slice(0, 10) ?? null,
    imagen:
      form.imagenRuta.trim() && form.imagenAlternativo.trim()
        ? { url: urlImagenDifusion(form.imagenRuta.trim()), textoAlternativo: form.imagenAlternativo.trim() }
        : null,
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {articulo && (
          <CambioEstado
            articulo={articulo}
            sinGuardar={sinGuardar}
            alCambiar={(a) => {
              alGuardar(a)
              avisar(
                'exito',
                a.estado === 'publicado'
                  ? 'Publicado: ya se ve en «Investigaciones» del portal.'
                  : a.estado === 'retirado'
                    ? 'Retirado del portal.'
                    : 'Volvió a borrador.',
              )
            }}
            alFaltarResumen={faltaResumen}
            alRecargar={alRecargar}
            alEliminar={alEliminar}
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
              <CampoTexto
                etiqueta="Título"
                value={form.titulo}
                maxLength={LIMITES_ARTICULO.titulo}
                error={errores.titulo}
                onChange={(e) => cambiar('titulo', e.target.value)}
              />
              <AreaTexto
                etiqueta="Resumen"
                rows={3}
                value={form.resumen}
                maxLength={LIMITES_ARTICULO.resumen}
                error={errores.resumen}
                ayuda={`Se muestra en la tarjeta del portal. Obligatorio para publicar. ${form.resumen.length}/${LIMITES_ARTICULO.resumen}`}
                onChange={(e) => cambiar('resumen', e.target.value)}
              />
              <AreaTexto
                etiqueta="Contenido"
                rows={12}
                value={form.contenido}
                maxLength={LIMITES_ARTICULO.contenido}
                error={errores.contenido}
                ayuda="Se muestra como texto. No incluyas nombres, casos ni datos que permitan reconocer a pacientes o familias."
                onChange={(e) => cambiar('contenido', e.target.value)}
              />
              <CampoTexto
                etiqueta="Autor visible (opcional)"
                value={form.autorVisible}
                maxLength={LIMITES_ARTICULO.autor}
                error={errores.autorVisible}
                ayuda="Solo si la persona autorizó que se muestre su nombre."
                onChange={(e) => cambiar('autorVisible', e.target.value)}
              />
              <fieldset className="space-y-4 rounded-2xl bg-crema p-4">
                <legend className="px-1 text-sm font-semibold text-texto">Imagen de portada (opcional)</legend>
                <p className="text-sm text-suave">
                  La imagen debe estar ya en la carpeta pública del sitio ({urlImagenDifusion('')}). Aquí solo se indica
                  su ruta.
                </p>
                <CampoTexto
                  etiqueta="Ruta de la imagen"
                  placeholder="investigaciones/portada.jpg"
                  maxLength={LIMITES_ARTICULO.imagen}
                  value={form.imagenRuta}
                  error={errores.imagenRuta}
                  onChange={(e) => cambiar('imagenRuta', e.target.value)}
                />
                <CampoTexto
                  etiqueta="Texto alternativo de la imagen"
                  maxLength={LIMITES_ARTICULO.imagen}
                  value={form.imagenAlternativo}
                  error={errores.imagenAlternativo}
                  ayuda="Qué muestra la imagen, en una frase."
                  onChange={(e) => cambiar('imagenAlternativo', e.target.value)}
                />
              </fieldset>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {articulo && sinGuardar && <p className="text-sm text-naranja-texto">Hay cambios sin guardar.</p>}
                <Link
                  to="/articulos"
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 font-semibold text-suave hover:text-texto"
                >
                  {articulo ? 'Volver sin guardar' : 'Cancelar'}
                </Link>
                <Boton type="submit" icono="guardar" cargando={guardando} textoCargando="Guardando…">
                  {articulo ? 'Guardar cambios' : 'Guardar borrador'}
                </Boton>
              </div>
            </fieldset>
          </form>
        </Tarjeta>
      </div>
      <aside aria-labelledby="titulo-vista-previa-articulo" className="space-y-2 lg:sticky lg:top-4" id="vista-previa">
        <h2 id="titulo-vista-previa-articulo" className="text-lg font-semibold text-verde-oscuro">
          Vista previa
        </h2>
        <p className="text-sm text-suave">Así se verá la tarjeta en el portal.</p>
        <TarjetaInvestigacion investigacion={vista} aDetalle="#vista-previa" />
      </aside>
    </div>
  )
}

function CambioEstado({
  articulo,
  sinGuardar,
  alCambiar,
  alFaltarResumen,
  alRecargar,
  alEliminar,
}: {
  articulo: Articulo
  sinGuardar: boolean
  alCambiar: (a: Articulo) => void
  alFaltarResumen: () => void
  alRecargar?: () => void
  alEliminar?: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [fallo, setFallo] = useState<{ texto: string; recargar: boolean } | null>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const refConfirmar = useRef<HTMLButtonElement>(null)
  const siguiente = SIGUIENTE_ESTADO_ARTICULO[articulo.estado]
  // Un artículo que alguna vez se publicó no se elimina: se retira (409 del backend).
  const sePuedeEliminar = articulo.estado === 'borrador' && !articulo.publicadoEn

  useEffect(() => {
    if (confirmandoBorrado) refConfirmar.current?.focus()
  }, [confirmandoBorrado])

  const fallar = (texto: string, recargar = false) => {
    setFallo({ texto, recargar })
    requestAnimationFrame(() => refFallo.current?.focus())
  }

  async function cambiar() {
    if (enviando) return
    setFallo(null)
    setEnviando(true)
    try {
      alCambiar(await cambiarEstadoArticulo(articulo.id, siguiente.estado))
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 422) {
        setFallo({ texto: 'Para publicar falta: Resumen.', recargar: false })
        alFaltarResumen()
      } else if (error instanceof ErrorApi && error.estado === 409) {
        fallar('El estado de este artículo cambió en otra sesión.', true)
      } else {
        fallar(mensajeNoGuardado(error))
      }
    } finally {
      setEnviando(false)
    }
  }

  async function eliminar() {
    if (enviando) return
    setEnviando(true)
    setFallo(null)
    try {
      await eliminarArticulo(articulo.id)
      alEliminar?.()
    } catch (error) {
      setConfirmandoBorrado(false)
      fallar(
        error instanceof ErrorApi && error.estado === 409
          ? 'Este artículo ya se publicó alguna vez: no se elimina, se retira.'
          : mensajeNoGuardado(error).replace('No se guardó', 'No se eliminó'),
        error instanceof ErrorApi && error.estado === 409,
      )
      setEnviando(false)
    }
  }

  return (
    <Tarjeta data-recorrido="estado-articulo">
      <h2 className="text-lg font-semibold text-verde-oscuro">Estado</h2>
      <p className="mt-1 text-sm text-suave">
        {articulo.estado === 'publicado' && articulo.publicadoEn
          ? `Publicado el ${fechaLarga(articulo.publicadoEn)}.`
          : articulo.estado === 'retirado' && articulo.retiradoEn
            ? `Retirado el ${fechaLarga(articulo.retiradoEn)}.`
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
      {confirmandoBorrado ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-crema p-4">
          <p className="font-semibold text-texto">¿Eliminar este borrador?</p>
          <p className="text-sm text-suave">Nunca se publicó. Se borra para siempre y no se puede recuperar.</p>
          <div className="flex flex-wrap gap-2">
            <Boton ref={refConfirmar} cargando={enviando} textoCargando="Eliminando…" onClick={eliminar}>
              Sí, eliminar
            </Boton>
            <Boton variante="secundario" disabled={enviando} onClick={() => setConfirmandoBorrado(false)}>
              No, conservar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Boton
            variante={articulo.estado === 'borrador' ? 'primario' : 'secundario'}
            icono={articulo.estado === 'borrador' ? 'megafono' : undefined}
            cargando={enviando}
            textoCargando="Cambiando…"
            disabled={sinGuardar}
            onClick={cambiar}
          >
            {siguiente.accion}
          </Boton>
          {sePuedeEliminar && (
            <Boton variante="texto" icono="cerrar" disabled={enviando} onClick={() => setConfirmandoBorrado(true)}>
              Eliminar borrador
            </Boton>
          )}
          {sinGuardar && <p className="text-sm text-naranja-texto">Guarda los cambios antes de cambiar el estado.</p>}
          {articulo.estado === 'publicado' && (
            <Link
              to={`/investigaciones/${articulo.id}`}
              className="text-sm font-semibold text-naranja-texto underline underline-offset-4"
            >
              Ver en el portal
            </Link>
          )}
        </div>
      )}
    </Tarjeta>
  )
}

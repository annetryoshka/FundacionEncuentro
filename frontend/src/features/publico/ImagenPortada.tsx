import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { claseBoton } from '../../componentes/estilos'
import { Icono } from '../../componentes/iconos'
import { Aviso, Boton, CampoTexto, Tarjeta } from '../../componentes/ui'
import { tamanoLegible } from '../../utilidades/archivos'
import {
  ACEPTA_IMAGEN,
  LIMITE_TEXTO_IMAGEN,
  mensajeErrorImagen,
  validarImagen,
  validarTextoImagen,
  type AccionesImagen,
  type ImagenGestion,
} from './imagenes'

/** Imagen elegida para una publicación o artículo que todavía no se guardó. */
export interface SeleccionImagen {
  archivo: File
  textoAlternativo: string
}

const AYUDA_TEXTO =
  'Por ejemplo: «Afiche del taller para familias del 12 de diciembre». Lo escucha quien usa lector de pantalla.'

const revocaciones = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * URL local de un archivo o blob, liberada al cambiar o al salir de la pantalla.
 * Se libera un instante después: StrictMode desmonta y vuelve a montar, y en ese caso se cancela.
 */
function useUrlLocal(contenido: Blob | null) {
  const url = useMemo(() => (contenido ? URL.createObjectURL(contenido) : null), [contenido])
  useEffect(() => {
    if (!url) return
    clearTimeout(revocaciones.get(url))
    revocaciones.delete(url)
    return () => {
      revocaciones.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url)
          revocaciones.delete(url)
        }, 0),
      )
    }
  }, [url])
  return url
}

/** Botón «Elegir imagen» (abre el explorador o la galería del celular) que también acepta arrastrar. */
function ElegirArchivo({
  texto,
  variante = 'primario',
  disabled,
  alElegir,
}: {
  texto: string
  variante?: 'primario' | 'secundario'
  disabled?: boolean
  alElegir: (archivo: File) => void
}) {
  const id = useId()
  return (
    <span className="inline-flex">
      <input
        id={id}
        type="file"
        accept={ACEPTA_IMAGEN}
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) alElegir(archivo)
        }}
      />
      <label
        htmlFor={id}
        className={`${claseBoton(variante)} cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-naranja peer-disabled:cursor-not-allowed peer-disabled:opacity-70`}
      >
        <Icono nombre="subir" className="size-[1.125rem]" />
        {texto}
      </label>
    </span>
  )
}

function ZonaElegir({
  error,
  disabled,
  alElegir,
}: {
  error?: string
  disabled?: boolean
  alElegir: (a: File) => void
}) {
  const [encima, setEncima] = useState(false)
  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setEncima(false)
    const archivo = e.dataTransfer.files?.[0]
    if (archivo && !disabled) alElegir(archivo)
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        error ? 'border-error' : encima ? 'border-verde bg-verde/5' : 'border-linea bg-crema'
      }`}
    >
      <ElegirArchivo texto="Elegir imagen" disabled={disabled} alElegir={alElegir} />
      <p className="text-sm text-suave">
        Una foto o un afiche en JPG, PNG o WebP, de hasta 15 MB. También puedes arrastrarla aquí.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  )
}

function Marco({ url, alt, pie }: { url: string | null; alt: string; pie?: ReactNode }) {
  return (
    <figure className="space-y-2">
      <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-linea bg-crema">
        {url ? (
          <img src={url} alt={alt} className="h-full w-full object-contain" />
        ) : (
          <p className="px-4 text-sm text-suave">Cargando la imagen…</p>
        )}
      </div>
      {pie && <figcaption className="text-sm text-suave">{pie}</figcaption>}
    </figure>
  )
}

const Recordatorio = () => (
  <p className="text-sm text-suave">
    No hace falta achicarla: el sistema la ajusta y le quita la ubicación del celular. No uses fotos en las que se
    reconozca a pacientes o a sus familias.
  </p>
)

/**
 * Publicación o artículo nuevo: la imagen se elige aquí y se sube después de guardar el borrador.
 * El padre conserva la selección y muestra `errorTexto` al validar el formulario.
 */
export function ElegirImagenNueva({
  seleccion,
  errorTexto,
  alSeleccionar,
  alVistaPrevia,
}: {
  seleccion: SeleccionImagen | null
  errorTexto?: string
  alSeleccionar: (s: SeleccionImagen | null) => void
  alVistaPrevia: (url: string | null) => void
}) {
  const [errorArchivo, setErrorArchivo] = useState<string>()
  const url = useUrlLocal(seleccion?.archivo ?? null)
  useEffect(() => alVistaPrevia(url), [url, alVistaPrevia])

  const elegir = (archivo: File) => {
    const error = validarImagen(archivo)
    setErrorArchivo(error ?? undefined)
    if (!error) alSeleccionar({ archivo, textoAlternativo: seleccion?.textoAlternativo ?? '' })
  }

  return (
    <fieldset className="space-y-4 rounded-2xl border border-linea p-4">
      <legend className="px-1 text-sm font-semibold text-texto">Imagen de portada (opcional)</legend>
      {seleccion ? (
        <>
          <Marco
            url={url}
            alt={seleccion.textoAlternativo || 'Imagen elegida'}
            pie={`${seleccion.archivo.name} · ${tamanoLegible(seleccion.archivo.size)}`}
          />
          {errorArchivo && (
            <p role="alert" className="text-sm font-semibold text-error">
              {errorArchivo}
            </p>
          )}
          <CampoTexto
            etiqueta="Describe la imagen en una frase"
            value={seleccion.textoAlternativo}
            maxLength={LIMITE_TEXTO_IMAGEN}
            error={errorTexto}
            ayuda={AYUDA_TEXTO}
            onChange={(e) => alSeleccionar({ ...seleccion, textoAlternativo: e.target.value })}
          />
          <p className="text-sm text-suave">La imagen se sube al guardar el borrador.</p>
          <div className="flex flex-wrap items-center gap-3">
            <ElegirArchivo texto="Elegir otra imagen" variante="secundario" alElegir={elegir} />
            <Boton variante="texto" icono="cerrar" onClick={() => alSeleccionar(null)}>
              No usar imagen
            </Boton>
          </div>
        </>
      ) : (
        <>
          <ZonaElegir error={errorArchivo} alElegir={elegir} />
          <Recordatorio />
        </>
      )}
    </fieldset>
  )
}

type Paso = 'ver' | 'texto' | 'quitar'

/** Publicación o artículo ya guardado: subir, cambiar, describir o quitar la imagen de portada. */
export function ImagenPortada({
  imagen,
  acciones,
  publicado,
  avisoInicial,
  alCambiar,
  alVistaPrevia,
}: {
  imagen: ImagenGestion | null
  acciones: AccionesImagen
  publicado: boolean
  /** Por ejemplo, si la imagen elegida al crear no se pudo subir. */
  avisoInicial?: string
  alCambiar: (imagen: ImagenGestion | null) => void
  alVistaPrevia: (url: string | null) => void
}) {
  const [pendiente, setPendiente] = useState<File | null>(null)
  const [texto, setTexto] = useState('')
  const [paso, setPaso] = useState<Paso>('ver')
  const [errores, setErrores] = useState<{ archivo?: string; texto?: string }>({})
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(
    avisoInicial ? { tipo: 'error', texto: avisoInicial } : null,
  )
  const [guardada, setGuardada] = useState<Blob | null>(null)
  const [falloVista, setFalloVista] = useState(false)
  const refMensaje = useRef<HTMLDivElement>(null)
  const refTexto = useRef<HTMLInputElement>(null)
  const refConfirmar = useRef<HTMLButtonElement>(null)
  // La imagen recién subida ya está en el navegador: no se vuelve a descargar.
  const recienSubida = useRef<string | null>(null)

  const urlPendiente = useUrlLocal(pendiente)
  const urlGuardada = useUrlLocal(guardada)
  const idImagen = imagen?.id ?? null

  // Vista previa del archivo guardado (también en borrador, con la sesión).
  useEffect(() => {
    if (idImagen && idImagen === recienSubida.current) return
    setGuardada(null)
    setFalloVista(false)
    if (!idImagen) return
    let vigente = true
    acciones.vistaPrevia().then(
      (blob) => vigente && setGuardada(blob),
      () => vigente && setFalloVista(true),
    )
    return () => {
      vigente = false
    }
    // acciones cambia en cada render del padre; la imagen la identifica su id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idImagen])

  useEffect(() => alVistaPrevia(urlPendiente ?? urlGuardada), [urlPendiente, urlGuardada, alVistaPrevia])
  useEffect(() => {
    if (mensaje) requestAnimationFrame(() => refMensaje.current?.focus())
  }, [mensaje])
  useEffect(() => {
    if (paso === 'quitar') refConfirmar.current?.focus()
    if (paso === 'texto') refTexto.current?.focus()
  }, [paso])

  const elegir = (archivo: File) => {
    const error = validarImagen(archivo)
    setErrores({ archivo: error ?? undefined })
    setMensaje(null)
    if (error) return
    setPendiente(archivo)
    setTexto((actual) => actual || imagen?.textoAlternativo || '')
    setPaso('ver')
    requestAnimationFrame(() => refTexto.current?.focus())
  }

  async function ejecutar(accion: () => Promise<void>) {
    if (enviando) return
    setEnviando(true)
    setMensaje(null)
    try {
      await accion()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeErrorImagen(error) })
    } finally {
      setEnviando(false)
    }
  }

  const subir = () => {
    const errorTexto = validarTextoImagen(texto)
    setErrores({ texto: errorTexto ?? undefined })
    if (errorTexto) return refTexto.current?.focus()
    if (!pendiente) return
    return ejecutar(async () => {
      const nueva = await acciones.subir(pendiente, texto)
      recienSubida.current = nueva.id
      setFalloVista(false)
      setGuardada(pendiente)
      setPendiente(null)
      alCambiar(nueva)
      setMensaje({
        tipo: 'exito',
        texto: publicado
          ? 'Imagen guardada. Ya se ve en el portal.'
          : 'Imagen guardada. Se verá en el portal al publicar.',
      })
    })
  }

  const guardarTexto = () => {
    const errorTexto = validarTextoImagen(texto)
    setErrores({ texto: errorTexto ?? undefined })
    if (errorTexto) return refTexto.current?.focus()
    return ejecutar(async () => {
      alCambiar(await acciones.cambiarTexto(texto))
      setPaso('ver')
      setMensaje({ tipo: 'exito', texto: 'Descripción guardada.' })
    })
  }

  const quitar = () =>
    ejecutar(async () => {
      await acciones.quitar()
      alCambiar(null)
      setPaso('ver')
      setTexto('')
      setMensaje({ tipo: 'exito', texto: 'Imagen quitada.' })
    })

  const cancelar = () => {
    setPendiente(null)
    setPaso('ver')
    setErrores({})
    setTexto('')
  }

  const campoTexto = (
    <CampoTexto
      ref={refTexto}
      etiqueta="Describe la imagen en una frase"
      value={texto}
      maxLength={LIMITE_TEXTO_IMAGEN}
      error={errores.texto}
      ayuda={AYUDA_TEXTO}
      disabled={enviando}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (pendiente) subir()
        else guardarTexto()
      }}
    />
  )

  let contenido: ReactNode
  if (pendiente) {
    contenido = (
      <>
        <Marco
          url={urlPendiente}
          alt={texto || 'Imagen elegida'}
          pie={`${pendiente.name} · ${tamanoLegible(pendiente.size)}`}
        />
        {campoTexto}
        <div className="flex flex-wrap items-center gap-3">
          <Boton icono="guardar" cargando={enviando} textoCargando="Subiendo imagen…" onClick={subir}>
            Guardar imagen
          </Boton>
          <ElegirArchivo texto="Elegir otra" variante="secundario" disabled={enviando} alElegir={elegir} />
          <Boton variante="texto" disabled={enviando} onClick={cancelar}>
            Cancelar
          </Boton>
        </div>
      </>
    )
  } else if (imagen) {
    const pie = (
      <>
        <span className="block font-semibold text-texto">{imagen.textoAlternativo}</span>
        {imagen.ancho && imagen.alto ? `${imagen.ancho} × ${imagen.alto} píxeles · ` : ''}
        {tamanoLegible(imagen.tamanoBytes)}
      </>
    )
    contenido = (
      <>
        {falloVista ? (
          <p className="rounded-2xl bg-crema px-4 py-6 text-center text-sm text-suave">
            No se pudo mostrar la imagen guardada. Recarga la página para intentarlo de nuevo.
          </p>
        ) : (
          <Marco url={urlGuardada} alt={imagen.textoAlternativo} pie={paso === 'texto' ? undefined : pie} />
        )}
        {errores.archivo && (
          <p role="alert" className="text-sm font-semibold text-error">
            {errores.archivo}
          </p>
        )}
        {paso === 'texto' ? (
          <>
            {campoTexto}
            <div className="flex flex-wrap items-center gap-3">
              <Boton icono="guardar" cargando={enviando} textoCargando="Guardando…" onClick={guardarTexto}>
                Guardar descripción
              </Boton>
              <Boton variante="texto" disabled={enviando} onClick={cancelar}>
                Cancelar
              </Boton>
            </div>
          </>
        ) : paso === 'quitar' ? (
          <div className="space-y-3 rounded-2xl bg-crema p-4">
            <p className="font-semibold text-texto">¿Quitar la imagen?</p>
            <p className="text-sm text-suave">Queda sin imagen. Puedes subir otra cuando quieras.</p>
            <div className="flex flex-wrap gap-2">
              <Boton ref={refConfirmar} cargando={enviando} textoCargando="Quitando…" onClick={quitar}>
                Sí, quitar
              </Boton>
              <Boton variante="secundario" disabled={enviando} onClick={() => setPaso('ver')}>
                No, conservar
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <ElegirArchivo texto="Cambiar imagen" variante="secundario" disabled={enviando} alElegir={elegir} />
            <Boton
              variante="texto"
              icono="editar"
              disabled={enviando}
              onClick={() => {
                setTexto(imagen.textoAlternativo)
                setErrores({})
                setPaso('texto')
              }}
            >
              Editar descripción
            </Boton>
            <Boton variante="texto" icono="cerrar" disabled={enviando} onClick={() => setPaso('quitar')}>
              Quitar imagen
            </Boton>
          </div>
        )}
      </>
    )
  } else {
    contenido = (
      <>
        <ZonaElegir error={errores.archivo} disabled={enviando} alElegir={elegir} />
        <Recordatorio />
      </>
    )
  }

  return (
    <Tarjeta className="space-y-4">
      <h2 className="text-lg font-semibold text-verde-oscuro">Imagen de portada</h2>
      {mensaje && (
        <Aviso ref={refMensaje} tipo={mensaje.tipo}>
          <p>{mensaje.texto}</p>
        </Aviso>
      )}
      {contenido}
    </Tarjeta>
  )
}

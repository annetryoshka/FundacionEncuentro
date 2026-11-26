import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useCarga } from '../../../api/useCarga'
import { ErrorDeCarga } from '../../../componentes/ErrorDeCarga'
import { Aviso, Boton, Cargando, Indicador, Tarjeta } from '../../../componentes/ui'
import { claseBoton } from '../../../componentes/estilos'
import { guardarArchivo, tamanoLegible } from '../../../utilidades/archivos'
import { fechaLarga } from '../../../utilidades/fechas'
import { useSesion } from '../../auth/sesion'
import type { CarpetaDetalle } from '../../carpetas/tipos'
import { crearNombrador } from '../autoria'
import { mensajeNoGuardado } from '../errores'
import { SeccionCarpeta } from '../SeccionCarpeta'
import {
  ACEPTA_GENOGRAMA,
  FORMATOS_GENOGRAMA,
  cargarGenograma,
  descargarGenograma,
  esImagen,
  mensajeCargaGenograma,
  nombreFormato,
  obtenerGenograma,
  validarArchivoGenograma,
  type GenogramaInfo,
} from './genograma'

/**
 * FE-132 · Visor y carga del genograma exportado de GenoPro (FE-129/FE-131).
 * Un reemplazo rechazado (413, 415, red) conserva el genograma vigente en pantalla.
 */
export function PaginaGenograma() {
  return <SeccionCarpeta titulo="Genograma">{(carpeta) => <VistaGenograma carpeta={carpeta} />}</SeccionCarpeta>
}

function VistaGenograma({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerGenograma(carpeta.id), [carpeta.id])
  const [exito, setExito] = useState<string | null>(null)
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined && datos === undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo consultar el genograma." />
  }
  if (datos === undefined) return <Cargando texto="Consultando genograma…" />

  return (
    <div className="max-w-4xl space-y-4">
      {exito && (
        <Aviso ref={refExito} tipo="exito">
          {exito}
        </Aviso>
      )}
      {datos ? (
        <Tarjeta>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold break-words text-verde-oscuro">{datos.nombre}</h2>
              <p className="mt-1 text-sm text-suave">
                {nombreFormato(datos.tipo)} · {tamanoLegible(datos.tamanio)} · Cargado por {nombre(datos.autorId)} el{' '}
                {fechaLarga(datos.actualizadoEn)}
              </p>
            </div>
          </div>
          <Visor
            key={`${datos.actualizadoEn}|${datos.tamanio}`}
            carpetaId={carpeta.id}
            info={datos}
            paciente={carpeta.paciente.nombreCompleto}
          />
        </Tarjeta>
      ) : (
        <Tarjeta>
          <p className="text-lg font-semibold text-verde-oscuro">Sin genograma</p>
          <p className="mt-1 text-suave">
            Esta carpeta todavía no tiene genograma. Expórtalo desde GenoPro como {FORMATOS_GENOGRAMA} y súbelo aquí.
          </p>
        </Tarjeta>
      )}

      <FormularioCarga
        carpetaId={carpeta.id}
        reemplaza={Boolean(datos)}
        alCargar={() => {
          setExito(datos ? 'Genograma reemplazado.' : 'Genograma cargado.')
          recargar()
          requestAnimationFrame(() => refExito.current?.focus())
        }}
        alEmpezar={() => setExito(null)}
      />
    </div>
  )
}

/** Descarga el archivo con el token de la sesión y lo muestra desde una URL local (blob:), nunca pública. */
function Visor({ carpetaId, info, paciente }: { carpetaId: string; info: GenogramaInfo; paciente: string }) {
  const [archivo, setArchivo] = useState<{ url: string; blob: Blob } | null>(null)
  const [error, setError] = useState<unknown>(undefined)
  const [intento, setIntento] = useState(0)
  const [ampliado, setAmpliado] = useState(false)
  const refAmpliar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let vigente = true
    let url: string | null = null
    descargarGenograma(carpetaId).then(
      (recibido) => {
        if (!vigente) return
        url = URL.createObjectURL(recibido.contenido)
        setArchivo({ url, blob: recibido.contenido })
      },
      (e: unknown) => vigente && setError(e),
    )
    return () => {
      vigente = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [carpetaId, intento])

  const descargar = () =>
    archivo && guardarArchivo({ contenido: archivo.blob, nombre: info.nombre, tipo: info.tipo }, info.nombre)

  if (error !== undefined) {
    return (
      <div className="mt-4">
        <ErrorDeCarga
          error={error}
          alReintentar={() => {
            setError(undefined)
            setIntento((i) => i + 1)
          }}
          contexto="No se pudo abrir el archivo del genograma."
        />
      </div>
    )
  }
  if (!archivo) {
    return (
      <p role="status" className="mt-4 flex items-center gap-2 text-suave">
        <Indicador /> Abriendo genograma…
      </p>
    )
  }

  const descripcion = `Genograma de ${paciente}`
  return (
    <div className="mt-4 space-y-3">
      {esImagen(info.tipo) ? (
        <figure>
          <img
            src={archivo.url}
            alt={descripcion}
            className="max-h-[70vh] w-full rounded-2xl border border-linea bg-white object-contain"
          />
          <figcaption className="sr-only">{descripcion}</figcaption>
        </figure>
      ) : (
        <object
          data={archivo.url}
          type="application/pdf"
          title={descripcion}
          className="h-[70vh] w-full rounded-2xl border border-linea bg-white"
        >
          <p className="p-4 text-suave">
            Tu navegador no muestra el PDF aquí. Ábrelo en una pestaña nueva o descárgalo.
          </p>
        </object>
      )}
      <div className="flex flex-wrap gap-2">
        {esImagen(info.tipo) && (
          <Boton ref={refAmpliar} variante="secundario" icono="buscar" onClick={() => setAmpliado(true)}>
            Ampliar
          </Boton>
        )}
        <a href={archivo.url} target="_blank" rel="noopener noreferrer" className={claseBoton('secundario')}>
          Abrir en pestaña nueva
        </a>
        <Boton variante="texto" icono="documento" onClick={descargar}>
          Descargar
        </Boton>
      </div>
      {ampliado && (
        <Ampliacion
          url={archivo.url}
          descripcion={descripcion}
          alCerrar={() => {
            setAmpliado(false)
            requestAnimationFrame(() => refAmpliar.current?.focus())
          }}
        />
      )}
    </div>
  )
}

/** Vista a pantalla completa. Esc o «Cerrar» la cierran y el foco vuelve a «Ampliar». */
function Ampliacion({ url, descripcion, alCerrar }: { url: string; descripcion: string; alCerrar: () => void }) {
  const idTitulo = useId()
  const refCerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    refCerrar.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [alCerrar])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3 sm:p-6"
      onKeyDown={(e) => {
        // Único elemento enfocable: el foco no sale del diálogo.
        if (e.key === 'Tab') {
          e.preventDefault()
          refCerrar.current?.focus()
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 id={idTitulo} className="font-semibold text-white">
          {descripcion}
        </h2>
        <Boton ref={refCerrar} variante="secundario" icono="cerrar" onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-white">
        <img src={url} alt={descripcion} className="mx-auto max-w-none" />
      </div>
    </div>
  )
}

function FormularioCarga({
  carpetaId,
  reemplaza,
  alCargar,
  alEmpezar,
}: {
  carpetaId: string
  reemplaza: boolean
  alCargar: () => void
  alEmpezar: () => void
}) {
  const id = useId()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const refEntrada = useRef<HTMLInputElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (subiendo) return
    setFallo(null)
    const problema = validarArchivoGenograma(archivo)
    setError(problema)
    if (problema || !archivo) return refEntrada.current?.focus()

    setSubiendo(true)
    alEmpezar()
    try {
      await cargarGenograma(carpetaId, archivo)
      setArchivo(null)
      if (refEntrada.current) refEntrada.current.value = ''
      alCargar()
    } catch (e) {
      const especifico = mensajeCargaGenograma(e)
      setFallo(`${especifico ?? mensajeNoGuardado(e)}${reemplaza ? ' Se conserva el genograma anterior.' : ''}`)
      requestAnimationFrame(() => refFallo.current?.focus())
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">
        {reemplaza ? 'Reemplazar genograma' : 'Subir genograma'}
      </h2>
      <form noValidate onSubmit={enviar} className="mt-3 space-y-4">
        <div>
          <label htmlFor={id} className="block text-sm font-semibold text-texto">
            Archivo exportado de GenoPro
          </label>
          <input
            ref={refEntrada}
            id={id}
            type="file"
            accept={ACEPTA_GENOGRAMA}
            disabled={subiendo}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-${error ? 'error' : 'ayuda'}`}
            onChange={(e) => {
              const elegido = e.target.files?.[0] ?? null
              setArchivo(elegido)
              setError(elegido ? validarArchivoGenograma(elegido) : null)
            }}
            className="mt-1.5 block w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-verde/10 file:px-4 file:py-2 file:font-semibold file:text-verde-oscuro"
          />
          {error ? (
            <p id={`${id}-error`} className="mt-1.5 text-sm text-error">
              {error}
            </p>
          ) : (
            <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-suave">
              {FORMATOS_GENOGRAMA}, hasta 5 MB.{' '}
              {archivo ? `Elegido: ${archivo.name} (${tamanoLegible(archivo.size)}).` : ''}
              {reemplaza && ' El archivo nuevo reemplaza al actual.'}
            </p>
          )}
        </div>

        {fallo && (
          <Aviso ref={refFallo} tipo="error">
            <p>{fallo}</p>
          </Aviso>
        )}
        {subiendo && (
          <p role="status" className="flex items-center gap-2 text-sm text-suave">
            <Indicador /> Subiendo {archivo?.name}…
          </p>
        )}

        <Boton type="submit" icono="guardar" cargando={subiendo} textoCargando="Subiendo…">
          {reemplaza ? 'Reemplazar genograma' : 'Subir genograma'}
        </Boton>
      </form>
    </Tarjeta>
  )
}

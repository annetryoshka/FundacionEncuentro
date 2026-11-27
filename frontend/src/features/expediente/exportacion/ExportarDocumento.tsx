import { useId, useRef, useState, type FormEvent } from 'react'
import { mensajeErrorGeneral } from '../../../api/cliente'
import { Aviso, Boton, GrupoOpciones } from '../../../componentes/ui'
import { guardarArchivo } from '../../../utilidades/archivos'
import {
  NOMBRE_SECCION,
  SECCIONES,
  exportarDocumento,
  mensajeExportacion,
  nombreArchivo,
  type DocumentoExportable,
  type FormatoExportacion,
  type SeccionExportable,
} from './exportacion'

const FORMATOS: { valor: FormatoExportacion; nombre: string; descripcion: string }[] = [
  { valor: 'pdf', nombre: 'PDF', descripcion: 'Para enviar o imprimir tal como está.' },
  { valor: 'docx', nombre: 'Word editable', descripcion: 'Para seguir editándolo en Word.' },
]

const DOCUMENTOS: { valor: 'ficha' | 'historial'; nombre: string; descripcion: string }[] = [
  { valor: 'ficha', nombre: 'Ficha del caso', descripcion: 'Identificación, familia y diagnóstico.' },
  { valor: 'historial', nombre: 'Historial', descripcion: 'Todo el caso, con sesiones y tareas.' },
]

interface Props {
  carpetaId: string
  numeroCarpeta: number
  /** Informe: exporta esa versión revisada tal cual. Sin él, ficha o historial a elección. */
  informeVersionId?: string
  /** Pagos en el historial: solo administración (la API lo rechaza para otros roles). */
  puedeIncluirPagos?: boolean
}

/**
 * FE-160 · Opciones de formato y alcance, espera y descarga. Mientras genera no admite un segundo pedido;
 * un error se explica y deja las opciones como estaban para reintentar.
 */
export function ExportarDocumento({ carpetaId, numeroCarpeta, informeVersionId, puedeIncluirPagos = false }: Props) {
  const id = useId()
  const [documento, setDocumento] = useState<'ficha' | 'historial'>('ficha')
  const [formato, setFormato] = useState<FormatoExportacion>('pdf')
  const [secciones, setSecciones] = useState<SeccionExportable[]>(SECCIONES.ficha.porDefecto)
  const [incluirPagos, setIncluirPagos] = useState(false)
  const [incluirGenograma, setIncluirGenograma] = useState(false)
  const [estado, setEstado] = useState<'listo' | 'generando'>('listo')
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const enCurso = useRef(false)
  const refMensaje = useRef<HTMLDivElement>(null)
  const esInforme = Boolean(informeVersionId)

  const elegirDocumento = (d: 'ficha' | 'historial') => {
    setDocumento(d)
    setSecciones(SECCIONES[d].porDefecto)
    setIncluirPagos(false)
  }

  async function exportar(evento: FormEvent) {
    evento.preventDefault()
    if (enCurso.current) return
    if (!esInforme && secciones.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Elige al menos una sección.' })
      return
    }
    enCurso.current = true
    setEstado('generando')
    setMensaje(null)
    const doc: DocumentoExportable = esInforme ? 'informe' : documento
    try {
      const archivo = await exportarDocumento(
        carpetaId,
        esInforme
          ? { documento: 'informe', formato, informeVersionId }
          : {
              documento,
              formato,
              secciones,
              ...(incluirGenograma ? { incluirGenograma: true } : {}),
              ...(documento === 'historial' && incluirPagos ? { incluirPagos: true } : {}),
            },
      )
      guardarArchivo(archivo, nombreArchivo(doc, numeroCarpeta, formato))
      setMensaje({
        tipo: 'exito',
        texto: `Listo: se descargó ${archivo.nombre ?? nombreArchivo(doc, numeroCarpeta, formato)}.`,
      })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeExportacion(error) ?? `No se exportó. ${mensajeErrorGeneral(error)}` })
    } finally {
      enCurso.current = false
      setEstado('listo')
      requestAnimationFrame(() => refMensaje.current?.focus())
    }
  }

  const generando = estado === 'generando'
  return (
    <form noValidate onSubmit={exportar} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="text-lg font-semibold text-verde-oscuro">
        {esInforme ? 'Exportar informe revisado' : 'Exportar a PDF o Word'}
      </h2>
      <fieldset disabled={generando} className="mt-4 space-y-4">
        <legend className="sr-only">Opciones de exportación</legend>
        {!esInforme && (
          <GrupoOpciones
            leyenda="Documento"
            nombre={`${id}-documento`}
            opciones={DOCUMENTOS}
            valor={documento}
            alCambiar={elegirDocumento}
          />
        )}
        <GrupoOpciones
          leyenda="Formato"
          nombre={`${id}-formato`}
          opciones={FORMATOS}
          valor={formato}
          alCambiar={setFormato}
        />
        {!esInforme && (
          <fieldset>
            <legend className="text-sm font-semibold text-texto">Secciones</legend>
            <div className="mt-1.5 grid gap-2">
              {SECCIONES[documento].permitidas.map((s) => (
                <label key={s} className="flex items-center gap-3 text-texto">
                  <input
                    type="checkbox"
                    className="size-4 accent-verde"
                    checked={secciones.includes(s)}
                    onChange={(e) =>
                      setSecciones(e.target.checked ? [...secciones, s] : secciones.filter((x) => x !== s))
                    }
                  />
                  {NOMBRE_SECCION[s]}
                </label>
              ))}
              {documento === 'historial' && puedeIncluirPagos && (
                <label className="flex items-center gap-3 text-texto">
                  <input
                    type="checkbox"
                    className="size-4 accent-verde"
                    checked={incluirPagos}
                    onChange={(e) => setIncluirPagos(e.target.checked)}
                  />
                  Pagos por sesión (solo administración)
                </label>
              )}
              <label className="flex items-center gap-3 text-texto">
                <input
                  type="checkbox"
                  className="size-4 accent-verde"
                  checked={incluirGenograma}
                  onChange={(e) => setIncluirGenograma(e.target.checked)}
                />
                Incluir genograma familiar
              </label>
            </div>
          </fieldset>
        )}
        {esInforme && (
          <p className="text-sm text-suave">
            El informe se exporta tal como quedó al revisarlo, incluido el genograma si fue seleccionado en esa versión.
          </p>
        )}
        {!esInforme && (
          <p className="text-sm text-suave">
            El genograma se adjunta como imagen. Si no hay uno cargado, el archivo indicará su ausencia.
          </p>
        )}
      </fieldset>

      {mensaje && (
        <Aviso ref={refMensaje} tipo={mensaje.tipo} className="mt-4">
          <p>{mensaje.texto}</p>
        </Aviso>
      )}
      {generando && (
        <p role="status" className="mt-4 text-sm text-suave">
          Generando el archivo… puede tardar unos segundos.
        </p>
      )}
      <Boton type="submit" icono="descargar" className="mt-4" cargando={generando} textoCargando="Generando…">
        {formato === 'pdf' ? 'Descargar PDF' : 'Descargar Word'}
      </Boton>
    </form>
  )
}

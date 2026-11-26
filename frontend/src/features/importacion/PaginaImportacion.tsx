import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { Aviso, Boton, CampoTexto, EncabezadoPagina, Indicador, Tarjeta } from '../../componentes/ui'
import { tamanoLegible } from '../../utilidades/archivos'
import { mensajeNoGuardado } from '../expediente/errores'
import { COLUMNAS, cargarImportacion, plantillaCsv, validarArchivoImportacion } from './importacion'

/**
 * FE-165 · Paso 1 del asistente: subir el archivo normalizado. El servidor lo valida fila por fila y devuelve la
 * vista previa; nada se importa hasta confirmar.
 */
export function PaginaImportacion() {
  const id = useId()
  const navegar = useNavigate()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [origen, setOrigen] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fallo, setFallo] = useState<{ texto: string; loteId?: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const refEntrada = useRef<HTMLInputElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const urlPlantilla = useRef<string | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (subiendo) return
    setFallo(null)
    const problema = validarArchivoImportacion(archivo)
    setError(problema)
    if (problema || !archivo) return refEntrada.current?.focus()
    setSubiendo(true)
    try {
      const lote = await cargarImportacion(archivo, origen)
      navegar(`/importaciones/${lote.loteId}`)
    } catch (e) {
      setSubiendo(false)
      if (e instanceof ErrorApi && e.estado === 409 && typeof e.datos.loteId === 'string') {
        setFallo({ texto: 'Este archivo ya fue importado antes. No se vuelve a cargar.', loteId: e.datos.loteId })
      } else if (e instanceof ErrorApi && e.estado === 413) {
        setFallo({ texto: 'El archivo supera los 5 MB permitidos. Divide el lote en archivos más pequeños.' })
      } else if (e instanceof ErrorApi && (e.estado === 400 || e.estado === 415)) {
        setFallo({ texto: `El archivo no se pudo leer: ${e.message}.` })
      } else {
        setFallo({ texto: mensajeNoGuardado(e).replace('No se guardó', 'No se cargó') })
      }
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  const descargarPlantilla = () => {
    if (urlPlantilla.current) URL.revokeObjectURL(urlPlantilla.current)
    urlPlantilla.current = URL.createObjectURL(plantillaCsv())
    const enlace = document.createElement('a')
    enlace.href = urlPlantilla.current
    enlace.download = 'plantilla-importacion-historica.csv'
    enlace.click()
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Importar registros históricos"
        descripcion="Carga pacientes y casos de años anteriores desde una planilla. Revisarás cada fila antes de confirmar."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tarjeta>
          <form noValidate onSubmit={enviar}>
            <fieldset disabled={subiendo} className="space-y-5">
              <legend className="text-lg font-semibold text-verde-oscuro">1. Subir el archivo</legend>
              <div>
                <label htmlFor={id} className="block text-sm font-semibold text-texto">
                  Planilla de importación
                </label>
                <input
                  ref={refEntrada}
                  id={id}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-${error ? 'error' : 'ayuda'}`}
                  onChange={(e) => {
                    const elegido = e.target.files?.[0] ?? null
                    setArchivo(elegido)
                    setError(elegido ? validarArchivoImportacion(elegido) : null)
                  }}
                  className="mt-1.5 block w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-verde/10 file:px-4 file:py-2 file:font-semibold file:text-verde-oscuro"
                />
                {error ? (
                  <p id={`${id}-error`} className="mt-1.5 text-sm text-error">
                    {error}
                  </p>
                ) : (
                  <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-suave">
                    CSV en UTF-8 o XLSX con la hoja «Importacion», hasta 5 MB.
                    {archivo && ` Elegido: ${archivo.name} (${tamanoLegible(archivo.size)}).`}
                  </p>
                )}
              </div>
              <CampoTexto
                etiqueta="Origen del lote (opcional)"
                value={origen}
                maxLength={200}
                ayuda="Por ejemplo: «Archivo físico 2018, caja 3». Ayuda a rastrear de dónde vienen los datos."
                onChange={(e) => setOrigen(e.target.value)}
              />
              {fallo && (
                <Aviso ref={refFallo} tipo="error">
                  <p>{fallo.texto}</p>
                  {fallo.loteId && (
                    <Link to={`/importaciones/${fallo.loteId}`} className="font-semibold underline underline-offset-2">
                      Ver el resultado de esa importación
                    </Link>
                  )}
                </Aviso>
              )}
              {subiendo && (
                <p role="status" className="flex items-center gap-2 text-sm text-suave">
                  <Indicador /> Subiendo y validando {archivo?.name}…
                </p>
              )}
              <Boton type="submit" icono="importar" cargando={subiendo} textoCargando="Validando…">
                Subir y revisar
              </Boton>
            </fieldset>
          </form>
        </Tarjeta>

        <Tarjeta>
          <h2 className="font-semibold text-verde-oscuro">Plantilla</h2>
          <p className="mt-1 text-sm text-suave">
            El archivo debe tener exactamente estas {COLUMNAS.length} columnas, en este orden. Deja vacía la celda de un
            dato que no conozcas: no inventes fechas ni teléfonos.
          </p>
          <Boton variante="secundario" icono="descargar" className="mt-3" onClick={descargarPlantilla}>
            Descargar plantilla CSV
          </Boton>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-texto">Ver columnas</summary>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-suave">
              {COLUMNAS.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ol>
          </details>
        </Tarjeta>
      </div>
    </div>
  )
}

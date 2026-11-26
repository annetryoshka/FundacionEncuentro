import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, Boton, Cargando, EnlaceVolver, Tarjeta } from '../../componentes/ui'
import { guardarArchivo } from '../../utilidades/archivos'
import { fechaLarga } from '../../utilidades/fechas'
import { mensajeNoGuardado } from '../expediente/errores'
import {
  NOMBRE_SECCION_INV,
  confirmarRevision,
  descargarPaquete,
  obtenerRevision,
  type DocumentoInvestigacion,
} from './investigacion'

/**
 * FE-170 · Revisión del paquete antes de descargarlo. Se confirma con la huella (SHA-256) de lo que se leyó:
 * si el contenido cambió, el backend responde 409 y hay que volver a leer. Sin revisión vigente, la descarga es 409.
 */
export function PaginaRevisionInvestigacion() {
  const { id = '' } = useParams()
  const { datos, error, recargar } = useCarga(() => obtenerRevision(id), [id])
  const [revisadoEn, setRevisadoEn] = useState<string | null>(null)
  const [leido, setLeido] = useState(false)
  const [ocupado, setOcupado] = useState<'confirmando' | 'descargando' | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string; recargar?: boolean } | null>(null)
  const refMensaje = useRef<HTMLDivElement>(null)

  const avisar = (m: NonNullable<typeof mensaje>) => {
    setMensaje(m)
    requestAnimationFrame(() => refMensaje.current?.focus())
  }

  if (error !== undefined && !datos) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) {
      return (
        <div className="max-w-prose space-y-4">
          <EnlaceVolver a="/investigacion">Volver a investigación</EnlaceVolver>
          <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos este paquete</h1>
          <p className="text-suave">Puede que el enlace no sea correcto o que no tengas acceso a esos casos.</p>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir el paquete." />
  }
  if (!datos) return <Cargando texto="Preparando la vista de revisión…" />

  async function confirmar() {
    if (ocupado || !datos) return
    setOcupado('confirmando')
    try {
      const r = await confirmarRevision(id, datos.huella)
      setRevisadoEn(r.revisadoEn)
      avisar({ tipo: 'exito', texto: 'Revisión confirmada. Ya puedes descargar el paquete.' })
    } catch (e) {
      avisar(
        e instanceof ErrorApi && e.estado === 409
          ? {
              tipo: 'error',
              texto: `${e.message} Vuelve a leer el contenido actualizado antes de confirmar.`,
              recargar: true,
            }
          : { tipo: 'error', texto: mensajeNoGuardado(e) },
      )
    } finally {
      setOcupado(null)
    }
  }

  async function descargar() {
    if (ocupado) return
    setOcupado('descargando')
    try {
      guardarArchivo(await descargarPaquete(id), 'investigacion.zip')
      avisar({ tipo: 'exito', texto: 'Paquete descargado. Impórtalo en Atlas.ti como documentos con su manifiesto.' })
    } catch (e) {
      avisar(
        e instanceof ErrorApi && e.estado === 409
          ? { tipo: 'error', texto: `No se descargó: ${e.message}`, recargar: true }
          : { tipo: 'error', texto: mensajeNoGuardado(e).replace('No se guardó', 'No se descargó') },
      )
    } finally {
      setOcupado(null)
    }
  }

  const { manifiesto, documentos } = datos
  const periodo =
    manifiesto.periodo.desde || manifiesto.periodo.hasta
      ? `Sesiones del ${manifiesto.periodo.desde ? fechaLarga(manifiesto.periodo.desde) : 'inicio'} al ${manifiesto.periodo.hasta ? fechaLarga(manifiesto.periodo.hasta) : 'día de hoy'}`
      : 'Todas las sesiones'

  return (
    <div className="space-y-6">
      <EnlaceVolver a="/investigacion">Volver a investigación</EnlaceVolver>
      <div>
        <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Revisar paquete para Atlas.ti</h1>
        <p className="mt-1.5 max-w-prose text-suave">
          {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'} en formato{' '}
          {manifiesto.formato.toUpperCase()} · {periodo}. Lee cada documento y confirma que no hay datos que
          identifiquen a una persona.
        </p>
      </div>

      <Tarjeta>
        <h2 className="font-semibold text-verde-oscuro">Catálogo de categorías del paquete</h2>
        {manifiesto.catalogo.length === 0 ? (
          <p className="mt-1 text-sm text-suave">Sin categorías.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {manifiesto.catalogo.map((c) => (
              <li key={c.codigo}>
                <code className="font-semibold text-naranja-texto">{c.codigo}</code> · {c.nombre}
                {c.padre && <span className="text-suave"> (dentro de {c.padre})</span>}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <ul className="space-y-4">
        {documentos.map((d) => (
          <li key={d.idExportacion}>
            <Documento documento={d} />
          </li>
        ))}
      </ul>

      <Tarjeta className="space-y-4">
        {mensaje && (
          <Aviso ref={refMensaje} tipo={mensaje.tipo}>
            <p>{mensaje.texto}</p>
            {mensaje.recargar && (
              <Boton
                variante="texto"
                className="-ml-2"
                onClick={() => {
                  setMensaje(null)
                  setRevisadoEn(null)
                  setLeido(false)
                  recargar()
                }}
              >
                Volver a leer el contenido
              </Boton>
            )}
          </Aviso>
        )}
        {revisadoEn ? (
          <>
            <p className="text-sm text-suave">Revisado el {fechaLarga(revisadoEn)}.</p>
            <Boton
              icono="descargar"
              cargando={ocupado === 'descargando'}
              textoCargando="Descargando…"
              onClick={descargar}
            >
              Descargar paquete (.zip)
            </Boton>
          </>
        ) : (
          <>
            <label className="flex items-start gap-3 text-texto">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-verde"
                checked={leido}
                onChange={(e) => setLeido(e.target.checked)}
              />
              Leí todos los documentos y no contienen nombres ni otros datos que identifiquen a pacientes o familiares.
            </label>
            <Boton
              icono="guardar"
              disabled={!leido}
              cargando={ocupado === 'confirmando'}
              textoCargando="Confirmando…"
              onClick={confirmar}
            >
              Confirmar revisión
            </Boton>
            <p className="text-sm text-suave">
              Si encuentras un dato identificable, corrígelo en la carpeta (diagnóstico o sesión) y{' '}
              <Link to="/investigacion" className="font-semibold text-naranja-texto underline underline-offset-2">
                prepara un paquete nuevo
              </Link>
              .
            </p>
          </>
        )}
      </Tarjeta>
    </div>
  )
}

function Documento({ documento: d }: { documento: DocumentoInvestigacion }) {
  return (
    <article aria-labelledby={`doc-${d.idExportacion}`} className="rounded-3xl border border-linea bg-white p-5 sm:p-6">
      <h2 id={`doc-${d.idExportacion}`} className="font-semibold text-verde-oscuro">
        {d.idExportacion} <span className="font-normal text-suave">· {d.archivo}</span>
      </h2>
      <p className="text-sm text-suave">Secciones: {d.secciones.map((s) => NOMBRE_SECCION_INV[s] ?? s).join(', ')}</p>
      {d.categorias.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {d.categorias.map((c, i) => (
            <li key={i}>
              <code className="font-semibold text-naranja-texto">{c.codigo}</code>{' '}
              {c.ambito === 'caso'
                ? 'en todo el caso'
                : c.ambito === 'diagnostico'
                  ? 'en el diagnóstico'
                  : `en la sesión ${c.nroSesion ?? ''}`}
              {c.fragmento && <> · «{c.fragmento}»</>}
              {c.nota && <span className="text-suave"> · Nota: {c.nota}</span>}
            </li>
          ))}
        </ul>
      )}
      {d.diagnostico && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-texto">Diagnóstico de ingreso</h3>
          <p className="mt-1 whitespace-pre-line">{d.diagnostico.diagnosticoIngreso ?? 'Sin dato.'}</p>
          {d.diagnostico.hipotesisRelacional && (
            <p className="mt-1 whitespace-pre-line text-texto">
              <span className="font-semibold">Hipótesis relacional:</span> {d.diagnostico.hipotesisRelacional}
            </p>
          )}
          {d.diagnostico.comentariosClinicos && (
            <p className="mt-1 whitespace-pre-line">{d.diagnostico.comentariosClinicos}</p>
          )}
        </section>
      )}
      {d.seguimiento && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-texto">Seguimiento</h3>
          {d.seguimiento.length === 0 ? (
            <p className="mt-1 text-sm text-suave">Sin sesiones en el período.</p>
          ) : (
            <ol className="mt-1 space-y-3">
              {d.seguimiento.map((s) => (
                <li key={s.nroSesion}>
                  <p className="whitespace-pre-line">
                    <span className="font-semibold">
                      Sesión {s.nroSesion} · {s.mes}:
                    </span>{' '}
                    {s.evolucion}
                  </p>
                  {s.tareas && s.tareas.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                      {s.tareas.map((t, i) => (
                        <li key={i}>
                          {t.descripcion}{' '}
                          <span className="text-suave">({t.completada ? 'realizada' : 'pendiente'})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </article>
  )
}

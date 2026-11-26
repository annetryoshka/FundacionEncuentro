import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { ErrorApi } from '../../../api/cliente'
import { useCarga } from '../../../api/useCarga'
import { ErrorDeCarga } from '../../../componentes/ErrorDeCarga'
import { AreaTexto, Aviso, Boton, Cargando, Insignia, Tarjeta } from '../../../componentes/ui'
import { fechaLarga } from '../../../utilidades/fechas'
import { useSesion } from '../../auth/sesion'
import type { CarpetaDetalle } from '../../carpetas/tipos'
import { crearNombrador } from '../autoria'
import { mensajeNoGuardado } from '../errores'
import { ExportarDocumento } from '../exportacion/ExportarDocumento'
import { SeccionCarpeta } from '../SeccionCarpeta'
import {
  NOMBRE_TIPO_INFORME,
  obtenerInforme,
  revisarInforme,
  type SeccionInforme,
  type VersionInforme,
} from './informes'

/** FE-154 · Previsualizar, corregir y marcar como revisado un borrador. Revisado = versión cerrada y exportable. */
export function PaginaInforme() {
  return <SeccionCarpeta titulo="Informe">{(carpeta) => <VistaInforme carpeta={carpeta} />}</SeccionCarpeta>
}

function VistaInforme({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { versionId = '' } = useParams()
  const ubicacion = useLocation()
  const recienGenerado = Boolean((ubicacion.state as { recienGenerado?: boolean } | null)?.recienGenerado)
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerInforme(carpeta.id, versionId), [carpeta.id, versionId])
  const [revisado, setRevisado] = useState<VersionInforme | null>(null)
  const [editando, setEditando] = useState(false)
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) {
      return (
        <Tarjeta className="max-w-3xl">
          <p className="text-lg font-semibold text-verde-oscuro">No encontramos este informe</p>
          <p className="mt-1 text-suave">
            Puede que el enlace no sea correcto o que el caso ya no esté asignado a tu cuenta.
          </p>
        </Tarjeta>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir el informe." />
  }
  if (!datos) return <Cargando texto="Abriendo informe…" />
  const informe = revisado ?? datos
  const esBorrador = informe.estado === 'borrador'

  return (
    <div className="max-w-3xl space-y-4">
      {recienGenerado && esBorrador && !editando && (
        <Aviso tipo="exito">
          <p>Borrador generado. Revísalo y corrígelo antes de marcarlo como revisado.</p>
        </Aviso>
      )}
      {revisado && (
        <Aviso ref={refExito} tipo="exito">
          <p>Informe revisado. Esta versión ya no se puede editar y ya se puede exportar.</p>
        </Aviso>
      )}
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-verde-oscuro">{NOMBRE_TIPO_INFORME[informe.tipo]}</h2>
          <Insignia color={esBorrador ? 'naranja' : 'verde'}>{esBorrador ? 'Borrador' : 'Revisado'}</Insignia>
        </div>
        <p className="mt-1 text-sm text-suave">
          Versión {informe.nroVersion} · generada por {nombre(informe.creadoPor)} el {fechaLarga(informe.creadoEn)}
          {informe.revisadoEn && ` · revisada por ${nombre(informe.revisadoPor)} el ${fechaLarga(informe.revisadoEn)}`}
        </p>
      </Tarjeta>

      {esBorrador && editando ? (
        <EditorSecciones
          carpetaId={carpeta.id}
          informe={informe}
          alCancelar={() => setEditando(false)}
          alRevisar={(r) => {
            setRevisado(r)
            setEditando(false)
            requestAnimationFrame(() => refExito.current?.focus())
          }}
          alRecargar={() => {
            setEditando(false)
            recargar()
          }}
        />
      ) : (
        <>
          <article
            aria-label="Vista previa del informe"
            className="space-y-5 rounded-3xl border border-linea bg-white p-6 sm:p-8"
          >
            <p className="text-sm font-semibold text-naranja-texto">
              Carpeta Nº {carpeta.numero} · {carpeta.paciente.nombreCompleto}
            </p>
            {informe.secciones.map((s, i) => (
              <section key={i}>
                <h3 className="font-semibold text-verde-oscuro">{s.titulo}</h3>
                <p className="mt-1 leading-relaxed whitespace-pre-line text-texto">{s.contenido || '—'}</p>
              </section>
            ))}
          </article>
          {esBorrador ? (
            <Boton icono="editar" onClick={() => setEditando(true)}>
              Revisar y corregir
            </Boton>
          ) : (
            <Tarjeta>
              <ExportarDocumento carpetaId={carpeta.id} numeroCarpeta={carpeta.numero} informeVersionId={informe.id} />
            </Tarjeta>
          )}
        </>
      )}
    </div>
  )
}

function EditorSecciones({
  carpetaId,
  informe,
  alCancelar,
  alRevisar,
  alRecargar,
}: {
  carpetaId: string
  informe: VersionInforme
  alCancelar: () => void
  alRevisar: (r: VersionInforme) => void
  alRecargar: () => void
}) {
  const [secciones, setSecciones] = useState<SeccionInforme[]>(informe.secciones)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<{ texto: string; conflicto: boolean } | null>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const refConfirmar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmando) refConfirmar.current?.focus()
  }, [confirmando])

  async function revisar() {
    if (enviando) return
    setEnviando(true)
    setFallo(null)
    try {
      const r = await revisarInforme(carpetaId, informe.id, secciones)
      alRevisar({ ...informe, secciones, estado: 'revisado', revisadoPor: r.revisadoPor, revisadoEn: r.revisadoEn })
    } catch (error) {
      const conflicto = error instanceof ErrorApi && error.estado === 409
      setFallo({
        conflicto,
        texto: conflicto
          ? 'Esta versión ya fue revisada (quizá en otra pestaña). Tus correcciones no se guardaron.'
          : mensajeNoGuardado(error),
      })
      setEnviando(false)
      setConfirmando(false)
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  return (
    <div className="space-y-4">
      {secciones.map((s, i) => (
        <AreaTexto
          key={i}
          etiqueta={s.titulo}
          rows={Math.min(14, Math.max(3, Math.ceil(s.contenido.length / 90)))}
          value={s.contenido}
          disabled={enviando}
          onChange={(e) => setSecciones(secciones.map((x, j) => (j === i ? { ...x, contenido: e.target.value } : x)))}
        />
      ))}
      {fallo && (
        <Aviso ref={refFallo} tipo="error">
          <p>{fallo.texto}</p>
          {fallo.conflicto && (
            <Boton variante="texto" className="-ml-2" onClick={alRecargar}>
              Ver la versión revisada
            </Boton>
          )}
        </Aviso>
      )}
      {confirmando ? (
        <Aviso tipo="info">
          <p className="font-semibold">¿Marcar como revisado?</p>
          <p>Después no se puede volver a editar esta versión. Solo una versión revisada se puede exportar.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton ref={refConfirmar} icono="guardar" cargando={enviando} textoCargando="Guardando…" onClick={revisar}>
              Sí, marcar como revisado
            </Boton>
            <Boton variante="secundario" disabled={enviando} onClick={() => setConfirmando(false)}>
              Seguir corrigiendo
            </Boton>
          </div>
        </Aviso>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton variante="secundario" icono="cerrar" onClick={alCancelar}>
            Descartar cambios
          </Boton>
          <Boton icono="guardar" onClick={() => setConfirmando(true)}>
            Guardar como revisado
          </Boton>
        </div>
      )}
    </div>
  )
}

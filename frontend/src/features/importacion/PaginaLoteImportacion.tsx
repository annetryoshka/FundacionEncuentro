import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, Boton, CampoTexto, Cargando, EnlaceVolver, Insignia, Tarjeta } from '../../componentes/ui'
import { mensajeNoGuardado } from '../expediente/errores'
import { TablaRevisionImportacion } from './TablaRevisionImportacion'
import {
  COLUMNAS,
  NOMBRE_COLUMNA,
  NOMBRE_ESTADO_FILA,
  confirmarImportacion,
  corregirFila,
  decidirFila,
  filaPendiente,
  obtenerLote,
  type Coincidencia,
  type Columna,
  type Decision,
  type FilaImportacion,
  type LoteImportacion,
  type ResultadoImportacion,
} from './importacion'

type Filtro = 'todas' | 'pendientes' | 'errores' | 'duplicados'

/**
 * FE-165 · Pasos 2 y 3: revisar cada fila (decidir, corregir) y confirmar. Cada cambio devuelve la vista previa
 * con una versión nueva; si otra persona cambió el lote, el 409 obliga a recargar antes de seguir.
 */
export function PaginaLoteImportacion() {
  const { id = '' } = useParams()
  const { datos, error, recargar } = useCarga(() => obtenerLote(id), [id])
  const [lote, setLote] = useState<LoteImportacion | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  /** Cada recarga explícita reinicia la revisión (avisos de conflicto, motivos). */
  const [recargas, setRecargas] = useState(0)
  const actual = lote && lote.loteId === datos?.loteId && lote.version >= datos.version ? lote : datos

  if (error !== undefined && !actual) {
    if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 400)) {
      return (
        <div className="max-w-prose space-y-4">
          <EnlaceVolver a="/importaciones">Volver a importar</EnlaceVolver>
          <h1 className="text-2xl font-semibold text-verde-oscuro">No encontramos este lote de importación</h1>
        </div>
      )
    }
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo abrir el lote." />
  }
  if (!actual) return <Cargando texto="Abriendo vista previa…" />

  const recargarTodo = () => {
    setLote(null)
    setRecargas((n) => n + 1)
    recargar()
  }

  return (
    <div className="space-y-6">
      <EnlaceVolver a="/importaciones">Importar otro archivo</EnlaceVolver>
      <div>
        <p className="text-sm text-suave">{actual.origen ? `Origen: ${actual.origen}` : 'Sin origen indicado'}</p>
        <h1 className="text-2xl font-semibold break-words text-verde-oscuro sm:text-3xl">{actual.archivoNombre}</h1>
      </div>
      {resultado ? (
        <Resultado resultado={resultado} lote={actual} />
      ) : actual.estado === 'confirmada' ? (
        <ResultadoGuardado lote={actual} />
      ) : actual.estado === 'descartada' ? (
        <Aviso tipo="info">
          <p>Este lote fue descartado: no se importó nada.</p>
        </Aviso>
      ) : (
        <Revision
          key={recargas}
          lote={actual}
          alCambiar={setLote}
          alRecargar={recargarTodo}
          alConfirmar={setResultado}
        />
      )}
    </div>
  )
}

function Revision({
  lote,
  alCambiar,
  alRecargar,
  alConfirmar,
}: {
  lote: LoteImportacion
  alCambiar: (l: LoteImportacion) => void
  alRecargar: () => void
  alConfirmar: (r: ResultadoImportacion) => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [conflicto, setConflicto] = useState(false)
  const [motivos, setMotivos] = useState<Record<number, string>>({})
  const pendientes = lote.filas.filter(filaPendiente)
  const visibles = lote.filas.filter((f) =>
    filtro === 'pendientes'
      ? filaPendiente(f)
      : filtro === 'errores'
        ? f.estado === 'error'
        : filtro === 'duplicados'
          ? f.estado === 'posible_duplicado' || f.estado === 'duplicado_en_lote'
          : true,
  )

  /** Todas las escrituras pasan por aquí: 409 = el lote cambió y hay que recargar. */
  const aplicar = async (cambio: () => Promise<LoteImportacion>) => {
    try {
      alCambiar(await cambio())
      return null
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 409) {
        setConflicto(true)
        return 'El lote cambió en otra sesión. Recarga la vista previa.'
      }
      return mensajeNoGuardado(e)
    }
  }

  const resumen = [
    { nombre: 'Filas', valor: lote.resumen.total },
    { nombre: 'Válidas', valor: lote.resumen.validas },
    { nombre: 'Con advertencias', valor: lote.resumen.advertencias },
    { nombre: 'Con errores', valor: lote.resumen.errores },
  ]

  return (
    <div className="space-y-6">
      <section aria-labelledby="titulo-resumen-lote">
        <h2 id="titulo-resumen-lote" className="sr-only">
          Resumen del lote
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {resumen.map((r) => (
            <div key={r.nombre} className="rounded-2xl border border-linea bg-white px-4 py-3">
              <dt className="text-sm text-suave">{r.nombre}</dt>
              <dd className="text-2xl font-semibold text-verde-oscuro tabular-nums">{r.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      {conflicto && (
        <Aviso tipo="error">
          <p>Otra persona cambió este lote. Recarga la vista previa para ver la versión actual antes de seguir.</p>
          <Boton variante="texto" className="-ml-2" onClick={alRecargar}>
            Recargar vista previa
          </Boton>
        </Aviso>
      )}

      <div role="group" aria-label="Mostrar filas" className="flex flex-wrap gap-2">
        {(
          [
            ['todas', `Todas (${lote.filas.length})`],
            ['pendientes', `Por resolver (${pendientes.length})`],
            ['errores', `Con errores (${lote.resumen.errores})`],
            ['duplicados', `Duplicados (${lote.resumen.advertencias})`],
          ] as [Filtro, string][]
        ).map(([valor, nombre]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={filtro === valor}
            onClick={() => setFiltro(valor)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja ${
              filtro === valor
                ? 'border-verde bg-verde text-white'
                : 'border-linea bg-white text-verde hover:border-verde'
            }`}
          >
            {nombre}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p
          role="status"
          className="rounded-3xl border border-dashed border-linea bg-white px-6 py-8 text-center text-suave"
        >
          No hay filas en esta vista.
        </p>
      ) : (
        <div className="min-w-0 space-y-4">
          <TablaRevisionImportacion
            filas={visibles}
            bloqueada={conflicto}
            alRevisar={(numeroFila) => document.getElementById(`revision-fila-${numeroFila}`)?.focus()}
          />
          <ul className="space-y-3">
            {visibles.map((f) => (
              <li
                key={`${f.numeroFila}-${lote.version}`}
                id={`revision-fila-${f.numeroFila}`}
                tabIndex={-1}
                className="rounded-3xl focus-visible:outline-3 focus-visible:outline-naranja"
              >
                <TarjetaFila
                  fila={f}
                  lote={lote}
                  motivo={motivos[f.numeroFila]}
                  bloqueado={conflicto}
                  aplicar={aplicar}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Confirmacion
        lote={lote}
        pendientes={pendientes.length}
        bloqueado={conflicto}
        alConflicto={() => setConflicto(true)}
        alMotivos={(m) => {
          setMotivos(m)
          setFiltro('pendientes')
        }}
        alRevisar={alRecargar}
        alConfirmar={alConfirmar}
      />
    </div>
  )
}

interface Destino {
  clave: string
  texto: string
  cuerpo: { casoDestinoId?: string; pacienteDestinoId?: string; filaDestino?: number }
}

/** Opciones de destino para «vincular», según lo que encontró el servidor. */
function destinos(f: FilaImportacion): Destino[] {
  return f.coincidencias.flatMap((c: Coincidencia): Destino[] => {
    if (c.tipo === 'carpeta' && !c.eliminado) {
      return [
        {
          clave: `caso:${c.casoId}`,
          texto: `Carpeta existente Nº ${c.numero} (${c.tipoCaso}) · ${c.nombreCompleto}`,
          cuerpo: { casoDestinoId: c.casoId },
        },
      ]
    }
    if ((c.tipo === 'ya_importada' || c.tipo === 'referencia') && c.casoId) {
      return [
        {
          clave: `caso:${c.casoId}`,
          texto: `Caso de una importación anterior (fila ${c.numeroFila})`,
          cuerpo: { casoDestinoId: c.casoId },
        },
      ]
    }
    if (c.tipo === 'nombre') {
      return [
        {
          clave: `paciente:${c.pacienteId}`,
          texto: `Paciente ya registrado: ${c.nombreCompleto} (${Math.round(c.similitud * 100)}% parecido${c.mismaFechaNacimiento ? ', misma fecha de nacimiento' : ''}) · abre un caso nuevo`,
          cuerpo: { pacienteDestinoId: c.pacienteId },
        },
      ]
    }
    if (c.tipo === 'fila') {
      return [
        {
          clave: `fila:${c.numeroFila}`,
          texto: `El paciente de la fila ${c.numeroFila} de este archivo`,
          cuerpo: { filaDestino: c.numeroFila },
        },
      ]
    }
    return []
  })
}

function textoCoincidencia(c: Coincidencia) {
  switch (c.tipo) {
    case 'carpeta':
      return `Ya existe la carpeta Nº ${c.numero} (${c.tipoCaso}) de ${c.nombreCompleto}${c.eliminado ? ' (eliminada)' : ''}.`
    case 'ya_importada':
      return `Esta misma fila ya se importó antes (fila ${c.numeroFila}).`
    case 'referencia':
      return `La referencia de origen ya se usó en una importación anterior (fila ${c.numeroFila}).`
    case 'nombre':
      return `Nombre parecido a ${c.nombreCompleto} (${Math.round(c.similitud * 100)}%). Puede ser otra persona.`
    case 'fila':
      return c.mismoNumero
        ? `La fila ${c.numeroFila} usa el mismo número de carpeta.`
        : `La fila ${c.numeroFila} tiene un nombre parecido.`
  }
}

const NOMBRE_DECISION: Record<Decision, string> = {
  crear: 'Crear paciente y carpeta',
  vincular: 'Vincular a uno existente',
  excluir: 'No importar esta fila',
}

function TarjetaFila({
  fila,
  lote,
  motivo,
  bloqueado,
  aplicar,
}: {
  fila: FilaImportacion
  lote: LoteImportacion
  motivo?: string
  bloqueado: boolean
  aplicar: (cambio: () => Promise<LoteImportacion>) => Promise<string | null>
}) {
  const opciones = destinos(fila)
  const [decision, setDecision] = useState<Decision | ''>(fila.decision ?? '')
  const [destino, setDestino] = useState(opciones[0]?.clave ?? '')
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const pendiente = filaPendiente(fila)
  const nombre = fila.datos.nombreCompleto?.trim() || 'Sin nombre'
  const titulo = `Fila ${fila.numeroFila}${fila.referenciaOrigen ? ` · ${fila.referenciaOrigen}` : ''} · ${nombre}`

  async function guardarDecision(evento: FormEvent) {
    evento.preventDefault()
    if (!decision || ocupado) return
    const elegido = opciones.find((o) => o.clave === destino)
    if (decision === 'vincular' && !elegido) return setFallo('Elige a quién vincular la fila.')
    setOcupado(true)
    setFallo(
      await aplicar(() =>
        decidirFila(lote.loteId, fila.numeroFila, {
          version: lote.version,
          decision,
          ...(decision === 'vincular' ? elegido!.cuerpo : {}),
        }),
      ),
    )
    setOcupado(false)
  }

  return (
    <Tarjeta className={pendiente ? 'border-naranja/60' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold break-words text-verde-oscuro">{titulo}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Insignia color={fila.estado === 'valida_nueva' ? 'verde' : fila.estado === 'error' ? 'naranja' : 'gris'}>
            {NOMBRE_ESTADO_FILA[fila.estado]}
          </Insignia>
          {pendiente ? (
            <Insignia color="naranja">Por resolver</Insignia>
          ) : (
            <Insignia color="verde">{NOMBRE_DECISION[fila.decision!]}</Insignia>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-suave">
        {[
          fila.datos.tipo,
          fila.datos.numeroCorrelativo && `Nº ${fila.datos.numeroCorrelativo}`,
          fila.datos.fechaIngreso && `ingreso ${fila.datos.fechaIngreso}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'Sin datos del caso'}
      </p>

      {motivo && <p className="mt-2 text-sm font-semibold text-error">Al confirmar: {motivo}</p>}
      {fila.errores.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-error">
          {fila.errores.map((e, i) => (
            <li key={i}>
              <strong>{NOMBRE_COLUMNA[e.campo as Columna] ?? e.campo}:</strong> {e.mensaje}
            </li>
          ))}
        </ul>
      )}
      {fila.coincidencias.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-texto">
          {fila.coincidencias.map((c, i) => (
            <li key={i}>{textoCoincidencia(c)}</li>
          ))}
        </ul>
      )}
      {fila.advertencias.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-suave">
          {fila.advertencias.map((a, i) => (
            <li key={i}>⚠ {a.mensaje}</li>
          ))}
        </ul>
      )}

      {corrigiendo ? (
        <CorreccionFila
          fila={fila}
          alCancelar={() => setCorrigiendo(false)}
          alGuardar={async (datos) => {
            const problema = await aplicar(() => corregirFila(lote.loteId, fila.numeroFila, lote.version, datos))
            if (!problema) setCorrigiendo(false)
            return problema
          }}
        />
      ) : (
        <form onSubmit={guardarDecision} className="mt-4 space-y-3">
          <fieldset disabled={ocupado || bloqueado}>
            <legend className="text-sm font-semibold text-texto">Decisión para {titulo}</legend>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {(['crear', 'vincular', 'excluir'] as Decision[]).map((d) => {
                const deshabilitada =
                  (d === 'crear' && fila.estado === 'error') || (d === 'vincular' && opciones.length === 0)
                return (
                  <label
                    key={d}
                    className={`flex items-center gap-2 text-sm ${deshabilitada ? 'text-suave' : 'text-texto'}`}
                  >
                    <input
                      type="radio"
                      name={`decision-${fila.numeroFila}`}
                      className="size-4 accent-verde"
                      checked={decision === d}
                      disabled={deshabilitada}
                      onChange={() => setDecision(d)}
                    />
                    {NOMBRE_DECISION[d]}
                  </label>
                )
              })}
            </div>
            {decision === 'vincular' && opciones.length > 0 && (
              <label className="mt-3 block text-sm">
                <span className="font-semibold text-texto">Vincular con</span>
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-sm"
                >
                  {opciones.map((o) => (
                    <option key={o.clave} value={o.clave}>
                      {o.texto}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
          {fallo && (
            <p role="alert" className="text-sm text-error">
              {fallo}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Boton
              type="submit"
              variante="secundario"
              icono="guardar"
              cargando={ocupado}
              disabled={!decision || bloqueado}
            >
              Aplicar decisión
            </Boton>
            <Boton variante="texto" icono="editar" disabled={bloqueado} onClick={() => setCorrigiendo(true)}>
              Corregir datos
            </Boton>
          </div>
        </form>
      )}
    </Tarjeta>
  )
}

function CorreccionFila({
  fila,
  alGuardar,
  alCancelar,
}: {
  fila: FilaImportacion
  alGuardar: (datos: Partial<Record<Columna, string | null>>) => Promise<string | null>
  alCancelar: () => void
}) {
  const [valores, setValores] = useState<Record<Columna, string>>(
    () => Object.fromEntries(COLUMNAS.map((c) => [c, fila.datos[c] ?? ''])) as Record<Columna, string>,
  )
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const conError = new Set(fila.errores.map((e) => e.campo))
  const refPrimero = useRef<HTMLDivElement>(null)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    // Solo se envían las columnas cambiadas; vacío = sin dato (null).
    const cambios = Object.fromEntries(
      COLUMNAS.filter((c) => (fila.datos[c] ?? '') !== valores[c]).map((c) => [c, valores[c].trim() || null]),
    )
    if (Object.keys(cambios).length === 0) return alCancelar()
    setGuardando(true)
    setFallo(await alGuardar(cambios))
    setGuardando(false)
  }

  // Primero las columnas con error, para corregir sin buscar.
  const orden = [...COLUMNAS].sort((a, b) => Number(conError.has(b)) - Number(conError.has(a)))
  return (
    <form noValidate onSubmit={guardar} className="mt-4 space-y-4 rounded-2xl bg-crema p-4">
      <fieldset disabled={guardando}>
        <legend className="font-semibold text-verde-oscuro">Corregir la fila {fila.numeroFila}</legend>
        <div ref={refPrimero} className="mt-3 grid gap-3 sm:grid-cols-2">
          {orden.map((c) => (
            <CampoTexto
              key={c}
              etiqueta={NOMBRE_COLUMNA[c]}
              value={valores[c]}
              error={conError.has(c) ? fila.errores.find((e) => e.campo === c)?.mensaje : undefined}
              onChange={(e) => setValores({ ...valores, [c]: e.target.value })}
            />
          ))}
        </div>
      </fieldset>
      {fallo && (
        <p role="alert" className="text-sm text-error">
          {fallo}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" icono="guardar" cargando={guardando} textoCargando="Validando…">
          Guardar y volver a validar
        </Boton>
        <Boton variante="secundario" icono="cerrar" disabled={guardando} onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

function Confirmacion({
  lote,
  pendientes,
  bloqueado,
  alConflicto,
  alMotivos,
  alRevisar,
  alConfirmar,
}: {
  lote: LoteImportacion
  pendientes: number
  bloqueado: boolean
  alConflicto: () => void
  alMotivos: (m: Record<number, string>) => void
  alRevisar: () => void
  alConfirmar: (r: ResultadoImportacion) => void
}) {
  const [saltos, setSaltos] = useState<{ tipo: string; ultimoActual: number; nuevoUltimo: number }[] | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const refMensaje = useRef<HTMLDivElement>(null)
  const aImportar = lote.filas.filter((f) => f.decision && f.decision !== 'excluir').length

  async function confirmar() {
    if (enviando || pendientes > 0) return
    setEnviando(true)
    setMensaje(null)
    try {
      const r = await confirmarImportacion(lote.loteId, lote.version, acepta)
      if (r.estado === 'revisar') {
        setMensaje(
          `Al volver a validar cambiaron las filas ${r.filas.join(', ')}. No se importó nada: revísalas otra vez.`,
        )
        alRevisar()
      } else {
        alConfirmar(r)
      }
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 422 && Array.isArray(e.datos.saltos)) {
        setSaltos(e.datos.saltos as typeof saltos)
        setMensaje('Los números de carpeta del archivo harán avanzar el contador. Confírmalo para continuar.')
      } else if (e instanceof ErrorApi && e.estado === 422 && Array.isArray(e.datos.filas)) {
        const filas = e.datos.filas as { numeroFila: number; motivo: string }[]
        alMotivos(Object.fromEntries(filas.map((f) => [f.numeroFila, f.motivo])))
        setMensaje(
          filas.length
            ? `Hay ${filas.length} ${filas.length === 1 ? 'fila' : 'filas'} sin resolver. No se importó nada.`
            : 'No quedan filas para importar.',
        )
      } else if (e instanceof ErrorApi && e.estado === 409) {
        alConflicto()
        setMensaje('El lote cambió desde la vista previa. No se importó nada.')
      } else {
        setMensaje(
          `${mensajeNoGuardado(e).replace('No se guardó', 'No se importó')} El lote no quedó a medias: puedes reintentar.`,
        )
      }
    } finally {
      setEnviando(false)
      requestAnimationFrame(() => refMensaje.current?.focus())
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Confirmar importación</h2>
      <p className="mt-1 text-sm text-suave">
        {pendientes > 0
          ? `Faltan ${pendientes} ${pendientes === 1 ? 'fila' : 'filas'} por resolver: decide qué hacer con cada una o corrígela.`
          : `Se importarán ${aImportar} ${aImportar === 1 ? 'fila' : 'filas'}. Todo se guarda junto: si algo falla, no se importa nada.`}
      </p>
      {mensaje && (
        <Aviso ref={refMensaje} tipo="error" className="mt-3">
          <p>{mensaje}</p>
        </Aviso>
      )}
      {saltos && (
        <label className="mt-3 flex items-start gap-3 text-texto">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-verde"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
          />
          <span>
            Acepto que el contador avance:{' '}
            {saltos.map((s) => `${s.tipo} del Nº ${s.ultimoActual} al Nº ${s.nuevoUltimo}`).join('; ')}. Las carpetas
            nuevas continuarán desde ese número.
          </span>
        </label>
      )}
      <Boton
        className="mt-4"
        icono="guardar"
        cargando={enviando}
        textoCargando="Importando…"
        disabled={pendientes > 0 || bloqueado || (saltos !== null && !acepta)}
        onClick={confirmar}
      >
        Confirmar importación
      </Boton>
    </Tarjeta>
  )
}

const NOMBRE_RESULTADO = { creada: 'Creada', vinculada: 'Vinculada', excluida: 'No importada' } as const

function Resultado({ resultado, lote }: { resultado: ResultadoImportacion; lote: LoteImportacion }) {
  const refTitulo = useRef<HTMLHeadingElement>(null)
  return (
    <section aria-labelledby="titulo-resultado" className="space-y-4">
      <Aviso tipo="exito">
        <h2 id="titulo-resultado" ref={refTitulo} className="font-semibold">
          Importación confirmada
        </h2>
        <p>
          {resultado.creadas} {resultado.creadas === 1 ? 'carpeta creada' : 'carpetas creadas'}, {resultado.vinculadas}{' '}
          {resultado.vinculadas === 1 ? 'vinculada' : 'vinculadas'} y {resultado.excluidas}{' '}
          {resultado.excluidas === 1 ? 'fila no importada' : 'filas no importadas'}.
        </p>
      </Aviso>
      <ul className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white">
        {resultado.filas.map((f) => {
          const nombre = lote.filas.find((x) => x.numeroFila === f.numeroFila)?.datos.nombreCompleto ?? ''
          return (
            <li key={f.numeroFila} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="min-w-0">
                Fila {f.numeroFila}
                {f.referenciaOrigen && ` · ${f.referenciaOrigen}`}
                {nombre && ` · ${nombre}`}
              </span>
              <span className="flex items-center gap-3">
                <Insignia color={f.resultado === 'excluida' ? 'gris' : 'verde'}>
                  {NOMBRE_RESULTADO[f.resultado]}
                </Insignia>
                {f.casoId && (
                  <Link
                    to={`/carpetas/${f.casoId}`}
                    className="text-sm font-semibold text-naranja-texto underline underline-offset-4"
                  >
                    Abrir carpeta{f.numeroCorrelativo ? ` Nº ${f.numeroCorrelativo}` : ''}
                  </Link>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Al recargar un lote ya confirmado: el resultado de cada fila (sin enlaces; el servidor no los devuelve aquí). */
function ResultadoGuardado({ lote }: { lote: LoteImportacion }) {
  const cuenta = (r: string) => lote.filas.filter((f) => f.resultado === r).length
  return (
    <section className="space-y-4">
      <Aviso tipo="exito">
        <p className="font-semibold">Este lote ya fue importado.</p>
        <p>
          {cuenta('creada')} creadas, {cuenta('vinculada')} vinculadas y {cuenta('excluida')} no importadas. Volver a
          confirmar no duplica nada.
        </p>
      </Aviso>
      <ul className="divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white">
        {lote.filas.map((f) => (
          <li key={f.numeroFila} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <span>
              Fila {f.numeroFila}
              {f.referenciaOrigen && ` · ${f.referenciaOrigen}`} · {f.datos.nombreCompleto || 'Sin nombre'}
            </span>
            {f.resultado && (
              <Insignia color={f.resultado === 'excluida' ? 'gris' : 'verde'}>{NOMBRE_RESULTADO[f.resultado]}</Insignia>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

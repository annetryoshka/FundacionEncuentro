import { useRef, useState, type FormEvent } from 'react'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Aviso, Boton, CampoTexto, Cargando, GrupoOpciones, Tarjeta } from '../../componentes/ui'
import { claseCampo } from '../../componentes/estilos'
import { esFechaValida, fechaCorta, fechaLarga, hoyIso } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { enfocarPrimerError, mensajeNoGuardado } from './errores'
import { listarPagos, listarSesiones, registrarPago } from './expedienteApi'
import { bolivianos, normalizarMonto } from './moneda'
import { SeccionCarpeta } from './SeccionCarpeta'
import { NOMBRE_METODO_PAGO, type MetodoPago, type Pago, type SesionResumen } from './tipos'

/**
 * FE-87 · Pagos del caso (solo administración, reglas FE-86). Un pago por sesión, en BOB con hasta dos
 * decimales, por QR o transferencia. Repetir el mismo registro no lo duplica.
 */
export function PaginaPagos() {
  return <SeccionCarpeta titulo="Pagos">{(carpeta) => <VistaPagos carpeta={carpeta} />}</SeccionCarpeta>
}

function VistaPagos({ carpeta }: { carpeta: CarpetaDetalle }) {
  const pagos = useCarga(() => listarPagos(carpeta.id), [carpeta.id])
  const sesiones = useCarga(() => listarSesiones(carpeta.id), [carpeta.id])
  const [nuevos, setNuevos] = useState<Pago[]>([])

  const lista = [...(pagos.datos ?? []), ...nuevos.filter((n) => !pagos.datos?.some((p) => p.id === n.id))].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn),
  )
  const sesionPorId = new Map(sesiones.datos?.map((s) => [s.id, s]))
  const total = lista.reduce((suma, p) => suma + Math.round(Number(p.monto) * 100), 0) / 100

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <Tarjeta>
        <h2 className="text-lg font-semibold text-verde-oscuro">Pagos registrados</h2>
        <div className="mt-4">
          {pagos.error !== undefined ? (
            <ErrorDeCarga
              error={pagos.error}
              alReintentar={pagos.recargar}
              contexto="No se pudieron cargar los pagos."
            />
          ) : !pagos.datos ? (
            <Cargando texto="Cargando pagos…" />
          ) : lista.length === 0 ? (
            <p className="text-suave">Aún no hay pagos registrados en esta carpeta.</p>
          ) : (
            <>
              <ul className="divide-y divide-linea">
                {lista.map((p) => {
                  const sesion = sesionPorId.get(p.sesionId)
                  return (
                    <li key={p.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                      <span>
                        <span className="font-semibold text-texto">
                          {sesion ? `Sesión ${sesion.numero} (${fechaCorta(sesion.fecha)})` : 'Sesión'}
                        </span>
                        <span className="block text-sm text-suave">
                          Pagado el {fechaLarga(p.fecha)} · {NOMBRE_METODO_PAGO[p.metodo]}
                          {p.referencia && ` · Ref. ${p.referencia}`}
                        </span>
                      </span>
                      <span className="font-semibold text-verde-oscuro tabular-nums">{bolivianos(p.monto)}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 flex justify-between border-t border-linea pt-3 font-semibold">
                <span>Total pagado</span>
                <span className="tabular-nums">{bolivianos(total)}</span>
              </p>
            </>
          )}
        </div>
      </Tarjeta>

      {sesiones.error !== undefined ? (
        <ErrorDeCarga
          error={sesiones.error}
          alReintentar={sesiones.recargar}
          contexto="No se pudieron cargar las sesiones para registrar un pago."
        />
      ) : !sesiones.datos || !pagos.datos ? (
        <Cargando />
      ) : (
        <FormularioPago
          carpetaId={carpeta.id}
          sesiones={sesiones.datos.filter((s) => !lista.some((p) => p.sesionId === s.id))}
          haySesiones={sesiones.datos.length > 0}
          alRegistrar={(pago) => setNuevos((previos) => [...previos, pago])}
        />
      )}
    </div>
  )
}

interface Errores {
  sesionId?: string
  monto?: string
  fecha?: string
  metodo?: string
}

function FormularioPago({
  carpetaId,
  sesiones,
  haySesiones,
  alRegistrar,
}: {
  carpetaId: string
  sesiones: SesionResumen[]
  haySesiones: boolean
  alRegistrar: (pago: Pago) => void
}) {
  const [sesionId, setSesionId] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')
  const [referencia, setReferencia] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null)
  const refFormulario = useRef<HTMLFormElement>(null)
  const refResultado = useRef<HTMLDivElement>(null)

  if (!haySesiones || sesiones.length === 0) {
    return (
      <Tarjeta>
        <h2 className="text-lg font-semibold text-verde-oscuro">Registrar pago</h2>
        {resultado && (
          <Aviso tipo={resultado.tipo} className="mt-3">
            {resultado.texto}
          </Aviso>
        )}
        <p className="mt-2 text-suave">
          {haySesiones
            ? 'Todas las sesiones de esta carpeta ya tienen su pago registrado.'
            : 'Los pagos se registran por sesión. Esta carpeta todavía no tiene sesiones.'}
        </p>
      </Tarjeta>
    )
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    const e: Errores = {}
    const montoNormalizado = normalizarMonto(monto)
    if (!sesionId) e.sesionId = 'Elige la sesión que se paga.'
    if (!monto.trim()) e.monto = 'Indica el monto.'
    else if (!montoNormalizado) e.monto = 'Monto no válido: usa hasta 8 cifras y 2 decimales, por ejemplo 75,50.'
    else if (Number(montoNormalizado) <= 0) e.monto = 'El monto debe ser mayor que cero.'
    if (!fecha) e.fecha = 'Indica la fecha del pago.'
    else if (!esFechaValida(fecha)) e.fecha = 'La fecha no es válida.'
    if (!metodo) e.metodo = 'Elige el método de pago.'
    setErrores(e)
    setResultado(null)
    if (Object.keys(e).length > 0 || !montoNormalizado || !metodo) {
      enfocarPrimerError(refFormulario.current)
      return
    }
    setGuardando(true)
    try {
      const { pago, reutilizado } = await registrarPago(carpetaId, {
        sesionId,
        monto: montoNormalizado,
        fecha,
        metodo,
        referencia: referencia.trim() || null,
      })
      alRegistrar(pago)
      setResultado(
        reutilizado
          ? { tipo: 'info', texto: 'Ese pago ya estaba registrado; no se duplicó.' }
          : { tipo: 'exito', texto: `Pago de ${bolivianos(pago.monto)} registrado.` },
      )
      setSesionId('')
      setMonto('')
      setReferencia('')
      setMetodo('')
    } catch (error) {
      setResultado({ tipo: 'error', texto: mensajeNoGuardado(error) })
    } finally {
      setGuardando(false)
      requestAnimationFrame(() => refResultado.current?.focus())
    }
  }

  return (
    <Tarjeta>
      <form ref={refFormulario} onSubmit={enviar} noValidate className="space-y-5">
        <h2 className="text-lg font-semibold text-verde-oscuro">Registrar pago</h2>
        <div>
          <label htmlFor="pago-sesion" className="block text-sm font-semibold text-texto">
            Sesión
          </label>
          <select
            id="pago-sesion"
            value={sesionId}
            onChange={(e) => setSesionId(e.target.value)}
            aria-invalid={errores.sesionId ? true : undefined}
            aria-describedby={errores.sesionId ? 'pago-sesion-error' : undefined}
            className={claseCampo(Boolean(errores.sesionId))}
          >
            <option value="">Elige una sesión</option>
            {sesiones.map((s) => (
              <option key={s.id} value={s.id}>
                Sesión {s.numero} · {fechaCorta(s.fecha)}
              </option>
            ))}
          </select>
          {errores.sesionId && (
            <p id="pago-sesion-error" className="mt-1.5 text-sm text-error">
              {errores.sesionId}
            </p>
          )}
        </div>
        <CampoTexto
          etiqueta="Monto (Bs)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="75,50"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          error={errores.monto}
        />
        <CampoTexto
          etiqueta="Fecha del pago"
          type="date"
          max="9999-12-31"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={errores.fecha}
        />
        <GrupoOpciones<MetodoPago>
          leyenda="Método"
          nombre="metodo-pago"
          valor={metodo}
          alCambiar={setMetodo}
          error={errores.metodo}
          opciones={[
            { valor: 'qr', nombre: 'QR' },
            { valor: 'transferencia', nombre: 'Transferencia' },
          ]}
        />
        <CampoTexto
          etiqueta="Referencia (opcional)"
          value={referencia}
          maxLength={500}
          onChange={(e) => setReferencia(e.target.value)}
          ayuda="Número de comprobante o de la transacción."
        />
        {resultado && (
          <Aviso ref={refResultado} tipo={resultado.tipo}>
            {resultado.texto}
          </Aviso>
        )}
        <Boton type="submit" className="w-full" cargando={guardando} textoCargando="Registrando…">
          Registrar pago
        </Boton>
      </form>
    </Tarjeta>
  )
}

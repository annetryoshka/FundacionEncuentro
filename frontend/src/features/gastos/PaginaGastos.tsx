import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Icono } from '../../componentes/iconos'
import {
  Aviso,
  Boton,
  CampoTexto,
  Cargando,
  EncabezadoPagina,
  GrupoOpciones,
  Insignia,
  Tarjeta,
} from '../../componentes/ui'
import { fechaCorta, hoyIso } from '../../utilidades/fechas'
import { enfocarPrimerError, mensajeNoGuardado } from '../expediente/errores'
import { bolivianos } from '../expediente/moneda'
import {
  CATEGORIAS_GASTO,
  MES,
  NOMBRE_CATEGORIA_GASTO,
  aDatos,
  aFormulario,
  anularGasto,
  consultarGastos,
  corregirGasto,
  formularioVacio,
  mesActual,
  moverMes,
  nombreMes,
  registrarGasto,
  validarGasto,
  type CategoriaGasto,
  type ErroresGasto,
  type FormularioGasto,
  type Gasto,
} from './gastos'

const OPCIONES = CATEGORIAS_GASTO.map((valor) => ({ valor, nombre: NOMBRE_CATEGORIA_GASTO[valor] }))

/**
 * FE-175 · Gastos de funcionamiento (internet, electricidad, alquiler y otros) de un mes, con su total y los
 * totales por tipo. Registrar, corregir y anular. El mes vive en la URL (?mes=AAAA-MM).
 */
export function PaginaGastos() {
  const [parametros, setParametros] = useSearchParams()
  const mesUrl = parametros.get('mes') ?? ''
  const mes = MES.test(mesUrl) ? mesUrl : mesActual()
  const { datos, error, cargando, recargar } = useCarga(() => consultarGastos(mes), [mes])
  const [aviso, setAviso] = useState<string | null>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  const irA = (nuevo: string) => {
    setAviso(null)
    setParametros(nuevo === mesActual() ? {} : { mes: nuevo })
  }

  /** Tras cada escritura se vuelve a consultar el mes: los totales salen siempre del servidor. */
  const avisarYRecargar = (texto: string) => {
    setAviso(texto)
    recargar()
    requestAnimationFrame(() => refAviso.current?.focus())
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Gastos del mes"
        descripcion="Gastos de funcionamiento de la Fundación: internet, electricidad, alquiler y otros. Solo administración."
      />

      <nav aria-label="Mes" className="flex flex-wrap items-center gap-2" data-recorrido="gastos-mes">
        <Boton variante="secundario" icono="anterior" onClick={() => irA(moverMes(mes, -1))}>
          <span className="sr-only">Mes anterior</span>
        </Boton>
        <label className="sr-only" htmlFor="gastos-mes">
          Mes
        </label>
        <input
          id="gastos-mes"
          type="month"
          value={mes}
          max={mesActual()}
          onChange={(e) => MES.test(e.target.value) && irA(e.target.value)}
          className="rounded-full border border-linea bg-white px-4 py-2.5 font-semibold text-texto"
        />
        <Boton variante="secundario" disabled={mes >= mesActual()} onClick={() => irA(moverMes(mes, 1))}>
          <span className="sr-only">Mes siguiente</span>
          <Icono nombre="siguiente" className="size-[1.125rem]" />
        </Boton>
        <h2 className="ml-1 text-lg font-semibold text-verde-oscuro first-letter:uppercase">{nombreMes(mes)}</h2>
      </nav>

      {aviso && (
        <Aviso ref={refAviso} tipo="exito">
          <p>{aviso}</p>
        </Aviso>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {error !== undefined ? (
            <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron cargar los gastos del mes." />
          ) : !datos ? (
            <Cargando texto="Cargando gastos…" />
          ) : (
            <div aria-busy={cargando} className={`space-y-6 ${cargando ? 'opacity-60' : ''}`}>
              <section aria-labelledby="titulo-totales" data-recorrido="gastos-totales">
                <h2 id="titulo-totales" className="sr-only">
                  Totales del mes
                </h2>
                <div className="rounded-3xl bg-verde-oscuro px-6 py-5 text-white">
                  <p className="text-sm text-white/80">Total gastado en {nombreMes(datos.mes)}</p>
                  <p className="text-3xl font-semibold tabular-nums">{bolivianos(datos.totalMes)}</p>
                  <p className="mt-1 text-sm text-white/80">
                    {datos.cantidadVigentes} {datos.cantidadVigentes === 1 ? 'gasto' : 'gastos'}
                    {datos.cantidadAnulados > 0 &&
                      ` · ${datos.cantidadAnulados} ${datos.cantidadAnulados === 1 ? 'anulado' : 'anulados'} (no suman)`}
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {datos.totalesPorCategoria.map((t) => (
                    <div key={t.categoria} className="rounded-2xl border border-linea bg-white px-4 py-3">
                      <dt className="text-sm text-suave">{NOMBRE_CATEGORIA_GASTO[t.categoria]}</dt>
                      <dd className="text-lg font-semibold text-verde-oscuro tabular-nums">{bolivianos(t.total)}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="titulo-lista-gastos" data-recorrido="gastos-lista">
                <h2 id="titulo-lista-gastos" className="text-lg font-semibold text-verde-oscuro">
                  Gastos registrados
                </h2>
                {datos.gastos.length === 0 ? (
                  <p
                    role="status"
                    className="mt-3 rounded-3xl border border-dashed border-linea bg-white px-6 py-8 text-center text-suave"
                  >
                    No hay gastos registrados en {nombreMes(datos.mes)}.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-linea/70 overflow-hidden rounded-3xl border border-linea bg-white">
                    {datos.gastos.map((g) => (
                      <li key={g.id}>
                        <FilaGasto gasto={g} alCambiar={avisarYRecargar} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <FormularioNuevo mes={mes} alGuardar={avisarYRecargar} />
      </div>
    </div>
  )
}

function CamposGasto({
  form,
  errores,
  alCambiar,
  prefijo,
}: {
  form: FormularioGasto
  errores: ErroresGasto
  alCambiar: (cambio: Partial<FormularioGasto>) => void
  prefijo: string
}) {
  return (
    <>
      <GrupoOpciones<CategoriaGasto>
        leyenda="Tipo de gasto"
        nombre={`${prefijo}-categoria`}
        opciones={OPCIONES}
        valor={form.categoria}
        alCambiar={(categoria) => alCambiar({ categoria })}
        error={errores.categoria}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          etiqueta="Fecha del gasto"
          type="date"
          max={hoyIso()}
          value={form.fecha}
          error={errores.fecha}
          onChange={(e) => alCambiar({ fecha: e.target.value })}
        />
        <CampoTexto
          etiqueta="Monto (Bs)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="120,00"
          value={form.monto}
          error={errores.monto}
          onChange={(e) => alCambiar({ monto: e.target.value })}
        />
      </div>
      <CampoTexto
        etiqueta={form.categoria === 'otros' ? 'Descripción' : 'Descripción (opcional)'}
        maxLength={200}
        value={form.descripcion}
        error={errores.descripcion}
        ayuda={form.categoria === 'otros' ? 'Obligatoria en «Otros gastos».' : 'Por ejemplo: servicio de noviembre.'}
        onChange={(e) => alCambiar({ descripcion: e.target.value })}
      />
    </>
  )
}

function FormularioNuevo({ mes, alGuardar }: { mes: string; alGuardar: (texto: string) => void }) {
  const [form, setForm] = useState<FormularioGasto>(() => formularioVacio(mes))
  const [mesDelFormulario, setMesDelFormulario] = useState(mes)
  const [errores, setErrores] = useState<ErroresGasto>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)

  // Al cambiar de mes sin haber escrito nada, la fecha sugerida acompaña al mes elegido.
  if (mes !== mesDelFormulario) {
    setMesDelFormulario(mes)
    if (!form.categoria && !form.monto && !form.descripcion) setForm(formularioVacio(mes))
  }

  const cambiar = (cambio: Partial<FormularioGasto>) => {
    const siguiente = { ...form, ...cambio }
    setForm(siguiente)
    if (intento) setErrores(validarGasto(siguiente))
  }

  const limpiar = () => {
    setForm(formularioVacio(mes))
    setErrores({})
    setIntento(false)
    setFallo(null)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setFallo(null)
    const encontrados = validarGasto(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return enfocarPrimerError(refForm.current)
    setGuardando(true)
    try {
      const gasto = await registrarGasto(aDatos(form))
      const otroMes = gasto.fecha.slice(0, 7) !== mes
      limpiar()
      alGuardar(
        `Gasto de ${bolivianos(gasto.monto)} registrado${otroMes ? ` en ${nombreMes(gasto.fecha.slice(0, 7))}: cambia de mes para verlo` : ''}.`,
      )
    } catch (error) {
      setFallo(
        error instanceof ErrorApi && error.estado === 400
          ? `No se guardó: ${error.message}.`
          : mensajeNoGuardado(error),
      )
      requestAnimationFrame(() => refFallo.current?.focus())
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta className="lg:sticky lg:top-4" data-recorrido="gastos-registrar">
      <form ref={refForm} noValidate onSubmit={guardar}>
        <fieldset disabled={guardando} className="space-y-5">
          <legend className="text-lg font-semibold text-verde-oscuro">Registrar gasto</legend>
          <CamposGasto form={form} errores={errores} alCambiar={cambiar} prefijo="nuevo" />
          {fallo && (
            <Aviso ref={refFallo} tipo="error">
              <p>{fallo}</p>
            </Aviso>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton variante="secundario" icono="cerrar" onClick={limpiar}>
              Cancelar
            </Boton>
            <Boton type="submit" icono="guardar" cargando={guardando} textoCargando="Guardando…">
              Guardar gasto
            </Boton>
          </div>
        </fieldset>
      </form>
    </Tarjeta>
  )
}

function FilaGasto({ gasto, alCambiar }: { gasto: Gasto; alCambiar: (texto: string) => void }) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'anular'>('ver')
  const [form, setForm] = useState<FormularioGasto>(() => aFormulario(gasto))
  const [errores, setErrores] = useState<ErroresGasto>({})
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  const refConfirmar = useRef<HTMLButtonElement>(null)
  const descripcion = `${NOMBRE_CATEGORIA_GASTO[gasto.categoria]} del ${fechaCorta(gasto.fecha)}`

  const cerrar = () => {
    setModo('ver')
    setForm(aFormulario(gasto))
    setErrores({})
    setMotivo('')
    setFallo(null)
  }

  async function corregir(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    const encontrados = validarGasto(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return enfocarPrimerError(refForm.current)
    setEnviando(true)
    setFallo(null)
    try {
      const corregido = await corregirGasto(gasto.id, aDatos(form))
      const otroMes = corregido.fecha.slice(0, 7) !== gasto.fecha.slice(0, 7)
      alCambiar(`Gasto corregido${otroMes ? `: ahora cuenta en ${nombreMes(corregido.fecha.slice(0, 7))}` : ''}.`)
    } catch (error) {
      setFallo(
        error instanceof ErrorApi && error.estado === 409
          ? 'Este gasto ya fue anulado y no se puede corregir.'
          : error instanceof ErrorApi && error.estado === 400
            ? `No se guardó: ${error.message}.`
            : mensajeNoGuardado(error),
      )
      setEnviando(false)
    }
  }

  async function anular() {
    if (enviando) return
    setEnviando(true)
    setFallo(null)
    try {
      await anularGasto(gasto.id, motivo.trim() || null)
      alCambiar(`Gasto anulado: ${descripcion} ya no suma en el total.`)
    } catch (error) {
      setFallo(mensajeNoGuardado(error).replace('No se guardó', 'No se anuló'))
      setEnviando(false)
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={`min-w-0 ${gasto.anulado ? 'text-suave' : ''}`}>
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {NOMBRE_CATEGORIA_GASTO[gasto.categoria]}
            {gasto.anulado && <Insignia color="gris">Anulado</Insignia>}
          </p>
          <p className="text-sm text-suave">
            {fechaCorta(gasto.fecha)}
            {gasto.descripcion && ` · ${gasto.descripcion}`}
          </p>
          {gasto.anulado && gasto.motivoAnulacion && (
            <p className="text-sm text-suave">Motivo: {gasto.motivoAnulacion}</p>
          )}
        </div>
        <p
          className={`text-lg font-semibold tabular-nums ${gasto.anulado ? 'text-suave line-through' : 'text-verde-oscuro'}`}
        >
          {bolivianos(gasto.monto)}
        </p>
      </div>

      {!gasto.anulado && modo === 'ver' && (
        <div className="mt-2 flex flex-wrap gap-1" data-recorrido="gastos-acciones">
          <Boton variante="texto" icono="editar" className="-ml-2" onClick={() => setModo('editar')}>
            Corregir<span className="sr-only"> {descripcion}</span>
          </Boton>
          <Boton
            variante="texto"
            icono="cerrar"
            onClick={() => {
              setModo('anular')
              requestAnimationFrame(() => refConfirmar.current?.focus())
            }}
          >
            Anular<span className="sr-only"> {descripcion}</span>
          </Boton>
        </div>
      )}

      {modo === 'editar' && (
        <form ref={refForm} noValidate onSubmit={corregir} className="mt-4 space-y-4 rounded-2xl bg-crema p-4">
          <fieldset disabled={enviando} className="space-y-4">
            <legend className="font-semibold text-verde-oscuro">Corregir gasto</legend>
            <CamposGasto
              form={form}
              errores={errores}
              alCambiar={(c) => setForm({ ...form, ...c })}
              prefijo={`editar-${gasto.id}`}
            />
          </fieldset>
          {fallo && (
            <p role="alert" className="text-sm text-error">
              {fallo}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" icono="guardar" cargando={enviando} textoCargando="Guardando…">
              Guardar corrección
            </Boton>
            <Boton variante="secundario" icono="cerrar" disabled={enviando} onClick={cerrar}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}

      {modo === 'anular' && (
        <div className="mt-4 space-y-3 rounded-2xl bg-crema p-4">
          <p className="font-semibold text-texto">¿Anular {descripcion}?</p>
          <p className="text-sm text-suave">
            Dejará de sumar en el total del mes. El registro se conserva como anulado y no se puede deshacer.
          </p>
          <CampoTexto
            etiqueta="Motivo (opcional)"
            maxLength={200}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {fallo && (
            <p role="alert" className="text-sm text-error">
              {fallo}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Boton ref={refConfirmar} cargando={enviando} textoCargando="Anulando…" onClick={anular}>
              Sí, anular gasto
            </Boton>
            <Boton variante="secundario" disabled={enviando} onClick={cerrar}>
              No, volver
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}

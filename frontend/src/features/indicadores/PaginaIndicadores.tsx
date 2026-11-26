import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { Boton, CampoTexto, Cargando, EncabezadoPagina, Tarjeta } from '../../componentes/ui'
import { esFechaValida, fechaLarga, hoyIso } from '../../utilidades/fechas'
import { NOMBRE_ESTADO } from '../carpetas/tipos'
import { consultarIndicadores } from '../expediente/expedienteApi'
import { bolivianos } from '../expediente/moneda'
import { consultarIndicadoresPorResidencia, filasPorResidencia, nombreGrupoResidencia } from './porResidencia'

const iso = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

function esteMes() {
  const hoy = new Date()
  return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: hoyIso() }
}

function mesAnterior() {
  const hoy = new Date()
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
    hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
  }
}

/**
 * FE-92 · Indicadores operativos para administración (cálculo de FE-91). Casos actuales y por estado son una
 * foto del momento; sesiones y pagos recibidos dependen del período elegido, con ambos extremos incluidos.
 * El período vive en la URL para poder recargar o compartir la misma consulta.
 * FE-138 · Desglose por ciudad de residencia del paciente con el mismo período (FE-134/FE-136).
 */
export function PaginaIndicadores() {
  const [params, setParams] = useSearchParams()
  const porDefecto = esteMes()
  const desdeUrl = params.get('desde') ?? ''
  const hastaUrl = params.get('hasta') ?? ''
  const urlValida = esFechaValida(desdeUrl) && esFechaValida(hastaUrl) && desdeUrl <= hastaUrl
  const desde = urlValida ? desdeUrl : porDefecto.desde
  const hasta = urlValida ? hastaUrl : porDefecto.hasta

  const { datos, error, cargando, recargar } = useCarga(() => consultarIndicadores(desde, hasta), [desde, hasta])
  const consultar = (periodo: { desde: string; hasta: string }) => setParams(periodo)

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Indicadores"
        descripcion="Casos, sesiones y pagos de la fundación. Los casos muestran el estado actual; sesiones y pagos, el período elegido."
      />

      <SelectorPeriodo key={`${desde}|${hasta}`} desde={desde} hasta={hasta} alConsultar={consultar} />

      {error !== undefined ? (
        <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudieron calcular los indicadores." />
      ) : !datos ? (
        <Cargando texto="Calculando indicadores…" />
      ) : (
        <section aria-live="polite" aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
          <h2 className="sr-only">Resultados</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra titulo="Casos actuales" valor={String(datos.casosActuales)} nota="Todos los casos vigentes, hoy" />
            <Tarjeta className="sm:col-span-1">
              <h3 className="text-sm font-semibold text-suave">Casos por estado</h3>
              <dl className="mt-2 space-y-1">
                {(['iniciado', 'en_proceso', 'concluido'] as const).map((e) => (
                  <div key={e} className="flex justify-between gap-3">
                    <dt className="text-texto">{NOMBRE_ESTADO[e]}</dt>
                    <dd className="font-semibold text-verde-oscuro tabular-nums">{datos.casosPorEstado[e]}</dd>
                  </div>
                ))}
              </dl>
            </Tarjeta>
            <Cifra
              titulo="Sesiones del período"
              valor={String(datos.sesiones)}
              nota={`Del ${fechaLarga(datos.periodo.desde)} al ${fechaLarga(datos.periodo.hasta)}`}
            />
            <Cifra
              titulo="Pagos recibidos"
              valor={bolivianos(datos.pagosRecibidos.monto)}
              nota={`Del ${fechaLarga(datos.periodo.desde)} al ${fechaLarga(datos.periodo.hasta)}`}
            />
          </div>
        </section>
      )}

      <IndicadoresPorResidencia desde={desde} hasta={hasta} />
    </div>
  )
}

/**
 * Tabla por ciudad de residencia. Se carga aparte: si falla, el resto de los indicadores sigue visible
 * y el error se muestra como error, nunca como ceros.
 */
function IndicadoresPorResidencia({ desde, hasta }: { desde: string; hasta: string }) {
  const { datos, error, cargando, recargar } = useCarga(
    () => consultarIndicadoresPorResidencia(desde, hasta),
    [desde, hasta],
  )
  const filas = datos ? filasPorResidencia(datos) : []

  return (
    <section aria-labelledby="titulo-por-residencia" className="space-y-3">
      <div>
        <h2 id="titulo-por-residencia" className="text-lg font-semibold text-verde-oscuro">
          Por ciudad de residencia
        </h2>
        <p className="text-sm text-suave">
          Ciudad donde vive el paciente, no donde se atiende. Los casos sin dato aparecen en «Sin registrar».
        </p>
      </div>

      {error !== undefined ? (
        <ErrorDeCarga
          error={error}
          alReintentar={recargar}
          contexto="No se pudo calcular el desglose por residencia."
        />
      ) : !datos ? (
        <Cargando texto="Calculando por residencia…" />
      ) : (
        <div aria-busy={cargando} className={cargando ? 'opacity-60' : undefined}>
          {/* Escritorio y tableta: tabla con encabezados de fila y columna. */}
          <div className="hidden overflow-x-auto rounded-3xl border border-linea bg-white sm:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Casos, sesiones y pagos por ciudad de residencia, del {fechaLarga(datos.periodo.desde)} al{' '}
                {fechaLarga(datos.periodo.hasta)}
              </caption>
              <thead className="bg-crema text-suave">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Residencia
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Casos actuales
                  </th>
                  {(['iniciado', 'en_proceso', 'concluido'] as const).map((e) => (
                    <th key={e} scope="col" className="px-4 py-3 text-right font-semibold">
                      {NOMBRE_ESTADO[e]}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Sesiones
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Pagos recibidos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea/70">
                {filas.map((f) => (
                  <tr key={f.residencia}>
                    <th scope="row" className="px-4 py-3 font-semibold text-texto">
                      {nombreGrupoResidencia(f.residencia)}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">{f.casosActuales}</td>
                    {(['iniciado', 'en_proceso', 'concluido'] as const).map((e) => (
                      <td key={e} className="px-4 py-3 text-right tabular-nums">
                        {f.casosPorEstado[e]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right tabular-nums">{f.sesiones}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {bolivianos(f.pagosRecibidos.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: una tarjeta por ciudad, sin desplazamiento horizontal. */}
          <ul className="grid gap-3 sm:hidden">
            {filas.map((f) => (
              <li key={f.residencia}>
                <Tarjeta>
                  <h3 className="font-semibold text-verde-oscuro">{nombreGrupoResidencia(f.residencia)}</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-suave">Casos actuales</dt>
                    <dd className="text-right font-semibold tabular-nums">{f.casosActuales}</dd>
                    {(['iniciado', 'en_proceso', 'concluido'] as const).map((e) => (
                      <div key={e} className="contents">
                        <dt className="text-suave">{NOMBRE_ESTADO[e]}</dt>
                        <dd className="text-right tabular-nums">{f.casosPorEstado[e]}</dd>
                      </div>
                    ))}
                    <dt className="text-suave">Sesiones</dt>
                    <dd className="text-right tabular-nums">{f.sesiones}</dd>
                    <dt className="text-suave">Pagos recibidos</dt>
                    <dd className="text-right tabular-nums">{bolivianos(f.pagosRecibidos.monto)}</dd>
                  </dl>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <Tarjeta>
      <h3 className="text-sm font-semibold text-suave">{titulo}</h3>
      <p className="mt-2 text-3xl font-semibold text-verde-oscuro tabular-nums">{valor}</p>
      <p className="mt-1 text-sm text-suave">{nota}</p>
    </Tarjeta>
  )
}

function SelectorPeriodo({
  desde: desdeInicial,
  hasta: hastaInicial,
  alConsultar,
}: {
  desde: string
  hasta: string
  alConsultar: (periodo: { desde: string; hasta: string }) => void
}) {
  const [desde, setDesde] = useState(desdeInicial)
  const [hasta, setHasta] = useState(hastaInicial)
  const [errores, setErrores] = useState<{ desde?: string; hasta?: string }>({})

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const e: { desde?: string; hasta?: string } = {}
    if (!esFechaValida(desde)) e.desde = 'Indica una fecha válida.'
    if (!esFechaValida(hasta)) e.hasta = 'Indica una fecha válida.'
    if (!e.desde && !e.hasta && desde > hasta) e.hasta = 'Debe ser igual o posterior a la fecha desde.'
    setErrores(e)
    if (!e.desde && !e.hasta) alConsultar({ desde, hasta })
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <CampoTexto
          etiqueta="Desde"
          type="date"
          max="9999-12-31"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          error={errores.desde}
          className="lg:w-52"
        />
        <CampoTexto
          etiqueta="Hasta"
          type="date"
          max="9999-12-31"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          error={errores.hasta}
          className="lg:w-52"
        />
        <Boton type="submit">Consultar</Boton>
        <div className="flex gap-1 lg:ml-auto">
          <Boton variante="texto" onClick={() => alConsultar(esteMes())}>
            Este mes
          </Boton>
          <Boton variante="texto" onClick={() => alConsultar(mesAnterior())}>
            Mes anterior
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

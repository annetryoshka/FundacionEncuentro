import { Boton } from '../../componentes/ui'
import { NOMBRE_ESTADO_FILA, type FilaImportacion } from './importacion'

const DECISION = { crear: 'Crear', vincular: 'Vincular', excluir: 'Excluir' } as const

/** FE-162 · Vista comparativa; las decisiones se guardan en el detalle existente de FE-165. */
export function TablaRevisionImportacion({
  filas,
  alRevisar,
  bloqueada = false,
}: {
  filas: FilaImportacion[]
  alRevisar: (numeroFila: number) => void
  bloqueada?: boolean
}) {
  if (filas.length === 0) return null
  return (
    <section aria-label="Tabla de revisión del archivo" className="min-w-0">
      <div
        role="region"
        aria-label="Filas del archivo; desplaza para ver todas las columnas"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-linea focus-visible:outline-3 focus-visible:outline-naranja"
      >
        <table className="w-full min-w-[42rem] text-left text-sm">
          <caption className="bg-white px-4 py-3 text-left font-semibold text-verde-oscuro">
            Resumen de revisión
          </caption>
          <thead className="bg-crema text-verde-oscuro">
            <tr>
              {['Fila y origen', 'Paciente', 'Tipo / número', 'Estado', 'Revisión', 'Decisión'].map((c) => (
                <th key={c} scope="col" className="px-4 py-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linea bg-white">
            {filas.map((f) => (
              <tr key={f.numeroFila}>
                <th scope="row" className="max-w-48 break-words px-4 py-3 font-normal">
                  {f.numeroFila}
                  {f.referenciaOrigen && <span className="block text-suave">{f.referenciaOrigen}</span>}
                </th>
                <td className="max-w-56 break-words px-4 py-3">{f.datos.nombreCompleto?.trim() || 'Sin nombre'}</td>
                <td className="px-4 py-3">
                  {f.datos.tipo || 'Sin tipo'}
                  <span className="block text-suave">
                    {f.datos.numeroCorrelativo ? `Nº ${f.datos.numeroCorrelativo}` : 'Número por asignar'}
                  </span>
                </td>
                <td className="px-4 py-3">{NOMBRE_ESTADO_FILA[f.estado]}</td>
                <td className="px-4 py-3">
                  <p>
                    {f.errores.length} {f.errores.length === 1 ? 'error' : 'errores'} · {f.coincidencias.length}{' '}
                    {f.coincidencias.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </p>
                  <Boton variante="texto" disabled={bloqueada} onClick={() => alRevisar(f.numeroFila)}>
                    Revisar fila {f.numeroFila}
                  </Boton>
                </td>
                <td className="px-4 py-3">{f.decision ? DECISION[f.decision] : 'Sin decidir'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
